import logging
from typing import Optional
from app.core.storage.minio_provider import MinIOProvider

logger = logging.getLogger("S3Provider")

class S3Provider(MinIOProvider):
    """AWS S3 Storage Provider extending MinIO S3-compat configurations for direct AWS integration."""

    def __init__(
        self,
        access_key: str,
        secret_key: str,
        bucket_name: str,
        region_name: str = "us-east-1"
    ):
        # AWS S3 uses standard regional endpoints instead of custom endpoint URLs
        super().__init__(
            endpoint_url=f"https://s3.{region_name}.amazonaws.com",
            access_key=access_key,
            secret_key=secret_key,
            bucket_name=bucket_name,
            region_name=region_name,
            public_url=None # Presigned URLs default to standard AWS URLs
        )
        logger.info(f"Initialized AWS S3 Storage Provider on region '{region_name}'")
