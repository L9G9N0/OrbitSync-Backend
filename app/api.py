from fastapi import APIRouter, Depends, UploadFile, File, BackgroundTasks
import uuid
from app.core.storage import get_s3_client
from app.core.config import settings
from app.core.db import supabase
from app.core.ai import generate_file_tags
from fastapi import HTTPException # Ye import top pe add kar lena agar nahi hai toh
from fastapi import Query
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
    s3_client = Depends(get_s3_client)
):
    try:
        unique_file_id = f"{uuid.uuid4()}_{file.filename}"
        
        # 1. Upload to MinIO
        await s3_client.upload_fileobj(
            file.file, 
            settings.R2_BUCKET_NAME, 
            unique_file_id
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

# (Tera purana /download/ wala code yahan same rahega...)
@router.get("/download/{file_id}", tags=["Storage"])
async def get_download_link(
    file_id: int, 
    s3_client = Depends(get_s3_client)
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
        presigned_url = await s3_client.generate_presigned_url(
            'get_object',
            Params={
                'Bucket': settings.R2_BUCKET_NAME,
                'Key': storage_key,
                # Ye header browser ko force karta hai ki wo UUID ki jagah original naam se file download kare
                'ResponseContentDisposition': f'attachment; filename="{original_name}"' 
            },
            ExpiresIn=3600
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
    s3_client = Depends(get_s3_client)
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
        presigned_url = await s3_client.generate_presigned_url(
            'get_object',
            Params={
                'Bucket': settings.R2_BUCKET_NAME,
                'Key': storage_key,
                'ResponseContentDisposition': f'attachment; filename="{original_name}"' 
            },
            ExpiresIn=expiry_seconds
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