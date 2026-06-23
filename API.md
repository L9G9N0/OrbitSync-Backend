# API Documentation: BlackHole Cloud Storage Engine 🌌

This document provides a reference for all API endpoints exposed by the BlackHole backend.

---

## 1. Authentication Requirements

All endpoints (except `/health` and `/`) require an `Authorization` header carrying a valid Supabase JWT Bearer token:

```http
Authorization: Bearer <your_supabase_jwt_token>
```

Failure to provide a valid token returns `401 Unauthorized`.

---

## 2. API Endpoints Reference

### 2.1 Get API Status / Health Checks

#### Root Endpoint
* **Endpoint**: `GET /`
* **Security**: None
* **Response Status**: `200 OK`
* **Response Body**:
```json
{
  "message": "Welcome to Blackhole API"
}
```

#### Health Status
* **Endpoint**: `GET /health`
* **Security**: None
* **Response Status**: `200 OK`
* **Response Body**:
```json
{
  "status": "ok"
}
```

---

### 2.2 Upload File

* **Endpoint**: `POST /upload/`
* **Security**: Bearer JWT Required
* **Content-Type**: `multipart/form-data`
* **Payload**:
  * `file`: Binary file upload parameter.
* **Response Status**: `200 OK`
* **Response Body**:
```json
{
  "message": "Upload successful. AI profiling started in background.",
  "original_name": "quarterly_balance_sheet.pdf",
  "file_id": 26,
  "status": "Processing"
}
```

#### Client Upload Fetch Example:
```javascript
const formData = new FormData();
formData.append('file', fileObject);

const response = await fetch('https://orbitsync-backend.onrender.com/upload/', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + userToken
  },
  body: formData
});
const data = await response.json();
```

---

### 2.3 List User Files

* **Endpoint**: `GET /files/`
* **Security**: Bearer JWT Required
* **Response Status**: `200 OK`
* **Response Body**:
```json
[
  {
    "id": 26,
    "filename": "quarterly_balance_sheet.pdf",
    "tags": "['finance', 'invoice', 'corporate']",
    "created_at": "2026-06-23T11:18:30Z"
  },
  {
    "id": 24,
    "filename": "syllabus_cs310.pdf",
    "tags": "['academics', 'education', 'lecture']",
    "created_at": "2026-06-23T11:14:10Z"
  }
]
```

*Note: The response `tags` field might be returned as a string representation of a Python list (e.g. `"['a', 'b']"`). The client parses this array representation using standard array deserialization fallback routines.*

---

### 2.4 Query File Status (Polling Optimization)

To reduce polling request payload size, this endpoint returns only the tag status of specified comma-separated file IDs:

* **Endpoint**: `GET /files/status/`
* **Security**: Bearer JWT Required
* **Query Parameters**:
  * `ids` (string, required): Comma-separated list of numeric file IDs (e.g. `24,26`).
* **Response Status**: `200 OK`
* **Response Body**:
```json
[
  {
    "id": 24,
    "tags": "['academics', 'education', 'lecture']"
  },
  {
    "id": 26,
    "tags": null
  }
]
```

---

### 2.5 Generate Download Presigned URL

Generates a short-lived S3/Cloudflare R2 download URL that expires automatically in 1 hour (3600 seconds).

* **Endpoint**: `GET /download/{file_id}`
* **Security**: Bearer JWT Required
* **Parameters**:
  * `file_id` (integer, path parameter): The ID of the file to download.
* **Response Status**: `200 OK`
* **Response Body**:
```json
{
  "filename": "quarterly_balance_sheet.pdf",
  "security": "Expires in 1 hour",
  "download_url": "https://pub-your-bucket-id.r2.dev/uuid4-filename?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=..."
}
```

---

### 2.6 Generate Sharing Presigned URL

Generates a configurable secure download URL suitable for external public sharing.

* **Endpoint**: `GET /share/{file_id}`
* **Security**: Bearer JWT Required
* **Parameters**:
  * `file_id` (integer, path parameter): The ID of the file to share.
  * `expiry_minutes` (integer, query parameter, default: `60`): Expiry duration. Must be between `1` and `10080` (7 days).
* **Response Status**: `200 OK`
* **Response Body**:
```json
{
  "filename": "quarterly_balance_sheet.pdf",
  "expires_in_minutes": 120,
  "share_url": "https://pub-your-bucket-id.r2.dev/uuid4-filename?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=..."
}
```

---

### 2.7 Semantic / Text Search

* **Endpoint**: `GET /search/`
* **Security**: Bearer JWT Required
* **Parameters**:
  * `query` (string, query parameter, required): The search string (matched case-insensitively against database tags).
* **Response Status**: `200 OK`
* **Response Body**:
```json
{
  "count": 1,
  "results": [
    {
      "id": 26,
      "filename": "quarterly_balance_sheet.pdf",
      "tags": "['finance', 'invoice', 'corporate']",
      "created_at": "2026-06-23T11:18:30Z"
    }
  ]
}
```

---

### 2.8 Delete File

Deletes the file metadata row from Supabase and removes the binary blob from Cloudflare R2 / MinIO.

* **Endpoint**: `DELETE /files/{file_id}`
* **Security**: Bearer JWT Required
* **Parameters**:
  * `file_id` (integer, path parameter): The ID of the file to delete.
* **Response Status**: `200 OK`
* **Response Body**:
```json
{
  "message": "File 'quarterly_balance_sheet.pdf' deleted successfully."
}
```

---

## 3. Error Responses

All error payloads are returned as standardized JSON objects carrying HTTP exception states:

#### HTTP 401 Unauthorized (Invalid JWT)
```json
{
  "detail": "Authentication failed"
}
```

#### HTTP 404 Not Found (Missing file or row doesn't belong to active user)
```json
{
  "detail": "File not found in vault."
}
```

#### HTTP 400 Bad Request (Expiry parameters out of range)
```json
{
  "detail": "Maximum share duration is 7 days (10080 minutes)."
}
```

#### HTTP 500 Internal Server Error (Database / AI Provider connection issues)
```json
{
  "detail": "Database query failed: {'message': 'connection timed out'}"
}
```
