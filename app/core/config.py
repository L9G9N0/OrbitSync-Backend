import os
from pathlib import Path
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict

# Automatically locate the root folder where .env is stored
ROOT_DIR = Path(__file__).resolve().parent.parent.parent
ENV_FILE_PATH = ROOT_DIR / ".env"

class Settings(BaseSettings):
    # Active Storage Provider
    STORAGE_PROVIDER: str = "minio" # 'minio', 's3', or 'local'
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

    model_config = SettingsConfigDict(env_file=str(ENV_FILE_PATH), extra="ignore")

settings = Settings()