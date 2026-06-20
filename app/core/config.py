import os
from pathlib import Path
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict

# Automatically locate the root folder where .env is stored
ROOT_DIR = Path(__file__).resolve().parent.parent.parent
ENV_FILE_PATH = ROOT_DIR / ".env"

class Settings(BaseSettings):
    # Active Storage Provider
    STORAGE_PROVIDER: str = "local" # 'minio', 's3', or 'local'
    LOCAL_STORAGE_DIR: str = "./local_vault_storage"

    # MinIO Credentials & Mappings
    MINIO_ENDPOINT: str = "localhost"
    MINIO_PORT: int = 9000
    MINIO_ACCESS_KEY: str = "minioadmin"
    MINIO_SECRET_KEY: str = "minioadmin"
    MINIO_BUCKET: str = "blackhole"
    MINIO_SECURE: bool = False
    MINIO_PUBLIC_URL: Optional[str] = None # Exposed URL to re-route browser presigned requests

    # AWS S3 Configuration (Fallback/Future)
    AWS_ACCESS_KEY_ID: Optional[str] = None
    AWS_SECRET_ACCESS_KEY: Optional[str] = None
    S3_BUCKET_NAME: Optional[str] = None
    AWS_REGION: str = "us-east-1"

    # Supabase Metadata
    SUPABASE_URL: str = "https://placeholder-project.supabase.co"
    SUPABASE_KEY: str = "placeholder-anon-key"

    # Groq AI
    GROQ_API_KEY: str = "placeholder-groq-key"

    # API and Frontend URLs
    API_BASE_URL: str = "http://localhost:8000"
    FRONTEND_URL: str = "http://localhost:5173"

    model_config = SettingsConfigDict(env_file=str(ENV_FILE_PATH), extra="ignore")


settings = Settings()

class ConfigurationError(ValueError):
    """Raised when environment variables are missing or incorrectly configured."""
    pass

def check_env_vars():
    import logging
    logger = logging.getLogger("ConfigurationAudit")
    warnings = []
    errors = []
    
    # 1. Check Supabase
    url = settings.SUPABASE_URL
    key = settings.SUPABASE_KEY
    if not url or "placeholder" in url.lower() or url == "https://placeholder-project.supabase.co":
        errors.append("SUPABASE_URL is missing or contains placeholder values.")
    elif not url.startswith("http://") and not url.startswith("https://"):
        errors.append("SUPABASE_URL is invalid (must start with http:// or https://).")
        
    if not key or "placeholder" in key.lower() or key == "placeholder-anon-key":
        errors.append("SUPABASE_KEY is missing or contains placeholder values.")
        
    # 2. Check Groq
    groq_key = settings.GROQ_API_KEY
    if not groq_key or "placeholder" in groq_key.lower() or groq_key == "placeholder-groq-key":
        warnings.append("GROQ_API_KEY is missing or contains placeholder values. AI auto-tagging will fallback to 'untagged'.")
        
    # 3. Check Storage Provider
    prov = settings.STORAGE_PROVIDER
    if prov == "minio":
        if settings.MINIO_ENDPOINT == "localhost":
            warnings.append("STORAGE_PROVIDER is set to minio but MINIO_ENDPOINT is localhost. This will fail in production.")
    elif prov == "s3":
        if not settings.AWS_ACCESS_KEY_ID or not settings.AWS_SECRET_ACCESS_KEY or not settings.S3_BUCKET_NAME:
            errors.append("STORAGE_PROVIDER is set to s3 but AWS/S3 credentials are not fully configured.")
            
    if errors:
        logger.error("❌ PRODUCTION CONFIGURATION ERRORS DETECTED:")
        for err in errors:
            logger.error(f"  - {err}")
        logger.error("The application will start, but endpoints relying on these services will fail until configured.")
    else:
        logger.info("✅ Core configuration parsed successfully.")
        
    if warnings:
        logger.warning("⚠️ CONFIGURATION WARNINGS DETECTED:")
        for warn in warnings:
            logger.warning(f"  - {warn}")

    return len(errors) == 0