import logging
from typing import Optional
from app.core.config import settings
from app.core.storage.base import StorageProvider
from app.core.storage.minio_provider import MinIOProvider
from app.core.storage.s3_provider import S3Provider
from app.core.storage.local_provider import LocalProvider

logger = logging.getLogger("StorageFactory")

class StorageProviderFactory:
    """Factory creating StorageProvider instances based on environment configuration settings."""

    _instance: Optional[StorageProvider] = None

    @classmethod
    def get_provider(cls) -> StorageProvider:
        """Instantiates or returns singleton instance of the configured Storage Provider."""
        if cls._instance is not None:
            return cls._instance

        provider_name = getattr(settings, "STORAGE_PROVIDER", "minio").lower()
        logger.info(f"Resolving storage provider engine: '{provider_name}'")

        if provider_name == "minio":
            endpoint = f"{settings.MINIO_ENDPOINT}:{settings.MINIO_PORT}"
            # Prefix protocol if not present
            if not endpoint.startswith("http://") and not endpoint.startswith("https://"):
                protocol = "https://" if getattr(settings, "MINIO_SECURE", False) else "http://"
                endpoint = f"{protocol}{endpoint}"

            public_url = getattr(settings, "MINIO_PUBLIC_URL", None) or endpoint

            cls._instance = MinIOProvider(
                endpoint_url=endpoint,
                access_key=settings.MINIO_ACCESS_KEY,
                secret_key=settings.MINIO_SECRET_KEY,
                bucket_name=settings.MINIO_BUCKET,
                public_url=public_url
            )
        elif provider_name == "s3":
            access_key = getattr(settings, "AWS_ACCESS_KEY_ID", "")
            secret_key = getattr(settings, "AWS_SECRET_ACCESS_KEY", "")
            bucket_name = getattr(settings, "S3_BUCKET_NAME", "")
            region = getattr(settings, "AWS_REGION", "us-east-1")
            
            cls._instance = S3Provider(
                access_key=access_key,
                secret_key=secret_key,
                bucket_name=bucket_name,
                region_name=region
            )
        elif provider_name == "local":
            vault_dir = getattr(settings, "LOCAL_STORAGE_DIR", "./local_vault_storage")
            cls._instance = LocalProvider(base_directory=vault_dir)
        else:
            raise ValueError(f"Unknown storage provider configuration: '{provider_name}'")

        return cls._instance
