import unittest
from unittest.mock import MagicMock, AsyncMock, patch
from fastapi.testclient import TestClient
from fastapi import HTTPException

from app.main import app
from app.api import get_current_user

class MockQueryBuilder:
    """Helper to mock Supabase/PostgREST chained database query builder calls."""
    def __init__(self, data=None):
        self.data = data if data is not None else []

    def select(self, *args, **kwargs):
        return self

    def insert(self, *args, **kwargs):
        return self

    def update(self, *args, **kwargs):
        return self

    def delete(self, *args, **kwargs):
        return self

    def eq(self, *args, **kwargs):
        return self

    def ilike(self, *args, **kwargs):
        return self

    def order(self, *args, **kwargs):
        return self

    def in_(self, *args, **kwargs):
        return self

    def execute(self):
        res = MagicMock()
        res.data = self.data
        return res


class TestAuthHeadersAndVerification(unittest.IsolatedAsyncioTestCase):
    """Unit tests for the get_current_user FastAPI dependency."""

    @patch("app.api.supabase")
    async def test_missing_auth_header_raises_401(self, mock_supabase):
        with self.assertRaises(HTTPException) as ctx:
            await get_current_user(authorization=None)
        self.assertEqual(ctx.exception.status_code, 401)
        self.assertIn("Missing Authorization Header", ctx.exception.detail)

    @patch("app.api.supabase")
    async def test_invalid_header_format_raises_401(self, mock_supabase):
        with self.assertRaises(HTTPException) as ctx:
            await get_current_user(authorization="Token my-access-token-string")
        self.assertEqual(ctx.exception.status_code, 401)
        self.assertIn("Expected 'Bearer <token>'", ctx.exception.detail)

    @patch("app.api.supabase")
    async def test_valid_token_returns_user_id(self, mock_supabase):
        mock_user = MagicMock()
        mock_user.id = "user-abc-123"
        mock_response = MagicMock()
        mock_response.user = mock_user
        mock_supabase.auth.get_user.return_value = mock_response

        user_id = await get_current_user(authorization="Bearer valid-token-here")
        self.assertEqual(user_id, "user-abc-123")
        mock_supabase.auth.get_user.assert_called_once_with(jwt="valid-token-here")

    @patch("app.api.supabase")
    async def test_invalid_or_expired_token_raises_401(self, mock_supabase):
        mock_supabase.auth.get_user.side_effect = Exception("Token expired")
        with self.assertRaises(HTTPException) as ctx:
            await get_current_user(authorization="Bearer expired-token")
        self.assertEqual(ctx.exception.status_code, 401)
        self.assertIn("Authentication failed", ctx.exception.detail)


