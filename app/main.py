from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import router

app = FastAPI(
    title="Blackhole iCloud API", 
    version="1.0.0",
    description="Agentic Cloud Storage Engine"
)

# 🛡️ CORS Middleware: Frontend ko Backend se baat karne ki permission
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Development ke liye sab allow kar rahe hain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)