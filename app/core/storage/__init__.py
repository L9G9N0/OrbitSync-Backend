from app.core.storage.base import StorageProvider
from app.core.storage.factory import StorageProviderFactory
from app.core.storage.exceptions import (
    StorageError,
    StorageConnectionError,
    BucketError,
    ObjectNotFoundError,
    UploadError,
    DownloadError,
    ShareLinkError
)

def get_storage_provider() -> StorageProvider:
    """FastAPI dependency to retrieve the configured StorageProvider instance."""
    return StorageProviderFactory.get_provider()
