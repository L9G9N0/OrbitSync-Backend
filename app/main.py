from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import router

app = FastAPI(
    title="Blackhole iCloud API", 
    version="1.0.0",
    description="Agentic Cloud Storage Engine"
)

# 🛡️ CORS Middleware: Secure origin configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://frontend-alpha-three-29.vercel.app",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

@app.get("/", tags=["General"])

async def root():
    return {"message": "Welcome to Blackhole API"}

@app.get("/health", tags=["General"])
async def health_check():
    return {"status": "ok"}

app.include_router(router)