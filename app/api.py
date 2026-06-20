from fastapi import APIRouter, Depends, UploadFile, File, BackgroundTasks, HTTPException, Query
from fastapi.responses import StreamingResponse
from typing import Optional
import uuid
from app.core.storage import get_storage_provider
from app.core.config import settings
from app.core.db import supabase
from app.core.ai import generate_file_tags

router = APIRouter()

# Background Worker Function
# Change this function in api.py
def process_ai_tagging(file_id: int, filename: str):
    # AI returns {"tags": ["tag1", "tag2"]}
    ai_result = generate_file_tags(filename)
    
    print(f"🤖 AI JSON Result for '{filename}': {ai_result}")
    
    # Store the JSON string directly into the DB
    supabase.table("files").update({
        "tags": str(ai_result["tags"]) # Storing as text array string for now
    }).eq("id", file_id).execute()


@router.post("/upload/", tags=["Storage"])
async def upload_to_blackhole(
    background_tasks: BackgroundTasks, # 👈 Injecting BackgroundTasks
    file: UploadFile = File(...), 
    storage = Depends(get_storage_provider)
):
    try:
        unique_file_id = f"{uuid.uuid4()}_{file.filename}"
        
        # 1. Upload to MinIO/Storage backend
        await storage.upload_file(
            file.file, 
            unique_file_id,
            content_type=file.content_type
        )
        
        # 2. Insert into Supabase (Initially tags will be NULL)
        metadata = {
            "filename": file.filename,          
            "storage_key": unique_file_id       
        }
        db_response = supabase.table("files").insert(metadata).execute()
        new_row_id = db_response.data[0]['id']
        
        # 3. 🚀 Hand off heavy AI task to the Background Worker
        background_tasks.add_task(process_ai_tagging, new_row_id, file.filename)
        
        # 4. Instantly return success to the user!
        return {
            "message": "Upload successful! AI is organizing your file in the background.", 
            "original_name": file.filename,
            "status": "Processing"
        }
        
    except Exception as e:
        return {"error": f"Failed to upload: {str(e)}"}

@router.get("/files/download-raw/{storage_key}", tags=["Storage"])
async def download_raw_file(
    storage_key: str,
    filename: Optional[str] = None,
    storage = Depends(get_storage_provider)
):
    try:
        if not await storage.file_exists(storage_key):
            raise HTTPException(status_code=404, detail="File not found in storage.")

        meta = await storage.get_metadata(storage_key)
        content_type = meta.get("content_type", "application/octet-stream")

        headers = {}
        if filename:
            import urllib.parse
            # Use RFC 5987 / UTF-8 encoding or safe ASCII filename fallback
            safe_filename = urllib.parse.quote(filename)
            headers["Content-Disposition"] = f"attachment; filename*=UTF-8''{safe_filename}"
        else:
            headers["Content-Disposition"] = f'attachment; filename="{storage_key}"'

        return StreamingResponse(
            storage.download_file(storage_key),
            media_type=content_type,
            headers=headers
        )
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Download proxy failed: {str(e)}")


@router.get("/download/{file_id}", tags=["Storage"])
async def get_download_link(
    file_id: int, 
    storage = Depends(get_storage_provider)
):
    try:
        # Step 1: Database Check (Ledger search)
        # Find the storage_key associated with this ID in Supabase
        db_response = supabase.table("files").select("*").eq("id", file_id).execute()
        
        if not db_response.data:
            return {"error": "File not found in the vault."}
            
        file_data = db_response.data[0]
        storage_key = file_data["storage_key"]
        original_name = file_data["filename"]
        
        # Step 2: Generate the Presigned URL (The Golden Ticket)
        # ExpiresIn=3600 means this link will self-destruct in 1 hour
        presigned_url = await storage.generate_presigned_url(
            storage_key,
            operation='get_object',
            expires_in=3600,
            response_headers={'ResponseContentDisposition': f'attachment; filename="{original_name}"'}
        )
        
        return {
            "message": "Vault accessed successfully",
            "filename": original_name,
            "security": "Link expires in 1 Hour",
            "download_url": presigned_url
        }
        
    except Exception as e:
        return {"error": f"Failed to generate secure link: {str(e)}"}


@router.get("/share/{file_id}", tags=["Storage"])
async def create_expiring_share_link(
    file_id: int, 
    expiry_minutes: int = 60, # Default to 1 hour if user doesn't specify
    storage = Depends(get_storage_provider)
):
    try:
        # 🛡️ SECURITY BOUNDARY CHECK (The 7-Day Limit)
        if expiry_minutes <= 0:
            raise HTTPException(status_code=400, detail="Expiry must be at least 1 minute.")
        if expiry_minutes > 10080: # 7 Days * 24 Hours * 60 Mins
            raise HTTPException(status_code=400, detail="Security protocol limits sharing to a maximum of 7 days (10080 minutes).")

        # 🧮 The Math
        expiry_seconds = expiry_minutes * 60

        # 1. Database Check
        db_response = supabase.table("files").select("*").eq("id", file_id).execute()
        
        if not db_response.data:
            raise HTTPException(status_code=404, detail="File not found in the vault.")
            
        file_data = db_response.data[0]
        storage_key = file_data["storage_key"]
        original_name = file_data["filename"]
        
        # 2. Generate the Dynamic Presigned URL
        presigned_url = await storage.generate_presigned_url(
            storage_key,
            operation='get_object',
            expires_in=expiry_seconds,
            response_headers={'ResponseContentDisposition': f'attachment; filename="{original_name}"'}
        )
        
        return {
            "message": "Secure Share Link Generated",
            "filename": original_name,
            "expires_in_minutes": expiry_minutes,
            "share_url": presigned_url
        }
        
    except HTTPException as he:
        # FastAPI's built-in error handler
        raise he
    except Exception as e:
        return {"error": f"Failed to generate secure link: {str(e)}"}
@router.get("/search/", tags=["Search"])
async def search_vault(
    query: str = Query(..., description="Enter a tag or keyword to search (e.g., 'Microeconomics', 'finance')")
):
    try:
        # Supabase (PostgreSQL) ILIKE query for case-insensitive search inside the tags column
        # %query% means the word can be anywhere inside the tags string
        db_response = supabase.table("files").select("id, filename, tags, created_at").ilike("tags", f"%{query}%").execute()
        
        results = db_response.data
        
        if not results:
            return {"message": f"No files found matching the tag: '{query}'", "count": 0, "results": []}
            
        return {
            "message": "Search complete",
            "count": len(results),
            "results": results
        }
        
    except Exception as e:
        return {"error": f"Search engine failed: {str(e)}"}

@router.get("/files/", tags=["Storage"])
async def list_files():
    """Retrieve all metadata file records from Supabase."""
    try:
        db_response = supabase.table("files").select("id, filename, tags, created_at").execute()
        return db_response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database query failed: {str(e)}")

@router.delete("/files/{file_id}", tags=["Storage"])
async def delete_file(file_id: int, storage = Depends(get_storage_provider)):
    """Delete metadata from Supabase and corresponding binary object from the storage backend."""
    try:
        db_response = supabase.table("files").select("*").eq("id", file_id).execute()
        if not db_response.data:
            raise HTTPException(status_code=404, detail="File not found in vault")
        
        file_data = db_response.data[0]
        storage_key = file_data["storage_key"]
        
        # Delete from storage backend
        await storage.delete_file(storage_key)
        
        # Delete record from database
        supabase.table("files").delete().eq("id", file_id).execute()
        
        return {"message": f"File '{file_data['filename']}' deleted successfully"}
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Delete operation failed: {str(e)}")