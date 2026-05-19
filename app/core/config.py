import os
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

# Automatically locate the root folder where .env is stored
# config.py is in app/core/ -> parent is app/ -> parent is OrbitSync-Backend/
ROOT_DIR = Path(__file__).resolve().parent.parent.parent
ENV_FILE_PATH = ROOT_DIR / ".env"

class Settings(BaseSettings):
    R2_BUCKET_NAME: str
    R2_ACCESS_KEY_ID: str
    R2_SECRET_ACCESS_KEY: str
    R2_ENDPOINT_URL: str
    SUPABASE_URL: str
    SUPABASE_KEY: str
    GROQ_API_KEY: str

    # Explicitly telling Pydantic the exact absolute path of .env
    model_config = SettingsConfigDict(env_file=str(ENV_FILE_PATH), extra="ignore")

settings = Settings()