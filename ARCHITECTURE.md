# Architecture & Design Document: BlackHole Cloud Storage Engine 🌌

This document provides a comprehensive technical overview of the architecture, design patterns, and system interactions within the **BlackHole** (formerly OrbitSync) platform.

---

## 1. System Overview

BlackHole is an intelligent, zero-friction, cloud-native file storage system that auto-profiles uploaded content using Large Language Models (LLMs) and secures metadata at the database layer using Row-Level Security (RLS) policies.

```mermaid
graph TD
    subgraph Client Layer [Client Application Layer]
        FE[React/Vite Frontend]
        SD[Python Sync Daemon]
    end

    subgraph Gateway Layer [API Gateway Layer]
        API[FastAPI Backend Web Server]
        StorageLocal[Local File Storage Emulator]
    end

    subgraph External Cloud Services [Cloud & Security Infrastructure]
        Auth[Supabase Auth Services]
        DB[Supabase Postgres DB & RLS]
        R2[Cloudflare R2 / MinIO Object Storage]
        Groq[Groq AI Cloud Llama 3.3]
    end

    FE -->|Client-side Auth/Login| Auth
    FE -->|API Queries / Upload / Share / Search / Delete| API
    SD -->|CLI Directory Monitoring / Auto-Upload| API
    SD -->|CLI Authentication Session| Auth
    
    API -->|Metadata DB Checks & Queries| DB
    API -->|Session JWT User ID Verification| Auth
    API -->|Queue AI Semantic profiling| Groq
    
    API -->|MinIO SDK / S3 Client Blob Storage| R2
    API -->|Emulator file storage fallback| StorageLocal
```

---

## 2. Component Design & Responsibilities

### 2.1 React/Vite Client
* **Role**: Single Page Application (SPA) serving as the user dashboard interface.
* **Technology**: TypeScript, React, Vite, Framer Motion (visual micro-animations), Tailwind CSS (styling), Lucide React (icons), and TanStack Query (caching state management).
* **Responsibilities**:
  * User authentication (sign-up, login, logout, and session persistence).
  * Direct binary upload tracking with interactive progress bars (XHR).
  * Direct retrieval of direct S3 presigned URLs for secure downloading.
  * Real-time polling status visualization for AI background profiling.
  * Accessibility (focus traps on modal Dialog overlays, keybindings, and semantic HTML structure).

### 2.2 Python watchdog Sync Daemon
* **Role**: Zero-friction background observer executing in the user's local operating system.
* **Technology**: Python, watchdog, requests, and Supabase client library.
* **Responsibilities**:
  * Watches a configured local directory (`~/BlackHole_Sync`) for file additions.
  * Automatically signs in to Supabase Auth using locally configured credentials.
  * Performs chunked multipart uploads to the FastAPI server, carrying the active JWT Bearer token in the `Authorization` header.

### 2.3 FastAPI Application Server
* **Role**: High-performance backend gateway mediating between storage, AI profiling, and database ledgers.
* **Technology**: Python, FastAPI, Uvicorn, Pydantic, and Boto3 (AWS SDK).
* **Responsibilities**:
  * JWT verification and user isolation enforcing.
  * Multi-provider storage client mapping (Local, MinIO, or S3/Cloudflare R2).
  * Asynchronous background worker spawning for AI profiling via the Groq SDK.
  * Database transaction mediation with the Supabase PostgREST Client.

### 2.4 Supabase Auth & Postgres Database
* **Role**: Identity provider and transactional relational database ledger.
* **Technology**: Supabase Auth (GoTrue API) and PostgreSQL.
* **Responsibilities**:
  * Enforces Row-Level Security (RLS) on metadata tables.
  * Restricts select, insert, update, and delete actions directly to the owner whose `user_id` matches `auth.uid()`.
  * Persists file records containing `id` (primary key), `filename`, `storage_key` (UUID mapping), `tags` (JSON text array), and `created_at`.

### 2.5 Object Storage Services
* **Role**: Object store hosting binary assets.
* **Technology**: Cloudflare R2 (S3-compatible API), MinIO (local storage emulator), or Local File System provider.
* **Responsibilities**:
  * Stores binaries under random UUID keys to prevent file path discovery attacks.
  * Serves short-lived presigned URLs for secure downloading and sharing.

---

## 3. Core Pipelines and Flows

### 3.1 Authentication & Request Lifecycle Flow
Each protected request carries a JWT header. The FastAPI server validates this against Supabase Auth:

