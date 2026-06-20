import os
import shutil
import logging
import asyncio
from typing import AsyncIterator, Optional, List, Dict, Any
from app.core.storage.base import StorageProvider
from app.core.storage.exceptions import (
    ObjectNotFoundError,
    UploadError,
    DownloadError
)

logger = logging.getLogger("LocalProvider")

class LocalProvider(StorageProvider):
    """Local storage provider mapping S3 commands to file operations on local disks (for local unit tests)."""

    def __init__(self, base_directory: str = "./local_vault_storage"):
        self.base_dir = os.path.abspath(base_directory)
        os.makedirs(self.base_dir, exist_ok=True)
        logger.info(f"Initialized Local Vault Storage inside directory: '{self.base_dir}'")

    def _get_path(self, object_name: str) -> str:
        # Prevent directory traversal attacks by resolving path
        safe_path = os.path.abspath(os.path.join(self.base_dir, object_name))
        if not safe_path.startswith(self.base_dir):
            raise PermissionError("Access outside storage directories is forbidden.")
        return safe_path

    async def upload_file(
        self,
        file_obj: Any,
        object_name: str,
        content_type: Optional[str] = None,
        metadata: Optional[Dict[str, str]] = None
    ) -> bool:
        try:
            target_path = self._get_path(object_name)
            os.makedirs(os.path.dirname(target_path), exist_ok=True)

            # Write file in threadpool to prevent blocking the async loop
            def write_file():
                with open(target_path, "wb") as buffer:
                    shutil.copyfileobj(file_obj, buffer)

            await asyncio.to_thread(write_file)
            logger.info(f"Local storage upload success: '{object_name}'")
            return True
        except Exception as e:
            logger.error(f"Local storage upload failed: {str(e)}")
            raise UploadError(f"Failed to copy file locally: {str(e)}")

    async def download_file(
        self,
        object_name: str
    ) -> AsyncIterator[bytes]:
        try:
            target_path = self._get_path(object_name)
            if not os.path.exists(target_path):
                raise ObjectNotFoundError(f"File '{object_name}' not found locally.")

            # Yield chunks asynchronously
            async def chunk_generator():
                with open(target_path, "rb") as f:
                    while True:
                        chunk = f.read(64 * 1024)
                        if not chunk:
                            break
                        yield chunk

            generator = chunk_generator()
            async for chunk in generator:
                yield chunk
        except Exception as e:
            if not isinstance(e, ObjectNotFoundError):
                raise DownloadError(f"Local download failed: {str(e)}")
            raise e

    async def delete_file(
        self,
        object_name: str
    ) -> bool:
        try:
            target_path = self._get_path(object_name)
            if os.path.exists(target_path):
                os.remove(target_path)
                logger.info(f"Local storage delete success: '{object_name}'")
            return True
        except Exception as e:
            logger.error(f"Local storage delete failed: {str(e)}")
            raise DownloadError(f"Failed to remove local file: {str(e)}")

    async def generate_presigned_url(
        self,
        object_name: str,
        operation: str = 'get_object',
        expires_in: int = 3600,
        response_headers: Optional[Dict[str, str]] = None
    ) -> str:
        from app.core.config import settings
        import urllib.parse
        base_url = settings.API_BASE_URL.rstrip('/')
        url = f"{base_url}/files/download-raw/{object_name}"
        
        # Try to extract filename from response_headers
        filename = None
        if response_headers:
            disp = None
            for k, v in response_headers.items():
                if k.lower() in ('responsecontentdisposition', 'response-content-disposition', 'content-disposition'):
                    disp = v
                    break
            if disp and 'filename=' in disp:
                try:
                    parts = disp.split('filename=')
                    if len(parts) > 1:
                        fn = parts[1].strip()
                        if fn.startswith('"') and fn.endswith('"'):
                            fn = fn[1:-1]
                        elif fn.startswith("'") and fn.endswith("'"):
                            fn = fn[1:-1]
                        filename = fn
                except Exception:
                    pass
        
        if filename:
            url += f"?filename={urllib.parse.quote(filename)}"
            
        return url


    async def file_exists(
        self,
        object_name: str
    ) -> bool:
        return os.path.exists(self._get_path(object_name))

    async def get_metadata(
        self,
        object_name: str
    ) -> Dict[str, Any]:
        target_path = self._get_path(object_name)
        if not os.path.exists(target_path):
            raise ObjectNotFoundError(f"File '{object_name}' not found locally.")
        
        import mimetypes
        content_type, _ = mimetypes.guess_type(target_path)
        content_type = content_type or "application/octet-stream"
        
        stat = os.stat(target_path)
        return {
            "content_length": stat.st_size,
            "content_type": content_type,
            "last_modified": stat.st_mtime,
            "metadata": {}
        }

    async def list_files(self) -> List[Dict[str, Any]]:
        results = []
        for filename in os.listdir(self.base_dir):
            filepath = os.path.join(self.base_dir, filename)
            if os.path.isfile(filepath):
                stat = os.stat(filepath)
                results.append({
                    "key": filename,
                    "last_modified": stat.st_mtime,
                    "size": stat.st_size,
                    "etag": filename # mock ETag
                })
        return results
