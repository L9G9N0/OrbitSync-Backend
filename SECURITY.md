# Security & Policy Reference: BlackHole Cloud Storage Engine 🌌

This document details the security model, ownership isolation policies, and data protection strategies implemented within the BlackHole platform.

---

## 1. Security Architecture Summary

```
                       ┌───────────────────────────┐
                       │  Client Bearer JWT Token  │
                       └─────────────┬─────────────┘
                                     │ Validates signature
                                     ▼
                     ┌──────────────────────────────┐
                     │   FastAPI Gateway Router     │
                     └───────────────┬──────────────┘
                                     │ Resolves owner UID
                                     ▼
            ┌──────────────────────────────────────────────┐
            │        PostgreSQL Row Level Security         │
            │      POLICY "auth.uid() = user_id"           │
            └────────┬──────────────────────────────┬──────┘
                     │                              │
           Approved  ▼                              ▼  Denied (404/Empty)
     ┌────────────────────────┐            ┌──────────────────┐
     │  Object Storage Access │            │  Access Denied   │
     │  S3 Signed HMAC URL    │            │  (HTTP 404 / 401)│
     └────────────────────────┘            └──────────────────┘
```

The system employs a defense-in-depth model:
1. **Transport Layer**: Secure HTTPS channels for all client-to-server communications.
2. **API Gatekeeper**: Authorization header interceptor verifying JWT signatures.
3. **Database Guard**: PostgreSQL Row-Level Security (RLS) policies.
4. **Storage Shield**: Binary obfuscation in storage buckets via UUID keys and expiring signed URLs.

---

## 2. Row-Level Security (RLS) Policies

Row-Level Security is enabled on the PostgreSQL `files` table to enforce data isolation at the database engine level. This ensures that even if a developer writes a database query that omits a `where user_id = ...` filter, PostgreSQL will automatically filter the records:

```sql
-- 1. Enable RLS on the table
ALTER TABLE files ENABLE ROW LEVEL SECURITY;

-- 2. Policy: Authenticated users can insert their own file metadata records
CREATE POLICY "Users can insert their own files" 
ON files FOR INSERT TO authenticated 
WITH CHECK (auth.uid() = user_id);

-- 3. Policy: Authenticated users can view only their own file records
CREATE POLICY "Users can select their own files" 
ON files FOR SELECT TO authenticated 
USING (auth.uid() = user_id);

-- 4. Policy: Authenticated users can update only their own file records (e.g. tags update)
CREATE POLICY "Users can update their own files" 
ON files FOR UPDATE TO authenticated 
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 5. Policy: Authenticated users can delete only their own file records
CREATE POLICY "Users can delete their own files" 
ON files FOR DELETE TO authenticated 
USING (auth.uid() = user_id);
```

---

## 3. API Ownership Isolation

The FastAPI backend gateway validates user identity and blocks cross-tenant access.

### 3.1 Authentication Dependency (`get_current_user`)
The `get_current_user` utility extracts the token and calls the Supabase API to fetch user details.
* Any request lacking the header or carrying an expired/forged signature is rejected immediately with `HTTP 401 Unauthorized`.
* The returned user ID (`user_id`) is injected into endpoints as a dependency.

### 3.2 Access Protection
When retrieving, downloading, sharing, or deleting files, the backend queries the database using both `file_id` and the verified `user_id`:

```python
db_response = supabase.table("files").select("*").eq("id", file_id).eq("user_id", user_id).execute()
if not db_response.data:
    raise HTTPException(status_code=404, detail="File not found in vault.")
```

If another authenticated user (User B) attempts to guess User A's `file_id` and request `/download/{file_id}`, the database query yields an empty dataset. The API returns `404 Not Found` (rather than a `403 Forbidden` which would leak the existence of the resource).

---

## 4. Storage Obfuscation & Presigned URLs

### 4.1 UUID Storage Keys
When a file is uploaded, Uvicorn does not write the file to storage using its original filename (e.g., `tax_document.pdf`). Instead, it generates a unique key combining a random UUID with the filename:

```python
storage_key = f"{uuid.uuid4()}_{file.filename}"
```

This prevents:
1. **Collisions**: Files with identical names do not overwrite each other.
2. **Path Harvesting**: Attackers cannot guess URLs to access files.

### 4.2 HMAC Presigned URLs
Files are kept private within Cloudflare R2 / MinIO. To allow downloads, the API generates a temporary presigned URL carrying an HMAC signature:

* Download URLs expire in **1 hour** (3600 seconds).
* Sharing URLs support dynamically configured expirations up to **7 days** (10080 minutes).
* Once the signature expires, requests to the URL return `HTTP 403 Access Denied`.