```mermaid
sequenceDiagram
    autonumber
    actor User as Client UI
    participant API as FastAPI Backend
    participant Auth as Supabase Auth (JWT Check)
    participant DB as Supabase DB (Postgres RLS)

    User->>API: HTTP Request + Header [Authorization: Bearer <JWT>]
    API->>API: Extract JWT from Header
    API->>Auth: supabase.auth.get_user(jwt)
    alt Invalid or Expired Token
        Auth-->>API: Exception (Token Expired)
        API-->>User: HTTP 401 Unauthorized
    else Valid Token
        Auth-->>API: Return User Profile (ID: user-abc-123)
        API->>API: Inject User ID into Dependency injection context
        API->>DB: Perform PostgreSQL action (where user_id = 'user-abc-123')
        DB->>DB: Evaluate RLS policy (auth.uid() = user_id)
        alt RLS Denied
            DB-->>API: Error (Postgres RLS Violation / Access Denied)
            API-->>User: HTTP 404 (File Not Found / Hidden)
        else RLS Approved
            DB-->>API: Return Row Data
            API-->>User: HTTP 200 (Success payload)
        end
    end
```

---

### 3.2 Multipart Upload & AI Auto-Profiling Pipeline
To provide zero-friction organization, file uploads immediately return success, leaving heavy AI tagging to background worker threads:

```mermaid
sequenceDiagram
    autonumber
    actor User as Client UI
    participant API as FastAPI Backend
    participant Storage as Object Storage (R2/MinIO)
    participant DB as Supabase Postgres
    participant Groq as Groq AI Cloud

    User->>API: POST /upload/ (file binary, Content-Type: multipart/form-data)
    Note over API: Generate unique storage UUID key
    API->>Storage: upload_file() stream binary chunk
    Storage-->>API: Confirm upload saved
    API->>DB: INSERT into files table (filename, storage_key, user_id, tags=[])
    DB-->>API: Return row ID (e.g. 101)
    
    # Non-blocking Handoff
    API-->>User: HTTP 200 {"message": "Success", "file_id": 101, "status": "Processing"}
    Note over User: Frontend displays visual brain scanner scanning
    
    # Asynchronous worker processing
    Note over API: Spawn FastAPI BackgroundTask: _process_ai_tagging(101, filename)
    API->>Groq: Query Model (llama-3.3-70b-versatile) with filename
    Groq-->>API: Return tags list JSON (e.g. ["microeconomics", "syllabus"])
    API->>DB: UPDATE files table SET tags = '["microeconomics", "syllabus"]' where id = 101
    
    loop Real-time Polling
        User->>API: GET /files/status/?ids=101
        API->>DB: SELECT tags from files where id = 101
        DB-->>API: Return tags
        API-->>User: HTTP 200 [{"id": 101, "tags": ["microeconomics", "syllabus"]}]
        Note over User: Card transitions to "Tagged" status and shows labels
    end
```

---

### 3.3 Secure Expiring Sharing Flow
BlackHole generates secure, expiring URL links. Storage blobs are never exposed directly:

```mermaid
sequenceDiagram
    autonumber
    actor User as Owner UI
    participant API as FastAPI Backend
    participant DB as Supabase DB
    participant Storage as Object Storage (R2/MinIO)
    actor SharedUser as External Visitor

    User->>API: GET /share/101?expiry_minutes=120
    API->>DB: Fetch record where id=101 and user_id=owner_uid
    alt Unauthorized / Not Owned
        DB-->>API: Empty Row
        API-->>User: HTTP 404 Not Found
    else Authorized Owner
        DB-->>API: Return record (storage_key)
        API->>Storage: generate_presigned_url(storage_key, expires_in=7200)
        Storage-->>API: Return signed S3 URL with HMAC signature
        API-->>User: HTTP 200 {"share_url": "https://r2.gateway/..."}
        User->>User: Copy link to clipboard
    end
    
    # Visitor attempts access
    SharedUser->>Storage: GET presigned URL
    alt URL expired or Signature tampered
        Storage-->>SharedUser: HTTP 403 Access Denied
    else URL active
        Storage-->>SharedUser: Stream file binary download
    end
```

---

## 4. Architectural Patterns & Clean Code Design

### 4.1 Repository/Provider Pattern for Storage
The system abstracts the storage provider through a base interface (`StorageProvider`), allowing the platform to shift backends seamlessly without changing route handlers:

```
[FastAPI Router (app/api.py)]
            │
            ▼ depends on
   [StorageProvider (app/core/storage/base.py)]
            │
            ├─► LocalProvider (app/core/storage/local_provider.py) ──► Local Disk Emulator
            ├─► MinIOProvider (app/core/storage/minio_provider.py) ──► Local Container S3
            └─► S3Provider (app/core/storage/s3_provider.py)      ──► Production Cloudflare R2 / AWS S3
```

### 4.2 Lazy Connection Proxy
To avoid startup validation delays (which cause Render deployments to time out during health checks), external dependencies like Supabase client are wrapped in a proxy client pattern:
* Initial app start runs instantly and registers a `/health` endpoint.
* When the first transactional endpoint `/files/` is requested, the client initialization is triggered, validating environment credentials lazily.
