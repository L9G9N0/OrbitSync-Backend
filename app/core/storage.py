import aioboto3
from app.core.config import settings

# Aioboto3 ka session initialize kiya
session = aioboto3.Session()

# FastAPI Dependency to get Cloud Client
async def get_s3_client():
    async with session.client(
        's3',
        endpoint_url=settings.R2_ENDPOINT_URL,
        aws_access_key_id=settings.R2_ACCESS_KEY_ID,
        aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
        region_name="auto"  # MinIO/R2 usually require a default region string
    ) as client:
        yield client