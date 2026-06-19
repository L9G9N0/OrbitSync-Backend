from abc import ABC, abstractmethod
from typing import AsyncIterator, Optional, List, Dict, Any

class StorageProvider(ABC):
    """Abstract base class establishing the interface for all Storage Providers."""

    @abstractmethod
    async def upload_file(
        self,
        file_obj: Any,
        object_name: str,
        content_type: Optional[str] = None,
        metadata: Optional[Dict[str, str]] = None
    ) -> bool:
        """Uploads a file object to the storage backend."""
        pass

    @abstractmethod
    async def download_file(
        self,
        object_name: str
    ) -> AsyncIterator[bytes]:
        """Downloads a file object and yields chunks of bytes asynchronously."""
        pass

    @abstractmethod
    async def delete_file(
        self,
        object_name: str
    ) -> bool:
        """Deletes a file object from the storage backend."""
        pass

    @abstractmethod
    async def generate_presigned_url(
        self,
        object_name: str,
        operation: str = 'get_object',
        expires_in: int = 3600,
        response_headers: Optional[Dict[str, str]] = None
    ) -> str:
        """Generates a secure, expiring presigned URL for an object."""
        pass

    @abstractmethod
    async def file_exists(
        self,
        object_name: str
    ) -> bool:
        """Checks whether an object exists in the storage bucket."""
        pass

    @abstractmethod
    async def get_metadata(
        self,
        object_name: str
    ) -> Dict[str, Any]:
        """Retrieves system and user-defined metadata of a storage object."""
        pass

    @abstractmethod
    async def list_files(self) -> List[Dict[str, Any]]:
        """Lists metadata of all objects stored in the current bucket."""
        pass
