import io
import os
import shutil
import unittest
import asyncio
from unittest.mock import MagicMock

# Import storage package elements
from app.core.storage.exceptions import ObjectNotFoundError, UploadError
from app.core.storage.local_provider import LocalProvider
from app.core.storage.factory import StorageProviderFactory
from app.core.config import settings

class TestStorageProviderFactory(unittest.TestCase):
    def test_factory_local_mapping(self):
        """Verify factory returns LocalProvider when STORAGE_PROVIDER is 'local'."""
        original_provider = settings.STORAGE_PROVIDER
        settings.STORAGE_PROVIDER = "local"
        
        provider = StorageProviderFactory.get_provider()
        self.assertIsInstance(provider, LocalProvider)
        
        # Restore
        settings.STORAGE_PROVIDER = original_provider


class TestLocalProvider(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.test_dir = "./tests/temp_vault_test"
        self.provider = LocalProvider(base_directory=self.test_dir)
        self.test_filename = "test_blob.txt"
        self.test_content = b"BlackHole local storage engine test payload"

    def tearDown(self):
        # Clean up temporary test storage folder
        if os.path.exists(self.test_dir):
            shutil.rmtree(self.test_dir)

    async def test_upload_and_check_exists(self):
        """Test uploading a file to local disk and asserting its existence."""
        file_stream = io.BytesIO(self.test_content)
        
        # Upload
        uploaded = await self.provider.upload_file(file_stream, self.test_filename)
        self.assertTrue(uploaded)
        
        # Verify file is physically created
        self.assertTrue(os.path.exists(os.path.join(self.test_dir, self.test_filename)))
        
        # Check exists method
        exists = await self.provider.file_exists(self.test_filename)
        self.assertTrue(exists)

    async def test_download_streaming(self):
        """Test downloading a file and verifying the chunked stream output."""
        file_stream = io.BytesIO(self.test_content)
        await self.provider.upload_file(file_stream, self.test_filename)
        
        # Download
        downloaded_chunks = []
        async for chunk in self.provider.download_file(self.test_filename):
            downloaded_chunks.append(chunk)
            
        full_content = b"".join(downloaded_chunks)
        self.assertEqual(full_content, self.test_content)

    async def test_download_missing_file_raises_error(self):
        """Verify downloading a non-existent file raises ObjectNotFoundError."""
        with self.assertRaises(ObjectNotFoundError):
            async for _ in self.provider.download_file("ghost_file.txt"):
                pass

    async def test_get_metadata(self):
        """Test retrieving correct file size and basic metadata."""
        file_stream = io.BytesIO(self.test_content)
        await self.provider.upload_file(file_stream, self.test_filename)
        
        metadata = await self.provider.get_metadata(self.test_filename)
        self.assertEqual(metadata["content_length"], len(self.test_content))
        self.assertIn("content_type", metadata)

    async def test_delete_file(self):
        """Test that delete removes the file from local storage."""
        file_stream = io.BytesIO(self.test_content)
        await self.provider.upload_file(file_stream, self.test_filename)
        
        # Delete
        deleted = await self.provider.delete_file(self.test_filename)
        self.assertTrue(deleted)
        
        # Assert file is removed
        self.assertFalse(os.path.exists(os.path.join(self.test_dir, self.test_filename)))
        self.assertFalse(await self.provider.file_exists(self.test_filename))

    async def test_list_files(self):
        """Test that list_files lists all active local storage records."""
        file_stream1 = io.BytesIO(self.test_content)
        file_stream2 = io.BytesIO(b"another string")
        
        await self.provider.upload_file(file_stream1, "file1.txt")
        await self.provider.upload_file(file_stream2, "file2.txt")
        
        inventory = await self.provider.list_files()
        inventory_keys = {item["key"] for item in inventory}
        
        self.assertEqual(len(inventory), 2)
        self.assertIn("file1.txt", inventory_keys)
        self.assertIn("file2.txt", inventory_keys)


if __name__ == "__main__":
    unittest.main()
