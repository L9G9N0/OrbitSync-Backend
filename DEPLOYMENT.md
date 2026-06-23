# Production Deployment Guide: BlackHole Cloud Storage Engine 🌌

This document details the configuration, build pipelines, and environment setup required to deploy the BlackHole platform in production.

---

## 1. Cloud Infrastructure Overview

BlackHole is designed as a split-stack serverless/managed deployment:
* **Frontend UI**: Deployed on **Vercel** as a static Single Page Application (SPA).
* **Backend API Gateway**: Deployed on **Render** as a Python Web Service.
* **Database & Auth Services**: Managed by **Supabase**.
* **Binary Storage Provider**: **Cloudflare R2** or AWS S3 compatible object storage.

---

## 2. Vercel Frontend Deployment

The React/Vite client is built using `npm run build` and served from Vercel's Edge network.

### 2.1 Frontend Environment Variables (Vercel Dashboard)
Configure the following keys in your Vercel Project Settings:

| Environment Variable | Description | Value Example |
| :--- | :--- | :--- |
| `VITE_API_URL` | The live URL of the Render API gateway | `https://orbitsync-backend.onrender.com` |
| `VITE_SUPABASE_URL` | The Supabase project endpoint URL | `https://mgxymzvveyjnxmbdxtel.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | The Supabase anonymous client-side API key | `eyJhbGciOiJSUzI1NiIsImtpZ...` |

### 2.2 Triggering Vercel Builds
* Automatically builds and deploys on every push to the `main` branch.
* Manually rebuild via the Vercel Dashboard or using `vercel --prod`.

---

## 3. Render Backend Deployment

The backend FastAPI server is hosted on Render as a Python web service, using Uvicorn to run the ASGI application.

### 3.1 Backend Configuration File (`render.yaml`)
The Render blueprint defines the build and start commands:

```yaml
services:
  - type: web
    name: blackhole-backend
    env: python
    buildCommand: pip install -r requirements.txt
    startCommand: uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

### 3.2 Backend Environment Variables (Render Dashboard)
Configure these secrets in the Render environment settings:

| Key | Value Example / Description |
| :--- | :--- |
| `STORAGE_PROVIDER` | `s3` (for Cloudflare R2 / AWS S3) or `local` |
| `API_BASE_URL` | `https://orbitsync-backend.onrender.com` |
| `SUPABASE_URL` | `https://mgxymzvveyjnxmbdxtel.supabase.co` |
| `SUPABASE_KEY` | Supabase Client Key (Anon or Service Role) |
| `GROQ_API_KEY` | `gsk_...` (Groq Cloud LLM API Key) |
| `AWS_ACCESS_KEY_ID` | Cloudflare R2 / S3 client access key |
| `AWS_SECRET_ACCESS_KEY` | Cloudflare R2 / S3 client secret key |
| `S3_BUCKET_NAME` | `blackhole` (Object bucket name) |
| `AWS_REGION` | Cloudflare R2 is region-agnostic (`auto`), S3 e.g., `us-east-1` |

### 3.3 Database Schema Migration Hook
Before running the backend, execute the migrations in [supabase_rls_policies.sql](file:///Users/legend27648/agy-cli-projects/OrbitSync-Backend/migrations/supabase_rls_policies.sql) in your Supabase SQL editor to create the `user_id` column and establish Row-Level Security.

---

## 4. Docker Containerized Deployment

To host the backend API alongside MinIO in a local production environment, use Docker Compose:

```bash
docker compose up -d --build
```

This starts:
1. **API Gateway Service**: Exposes FastAPI on port `8000`.
2. **MinIO Object Storage**: Exposes API on port `9000` and console browser on port `9001`.
3. **Bucket Provisioner**: A helper container that initializes the bucket `blackhole` with public read access.

---

## 5. Troubleshooting & Diagnostics

### 5.1 Local DNS Resolution / Hijacking
* **Problem**: Certain local network DNS servers hijack the Vercel domain (`orbit-sync-backend.vercel.app`), routing requests to Umbrella block pages or returning timeout failures.
* **Fix**: Force the chromium driver or client to route requests directly to Vercel's Anycast IP (`76.76.21.21`).
* **Playwright bypass**:
  ```python
  args=["--host-rules=MAP orbit-sync-backend.vercel.app 76.76.21.21"]
  ```

### 5.2 Supabase Auth Mock TLD Rejection
* **Problem**: Registering users with mock domains (like `@orbitsync.test`) results in `400 Invalid Email` errors due to Supabase Auth validator TLD restrictions.
* **Fix**: Use standard TLD patterns (`@gmail.com` or `@outlook.com`) for test scripts.

### 5.3 Supabase Email Rate Limiting
* **Problem**: Supabase default email SMTP provider limits confirmation messages to 3 per hour.
* **Fix**: Navigate to **Supabase Dashboard -> Auth -> Providers -> Email** and disable the **Confirm Email** toggle. This allows immediate login on user registration without sending validation mail.
