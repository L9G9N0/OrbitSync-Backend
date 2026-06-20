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
    """Runtime forensics: show the exact URL the Supabase SDK will use to query Postgres."""
    try:
        import sys
        import httpx
        import urllib.parse
        import importlib.metadata
        from app.core.db import get_supabase_client
        from app.core.config import settings

        # 1. Raw settings
        raw_url = settings.SUPABASE_URL
        raw_key = settings.SUPABASE_KEY

        parsed_url = urllib.parse.urlparse(raw_url)
        sanitized_url = f"{parsed_url.scheme}://{parsed_url.netloc}"
        raw_path_suffix = parsed_url.path  # shows /rest/v1 if it was in the env var

        rest_v1_in_raw = "/rest/v1" in raw_url if raw_url else False
        trailing_slash = raw_url.endswith("/") if raw_url else False

        # 2. What URL does the live SDK client actually use?
        client_base_url = "not_initialized"
        client_rest_url = "not_initialized"
        client_files_url = "not_initialized"
        try:
            client = get_supabase_client()
            client_base_url = str(getattr(client, "supabase_url", "missing"))
            pg = getattr(client, "postgrest", None)
            # supabase-py >= 2.x stores it as base_url (yarl URL object)
            if pg:
                _base = getattr(pg, "base_url", None)
                client_rest_url = str(_base) if _base is not None else "attr_missing"
            else:
                client_rest_url = "no_postgrest_attr"
            client_files_url = f"{client_rest_url}files" if client_rest_url not in ("not_initialized", "no_postgrest_attr", "attr_missing") else "cannot_determine"
        except Exception as e:
            client_base_url = f"init_error: {str(e)}"
            client_rest_url = f"init_error: {str(e)}"

        # 3. Direct HTTP probe with httpx (requests not installed on Render)
        probe_results: dict = {}
        if raw_url and raw_key and "placeholder" not in raw_url.lower():
            base_url = sanitized_url
            headers = {"apikey": raw_key, "Authorization": f"Bearer {raw_key}"}

            # 3a. Probe PostgREST root (returns OpenAPI schema listing tables)
            rest_root = f"{base_url}/rest/v1/"
            probe_results["rest_root_probed"] = rest_root
            try:
                async with httpx.AsyncClient(timeout=10) as hc:
                    r = await hc.get(rest_root, headers=headers)
                    probe_results["rest_root_status"] = r.status_code
                    if r.status_code == 200:
                        spec = r.json()
                        probe_results["exposed_tables"] = list(spec.get("definitions", {}).keys())
                    else:
                        probe_results["rest_root_error_body"] = r.text[:500]
            except Exception as ex:
                probe_results["rest_root_exception"] = str(ex)

            # 3b. Probe /files table directly
            files_url = f"{base_url}/rest/v1/files"
            probe_results["files_table_probed"] = files_url
            try:
                async with httpx.AsyncClient(timeout=10) as hc:
                    r2 = await hc.get(files_url, headers={**headers, "Accept": "application/json"})
                    probe_results["files_table_status"] = r2.status_code
                    probe_results["files_table_body"] = r2.text[:500]
            except Exception as ex2:
                probe_results["files_table_exception"] = str(ex2)

        # 4. Library versions
        versions = {}
        for pkg in ("supabase", "postgrest", "httpx", "fastapi"):
            try:
                versions[pkg] = importlib.metadata.version(pkg)
            except Exception:
                versions[pkg] = "not_installed"

        return {
            "commit_check": "aeed3ce",  # expected latest commit
            "raw_url_length": len(raw_url) if raw_url else 0,
            "raw_url_path_suffix": raw_path_suffix,
            "rest_v1_in_raw_url": rest_v1_in_raw,
            "trailing_slash_in_raw_url": trailing_slash,
            "settings_supabase_url_sanitized": sanitized_url,
            "raw_key_length": len(raw_key) if raw_key else 0,
            "sdk_client_supabase_url": client_base_url,
            "sdk_client_postgrest_base_url": client_rest_url,
            "sdk_will_query_files_at": client_files_url,
            "probe_results": probe_results,
            "library_versions": versions,
            "python_version": sys.version,
        }
    except Exception as e:
        import traceback
        return {"error": f"Debug route failed: {str(e)}", "traceback": traceback.format_exc()}