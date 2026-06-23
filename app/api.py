import logging
import urllib.parse
import uuid
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, Query, UploadFile, Header
from fastapi.responses import StreamingResponse

from app.core.ai import generate_file_tags
from app.core.db import supabase
from app.core.storage import get_storage_provider

logger = logging.getLogger(__name__)
router = APIRouter()

async def get_current_user(authorization: Optional[str] = Header(None)) -> str:
    """Extract and verify JWT from Authorization header using Supabase Auth."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing Authorization Header")
    
    parts = authorization.split(" ")
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(status_code=401, detail="Invalid Authorization header format. Expected 'Bearer <token>'")
    
    token = parts[1]
    try:
        user_response = supabase.auth.get_user(jwt=token)
        if not user_response or not user_response.user:
            raise HTTPException(status_code=401, detail="Invalid or expired token")
        return user_response.user.id
    except Exception as e:
        logger.error(f"JWT verification failed: {e}")
        raise HTTPException(status_code=401, detail="Authentication failed")


# ─── Background AI Tagging Worker ────────────────────────────────────────────

def _process_ai_tagging(file_id: int, filename: str) -> None:
    """Background task: generate semantic tags and persist them to the database."""
    try:
        ai_result = generate_file_tags(filename)
        tags = ai_result.get("tags", ["untagged"])
        supabase.table("files").update({"tags": str(tags)}).eq("id", file_id).execute()
        logger.info(f"AI tagging complete for file_id={file_id}: {tags}")
    except Exception as e:
        logger.error(f"AI tagging failed for file_id={file_id}: {e}")


# ─── Upload ───────────────────────────────────────────────────────────────────

@router.post("/upload/", tags=["Storage"])
async def upload_to_blackhole(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    user_id: str = Depends(get_current_user),
    storage=Depends(get_storage_provider),
):
    """Upload a file to storage and queue AI semantic tagging."""
    storage_key = f"{uuid.uuid4()}_{file.filename}"

    # 1. Upload binary to storage backend
    try:
        await storage.upload_file(file.file, storage_key, content_type=file.content_type)
    except Exception as e:
        logger.error(f"Storage upload failed: {e}")
        raise HTTPException(status_code=500, detail=f"Storage upload failed: {e}")

    # 2. Persist metadata to Supabase
    try:
        db_response = supabase.table("files").insert({
            "filename": file.filename,
            "storage_key": storage_key,
            "user_id": user_id,
        }).execute()
        new_row_id = db_response.data[0]["id"]
    except Exception as e:
        logger.error(f"Database insert failed: {e}")
        # Best-effort: try to clean up the storage object
        try:
            await storage.delete_file(storage_key)
        except Exception:
            pass
        raise HTTPException(status_code=500, detail=f"Database insert failed: {e}")

    # 3. Queue AI tagging in background
    background_tasks.add_task(_process_ai_tagging, new_row_id, file.filename)

    return {
        "message": "Upload successful. AI profiling started in background.",
        "original_name": file.filename,
        "file_id": new_row_id,
        "status": "Processing",
    }


# ─── Raw File Download (Streaming Proxy) ─────────────────────────────────────

@router.get("/files/download-raw/{storage_key}", tags=["Storage"])
async def download_raw_file(
    storage_key: str,
    filename: Optional[str] = None,
    storage=Depends(get_storage_provider),
):
    """Stream a file directly from storage (no presigned URL required)."""
    try:
        if not await storage.file_exists(storage_key):
            raise HTTPException(status_code=404, detail="File not found in storage.")

        meta = await storage.get_metadata(storage_key)
        content_type = meta.get("content_type", "application/octet-stream")

        if filename:
            safe = urllib.parse.quote(filename)
            disposition = f"attachment; filename*=UTF-8''{safe}"
        else:
            disposition = f'attachment; filename="{storage_key}"'

        return StreamingResponse(
            storage.download_file(storage_key),
            media_type=content_type,
            headers={"Content-Disposition": disposition},
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Download proxy failed: {e}")


# ─── Presigned Download URL ───────────────────────────────────────────────────

@router.get("/download/{file_id}", tags=["Storage"])
async def get_download_link(
    file_id: int,
    user_id: str = Depends(get_current_user),
    storage=Depends(get_storage_provider),
):
    """Generate a short-lived presigned download URL (expires in 1 hour)."""
    try:
        db_response = supabase.table("files").select("*").eq("id", file_id).eq("user_id", user_id).execute()
        if not db_response.data:
            raise HTTPException(status_code=404, detail="File not found in vault.")

        file_data = db_response.data[0]
        storage_key = file_data["storage_key"]
        original_name = file_data["filename"]

        presigned_url = await storage.generate_presigned_url(
            storage_key,
            operation="get_object",
            expires_in=3600,
            response_headers={"ResponseContentDisposition": f'attachment; filename="{original_name}"'},
        )

        return {
            "filename": original_name,
            "security": "Expires in 1 hour",
            "download_url": presigned_url,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate download link: {e}")


# ─── Expiring Share Link ──────────────────────────────────────────────────────

@router.get("/share/{file_id}", tags=["Storage"])
async def create_expiring_share_link(
    file_id: int,
    expiry_minutes: int = 60,
    user_id: str = Depends(get_current_user),
    storage=Depends(get_storage_provider),
):
    """Generate a short-lived presigned share URL with configurable expiry."""
    if expiry_minutes <= 0:
        raise HTTPException(status_code=400, detail="Expiry must be at least 1 minute.")
    if expiry_minutes > 10080:
        raise HTTPException(status_code=400, detail="Maximum share duration is 7 days (10080 minutes).")

    try:
        db_response = supabase.table("files").select("*").eq("id", file_id).eq("user_id", user_id).execute()
        if not db_response.data:
            raise HTTPException(status_code=404, detail="File not found in vault.")

        file_data = db_response.data[0]
        storage_key = file_data["storage_key"]
        original_name = file_data["filename"]

        presigned_url = await storage.generate_presigned_url(
            storage_key,
            operation="get_object",
            expires_in=expiry_minutes * 60,
            response_headers={"ResponseContentDisposition": f'attachment; filename="{original_name}"'},
        )

        return {
            "filename": original_name,
            "expires_in_minutes": expiry_minutes,
            "share_url": presigned_url,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate share link: {e}")


# ─── Search ───────────────────────────────────────────────────────────────────

@router.get("/search/", tags=["Search"])
async def search_vault(
    query: str = Query(..., description="Tag or keyword to search for"),
    user_id: str = Depends(get_current_user),
):
    """Case-insensitive search across file tags using PostgreSQL ILIKE, filtered by user_id."""
    try:
        db_response = (
            supabase.table("files")
            .select("id, filename, tags, created_at")
            .eq("user_id", user_id)
            .ilike("tags", f"%{query}%")
            .execute()
        )
        results = db_response.data or []
        return {"count": len(results), "results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Search failed: {e}")


# ─── List Files ───────────────────────────────────────────────────────────────

@router.get("/files/", tags=["Storage"])
async def list_files(user_id: str = Depends(get_current_user)):
    """Retrieve all file metadata records from Supabase for the authenticated user."""
    try:
        db_response = (
            supabase.table("files")
            .select("id, filename, tags, created_at")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .execute()
        )
        return db_response.data or []
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database query failed: {e}")


# ─── File Tag Status Polling (Optimized Query) ──────────────────────────────

@router.get("/files/status/", tags=["Storage"])
async def get_files_status(
    ids: str = Query(..., description="Comma-separated list of file IDs to query"),
    user_id: str = Depends(get_current_user),
):
    """Retrieve minimal status/tags fields for specific file IDs (reduces client poll payload)."""
    try:
        id_list = [int(x.strip()) for x in ids.split(",") if x.strip().isdigit()]
        if not id_list:
            return []

        db_response = (
            supabase.table("files")
            .select("id, tags")
            .eq("user_id", user_id)
            .in_("id", id_list)
            .execute()
        )
        return db_response.data or []
    except Exception as e:
        logger.error(f"Status check failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch statuses: {e}")


# ─── Delete File ─────────────────────────────────────────────────────────────

@router.delete("/files/{file_id}", tags=["Storage"])
async def delete_file(
    file_id: int,
    user_id: str = Depends(get_current_user),
    storage=Depends(get_storage_provider),
):
    """Delete a file from both storage and the metadata database."""
    try:
        db_response = supabase.table("files").select("*").eq("id", file_id).eq("user_id", user_id).execute()
        if not db_response.data:
            raise HTTPException(status_code=404, detail="File not found in vault.")

        file_data = db_response.data[0]
        storage_key = file_data["storage_key"]

        # Delete from storage backend
        await storage.delete_file(storage_key)

        # Delete metadata record
        supabase.table("files").delete().eq("id", file_id).eq("user_id", user_id).execute()

        return {"message": f"File '{file_data['filename']}' deleted successfully."}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Delete failed: {e}")