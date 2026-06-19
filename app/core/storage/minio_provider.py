import asyncio
import logging
import aioboto3
from typing import AsyncIterator, Optional, List, Dict, Any
from urllib.parse import urlparse, urlunparse

from app.core.storage.base import StorageProvider
from app.core.storage.exceptions import (
    StorageConnectionError,
    BucketError,
    ObjectNotFoundError,
    UploadError,
    DownloadError,
    ShareLinkError
)

logger = logging.getLogger("MinIOProvider")

class MinIOProvider(StorageProvider):
    """Production-grade MinIO (S3-compatible) storage provider with retry logic and remapped public URLs."""

    def __init__(
        self,
        endpoint_url: str,
        access_key: str,
        secret_key: str,
        bucket_name: str,
        region_name: str = "us-east-1",
        public_url: Optional[str] = None
    ):
        self.bucket_name = bucket_name
        self.public_url = public_url
        self.session = aioboto3.Session()
        
        self.client_kwargs = {
            "endpoint_url": endpoint_url,
            "aws_access_key_id": access_key,
            "aws_secret_access_key": secret_key,
            "region_name": region_name
        }
        self._bucket_checked = False
        self._lock = asyncio.Lock()

    async def _ensure_bucket(self, client) -> None:
        """Checks if bucket exists and automatically creates it if missing with exponential backoff retries."""
        if self._bucket_checked:
            return

        async with self._lock:
            # Double check inside lock
            if self._bucket_checked:
                return

            retries = 3
            delay = 1.0
            backoff = 2.0

            for attempt in range(retries):
                try:
                    # Check if bucket exists
                    await client.head_bucket(Bucket=self.bucket_name)
                    self._bucket_checked = True
                    logger.info(f"Verified bucket existence: '{self.bucket_name}'")
                    return
                except Exception as e:
                    # Error could mean bucket doesn't exist, let's try creating it
                    logger.warning(
                        f"Bucket check attempt {attempt + 1} failed for '{self.bucket_name}'. Error: {str(e)}"
                    )
                    try:
                        await client.create_bucket(Bucket=self.bucket_name)
                        self._bucket_checked = True
                        logger.info(f"Created missing bucket: '{self.bucket_name}'")
                        return
                    except Exception as create_err:
                        if attempt == retries - 1:
                            raise BucketError(
                                f"Failed to assert bucket '{self.bucket_name}' after {retries} attempts: {str(create_err)}"
                            )
                        await asyncio.sleep(delay)
                        delay *= backoff

    async def upload_file(
        self,
        file_obj: Any,
        object_name: str,
        content_type: Optional[str] = None,
        metadata: Optional[Dict[str, str]] = None
    ) -> bool:
        """Streams a binary file object to MinIO securely."""
        extra_args = {}
        if content_type:
            extra_args["ContentType"] = content_type
        if metadata:
            extra_args["Metadata"] = metadata

        try:
            async with self.session.client("s3", **self.client_kwargs) as client:
                await self._ensure_bucket(client)
                
                # S3 upload_fileobj automatically streams and performs multipart upload under the hood
                await client.upload_fileobj(
                    file_obj,
                    self.bucket_name,
                    object_name,
                    ExtraArgs=extra_args
                )
                logger.info(f"Successfully uploaded object: '{object_name}' to bucket '{self.bucket_name}'")
                return True
        except Exception as e:
            logger.error(f"MinIO upload error for '{object_name}': {str(e)}")
            raise UploadError(f"Failed to stream upload object to MinIO: {str(e)}")

    async def download_file(
        self,
        object_name: str
    ) -> AsyncIterator[bytes]:
        """Downloads and yields object binary chunks in 64KB buffers (prevents high memory footprint)."""
        try:
            async with self.session.client("s3", **self.client_kwargs) as client:
                await self._ensure_bucket(client)
                try:
                    response = await client.get_object(Bucket=self.bucket_name, Key=object_name)
                except client.exceptions.NoSuchKey:
                    logger.error(f"Object key not found in storage: '{object_name}'")
                    raise ObjectNotFoundError(f"File '{object_name}' was not found in storage.")
                except Exception as get_err:
                    raise DownloadError(f"MinIO read failed: {str(get_err)}")

                async with response["Body"] as stream:
                    while True:
                        chunk = await stream.read(64 * 1024)  # 64 KB chunks
                        if not chunk:
                            break
                        yield chunk
        except Exception as e:
            if not isinstance(e, (ObjectNotFoundError, DownloadError)):
                raise DownloadError(f"Streaming failed for object '{object_name}': {str(e)}")
            raise e

    async def delete_file(
        self,
        object_name: str
    ) -> bool:
        """Deletes an object key from the bucket."""
        try:
            async with self.session.client("s3", **self.client_kwargs) as client:
                await self._ensure_bucket(client)
                await client.delete_object(Bucket=self.bucket_name, Key=object_name)
                logger.info(f"Successfully deleted object: '{object_name}' from bucket '{self.bucket_name}'")
                return True
        except Exception as e:
            logger.error(f"MinIO delete operation failed for '{object_name}': {str(e)}")
            raise UploadError(f"Failed to delete object from storage: {str(e)}")

    async def generate_presigned_url(
        self,
        object_name: str,
        operation: str = 'get_object',
        expires_in: int = 3600,
        response_headers: Optional[Dict[str, str]] = None
    ) -> str:
        """Generates a secure, expiring presigned URL, remapping internal hostnames to public domains."""
        try:
            async with self.session.client("s3", **self.client_kwargs) as client:
                # Note: S3 head bucket assertion not strictly needed to generate sign URLs, but we do it to verify status
                await self._ensure_bucket(client)
                
                params = {"Bucket": self.bucket_name, "Key": object_name}
                if response_headers:
                    for key, val in response_headers.items():
                        # S3 response overrides mapping
                        if key == 'ResponseContentDisposition':
                            params['ResponseContentDisposition'] = val
                        elif key == 'ResponseContentType':
                            params['ResponseContentType'] = val

                url = await client.generate_presigned_url(
                    ClientMethod=operation,
                    Params=params,
                    ExpiresIn=expires_in
                )
                
                # Remap domain if public_url is configured (resolves docker networking vs client browser access)
                if self.public_url:
                    url = self._remap_url_to_public(url)
                    
                return url
        except Exception as e:
            logger.error(f"Failed to generate presigned link for '{object_name}': {str(e)}")
            raise ShareLinkError(f"Presigned URL generation failed: {str(e)}")

    def _remap_url_to_public(self, original_url: str) -> str:
        """Helper to replace internal S3 domains with client-accessible public gateways."""
        try:
            parsed_orig = urlparse(original_url)
            parsed_pub = urlparse(self.public_url)
            
            # Replace hostname and scheme
            new_netloc = parsed_pub.netloc
            remapped = parsed_orig._replace(scheme=parsed_pub.scheme, netloc=new_netloc)
            return urlunparse(remapped)
        except Exception as e:
            logger.warning(f"Failed to remap URL '{original_url}' using public prefix '{self.public_url}': {str(e)}")
            return original_url

    async def file_exists(
        self,
        object_name: str
    ) -> bool:
        """Checks if file metadata head asserts successfully."""
        try:
            async with self.session.client("s3", **self.client_kwargs) as client:
                await self._ensure_bucket(client)
                await client.head_object(Bucket=self.bucket_name, Key=object_name)
                return True
        except client.exceptions.ClientError as ce:
            if ce.response.get("Error", {}).get("Code") == "404":
                return False
            raise StorageConnectionError(f"Object existence query failed: {str(ce)}")
        except Exception as e:
            raise StorageConnectionError(f"Head request failed: {str(e)}")

    async def get_metadata(
        self,
        object_name: str
    ) -> Dict[str, Any]:
        """Extracts system and user metadata for a file key."""
        try:
            async with self.session.client("s3", **self.client_kwargs) as client:
                await self._ensure_bucket(client)
                response = await client.head_object(Bucket=self.bucket_name, Key=object_name)
                return {
                    "content_length": response.get("ContentLength"),
                    "content_type": response.get("ContentType"),
                    "last_modified": response.get("LastModified"),
                    "metadata": response.get("Metadata", {})
                }
        except Exception as e:
            logger.error(f"Head request metadata failed for '{object_name}': {str(e)}")
            raise ObjectNotFoundError(f"Failed to retrieve metadata: {str(e)}")

    async def list_files(self) -> List[Dict[str, Any]]:
        """Retrieves raw objects inventory list from the bucket."""
        try:
            async with self.session.client("s3", **self.client_kwargs) as client:
                await self._ensure_bucket(client)
                response = await client.list_objects_v2(Bucket=self.bucket_name)
                
                results = []
                for obj in response.get("Contents", []):
                    results.append({
                        "key": obj.get("Key"),
                        "last_modified": obj.get("LastModified"),
                        "size": obj.get("Size"),
                        "etag": obj.get("ETag")
                    })
                return results
        except Exception as e:
            logger.error(f"Listing bucket objects inventory failed: {str(e)}")
            raise StorageConnectionError(f"Listing storage objects failed: {str(e)}")
