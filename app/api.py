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


@router.get("/debug/supabase/", tags=["Debug"])
async def debug_supabase():
    try:
        import sys
        import requests
        import urllib.parse
        from app.core.db import get_supabase_client
        from app.core.config import settings

        # 1. Inspect settings values (securely)
        raw_url = settings.SUPABASE_URL
        raw_key = settings.SUPABASE_KEY
        
        parsed_url = urllib.parse.urlparse(raw_url)
        sanitized_url = f"{parsed_url.scheme}://{parsed_url.netloc}"
        
        url_length = len(raw_url) if raw_url else 0
        key_length = len(raw_key) if raw_key else 0
        
        # 2. Inspect active client URL
        try:
            client = get_supabase_client()
            # In supabase-py, supabase_url and postgrest client url are resolved
            client_base_url = getattr(client, "supabase_url", "unknown")
            # Defer to postgrest client
            pg_client = getattr(client, "postgrest", None)
            client_rest_url = getattr(pg_client, "url", "unknown") if pg_client else "unknown"
        except Exception as e:
            client_base_url = f"Error: {str(e)}"
            client_rest_url = f"Error: {str(e)}"
            
        # 3. Direct probe to Supabase API root using requests
        probe_results = {}
        if raw_url and raw_key and "placeholder" not in raw_url.lower():
            # Clean base URL
            import urllib.parse
            parsed_base = urllib.parse.urlparse(raw_url.strip())
            base_url = f"{parsed_base.scheme}://{parsed_base.netloc}"
            
            rest_endpoint = f"{base_url}/rest/v1/"
            headers = {
                "apikey": raw_key,
                "Authorization": f"Bearer {raw_key}"
            }
            
            try:
                resp = requests.get(rest_endpoint, headers=headers, timeout=5)
                probe_results["status_code"] = resp.status_code
                if resp.status_code == 200:
                    spec = resp.json()
                    definitions = spec.get("definitions", {})
                    probe_results["exposed_tables"] = list(definitions.keys())
                    probe_results["info_title"] = spec.get("info", {}).get("title")
                else:
                    probe_results["error_body"] = resp.text[:200]
            except Exception as ex:
                probe_results["request_failed"] = str(ex)

        # 4. Get library versions
        versions = {}
        for pkg in ("supabase", "postgrest", "requests", "fastapi"):
            try:
                import importlib.metadata
                versions[pkg] = importlib.metadata.version(pkg)
            except Exception:
                try:
                    mod = __import__(pkg)
                    versions[pkg] = getattr(mod, "__version__", "unknown")
                except Exception:
                    versions[pkg] = "not installed"

        return {
            "settings_supabase_url": sanitized_url,
            "raw_url_length": url_length,
            "raw_key_length": key_length,
            "client_supabase_url": client_base_url,
            "client_postgrest_url": client_rest_url,
            "probe_results": probe_results,
            "library_versions": versions,
            "python_version": sys.version
        }
    except Exception as e:
        return {"error": f"Debug route failed: {str(e)}"}