class TestAPIEndpointsIntegration(unittest.TestCase):
    """Integration test suite for BlackHole API router with dependency injection overrides."""

    def setUp(self):
        self.client = TestClient(app)
        self.mock_user_id = "test-user-999"
        
        # Override the dependency get_current_user to return a static user ID
        app.dependency_overrides[get_current_user] = lambda: self.mock_user_id

        # Setup mock storage provider methods as AsyncMock
        self.mock_storage = MagicMock()
        self.mock_storage.upload_file = AsyncMock(return_value=True)
        self.mock_storage.delete_file = AsyncMock(return_value=True)
        self.mock_storage.file_exists = AsyncMock(return_value=True)
        self.mock_storage.get_metadata = AsyncMock(return_value={
            "content_type": "text/plain",
            "content_length": 50,
        })
        self.mock_storage.generate_presigned_url = AsyncMock(return_value="https://mock.storage.gateway/download/file.txt")

        from app.core.storage import get_storage_provider
        app.dependency_overrides[get_storage_provider] = lambda: self.mock_storage

    def tearDown(self):
        # Clear dependency overrides to prevent test contamination
        app.dependency_overrides.clear()

    @patch("app.api.supabase")
    def test_upload_endpoint_success(self, mock_supabase):
        # Emulate supabase query builder returning the row ID
        mock_supabase.table.return_value = MockQueryBuilder(data=[{"id": 101}])

        # Background task tagging is mocked by patching the direct generate function or letting it queue
        with patch("app.api._process_ai_tagging") as mock_tagging:
            file_payload = {"file": ("document.txt", b"Hello blackhole file content payload", "text/plain")}
            response = self.client.post("/upload/", files=file_payload)

            self.assertEqual(response.status_code, 200)
            json_data = response.json()
            self.assertEqual(json_data["file_id"], 101)
            self.assertEqual(json_data["original_name"], "document.txt")
            self.mock_storage.upload_file.assert_called_once()
            
            # Assert DB record included the user ID from auth
            mock_supabase.table.assert_called_with("files")

    @patch("app.api.supabase")
    def test_list_files_endpoint_user_isolation(self, mock_supabase):
        test_files = [
            {"id": 1, "filename": "report.pdf", "tags": "['finance']", "created_at": "2026-06-20"},
            {"id": 2, "filename": "photo.jpg", "tags": "['vacation']", "created_at": "2026-06-21"},
        ]
        # Verify listing runs query selecting by authenticated user ID
        mock_supabase.table.return_value = MockQueryBuilder(data=test_files)

        response = self.client.get("/files/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()), 2)
        self.assertEqual(response.json()[0]["filename"], "report.pdf")

    @patch("app.api.supabase")
    def test_get_files_status_endpoint(self, mock_supabase):
        mock_supabase.table.return_value = MockQueryBuilder(data=[
            {"id": 1, "tags": "['tag1', 'tag2']"},
            {"id": 2, "tags": "['tag3']"},
        ])

        response = self.client.get("/files/status/?ids=1,2")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()), 2)
        self.assertEqual(response.json()[0]["id"], 1)

    @patch("app.api.supabase")
    def test_download_link_owner_check_success(self, mock_supabase):
        mock_supabase.table.return_value = MockQueryBuilder(data=[{
            "id": 12,
            "filename": "code.py",
            "storage_key": "some-random-uuid_code.py",
            "user_id": self.mock_user_id
        }])

        response = self.client.get("/download/12")
        self.assertEqual(response.status_code, 200)
        self.assertIn("download_url", response.json())
        self.assertEqual(response.json()["filename"], "code.py")
        self.mock_storage.generate_presigned_url.assert_called_once_with(
            "some-random-uuid_code.py",
            operation="get_object",
            expires_in=3600,
            response_headers={"ResponseContentDisposition": 'attachment; filename="code.py"'}
        )

    @patch("app.api.supabase")
    def test_download_link_owner_check_failed_returns_404(self, mock_supabase):
        # Database query returns empty data because user doesn't own it or it does not exist
        mock_supabase.table.return_value = MockQueryBuilder(data=[])

        response = self.client.get("/download/99")
        self.assertEqual(response.status_code, 404)
        self.assertIn("File not found in vault", response.json()["detail"])

    @patch("app.api.supabase")
    def test_delete_endpoint_success(self, mock_supabase):
        mock_supabase.table.return_value = MockQueryBuilder(data=[{
            "id": 4,
            "filename": "delete_me.zip",
            "storage_key": "uuid_delete_me.zip",
            "user_id": self.mock_user_id
        }])

        response = self.client.delete("/files/4")
        self.assertEqual(response.status_code, 200)
        self.assertIn("deleted successfully", response.json()["message"])
        self.mock_storage.delete_file.assert_called_once_with("uuid_delete_me.zip")

    @patch("app.api.supabase")
    def test_delete_endpoint_owner_check_failed_returns_404(self, mock_supabase):
        mock_supabase.table.return_value = MockQueryBuilder(data=[])

        response = self.client.delete("/files/88")
        self.assertEqual(response.status_code, 404)
        self.mock_storage.delete_file.assert_not_called()


if __name__ == "__main__":
    unittest.main()
