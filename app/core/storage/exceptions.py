class StorageError(Exception):
    """Base exception for all storage actions."""
    pass

class StorageConnectionError(StorageError):
    """Raised when connecting to the storage backend fails."""
    pass

class BucketError(StorageError):
    """Raised when bucket creation or configuration fails."""
    pass

class ObjectNotFoundError(StorageError):
    """Raised when the target storage object is missing."""
    pass

class UploadError(StorageError):
    """Raised when file upload fails."""
    pass

class DownloadError(StorageError):
    """Raised when file download or streaming fails."""
    pass

class ShareLinkError(StorageError):
    """Raised when generating presigned sharing links fails."""
    pass
