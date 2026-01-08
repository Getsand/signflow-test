# ✅ File Upload Flow - FIXED

## What Was Fixed

### 1. **storage.py** - MinIO endpoint handling
- ✅ Renamed `MINIO_INTERNAL_ENDPOINT` → `MINIO_ENDPOINT` (clearer)
- ✅ Added URL rewriting: internal endpoint → public endpoint
- ✅ Backend uses `minio:9000`, clients get `localhost:9000`
- ✅ Added proper error handling in bucket creation

**Key change:**
```python
# Generate URL with internal endpoint
url = minio_client.presigned_put_object(bucket, object_name, expires)

# Replace with public endpoint for client
parsed = urlparse(url)
public_url = urlunparse(parsed._replace(netloc=MINIO_PUBLIC_ENDPOINT))
```

### 2. **repo.py** - Database operations
- ✅ Removed duplicate `create_file` method (was defined twice!)
- ✅ Clean separation: DB operations only
- ✅ Proper bucket parameter validation

### 3. **service.py** - Business logic
- ✅ Fixed `MINIO_BUCKET` always passed to create_file
- ✅ Fixed `stat_object` call - uses `file_obj.bucket` not `_base_url.bucket`
- ✅ Added proper error handling with specific messages
- ✅ Returns file_id in presign response
- ✅ Marks failed on errors
- ✅ Handles already-completed uploads

**Key changes:**
```python
# BEFORE (BROKEN)
stat = self.minio.stat_object(
    bucket_name=self.minio._base_url.bucket or "signflow-documents",  # ❌ WRONG
    object_name=file_obj.storage_key,
)

# AFTER (FIXED)
stat = self.minio.stat_object(
    bucket_name=file_obj.bucket,  # ✅ Use DB bucket field
    object_name=file_obj.storage_key,
)
```

### 4. **schemas.py** - Request/response models
- ✅ Removed duplicate schemas (FilePresignRequest, FileRead, etc.)
- ✅ Added `file_id` to PresignResponse
- ✅ Added validation constraints (max 10MB, filename length)
- ✅ Clear docstrings

### 5. **router.py** - HTTP endpoints
- ✅ Better error handling (400, 404, 500 with specific messages)
- ✅ Added endpoint documentation
- ✅ Proper HTTP status codes
- ✅ Distinguishes not-found from bad-request errors

### 6. **models.py** - No changes needed
- ✅ Already correct with nullable bucket field

---

## Architecture (Clean Separation)

```
┌─────────────────────────────────────────────────────┐
│ router.py                                           │
│ - HTTP request/response                             │
│ - Auth (JWT)                                        │
│ - Error → HTTP status codes                        │
└────────────────────┬────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────┐
│ service.py                                          │
│ - Business logic                                    │
│ - Validation (size, mime type)                     │
│ - Orchestration (repo + storage)                   │
└────────────┬──────────────────────┬─────────────────┘
             │                      │
             ▼                      ▼
┌────────────────────┐    ┌──────────────────────────┐
│ repo.py            │    │ storage.py               │
│ - DB operations    │    │ - MinIO SDK calls        │
│ - SQLAlchemy       │    │ - Presigned URL gen      │
└────────────────────┘    │ - Endpoint rewriting     │
                          └──────────────────────────┘
```

---

## Environment Variables

Add to `docker-compose.yml` backend service:

```yaml
environment:
  # MinIO endpoints
  MINIO_ENDPOINT: "minio:9000"              # Backend → MinIO
  MINIO_PUBLIC_ENDPOINT: "localhost:9000"  # Client → MinIO
  
  # MinIO credentials
  MINIO_ACCESS_KEY: "minioadmin"
  MINIO_SECRET_KEY: "minioadmin"
  MINIO_BUCKET: "signflow-documents"
  MINIO_SECURE: "false"
```

---

## Complete Test Flow

### Prerequisites
```bash
# Ensure services are running
docker-compose up -d

# Check health
docker-compose ps
```

### STEP 1: Login (Get JWT token)

```bash
# Register or login
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }'

# Save token
export TOKEN="eyJhbGc..."
```

### STEP 2: Request Presigned URL

```bash
curl -X POST http://localhost:8000/api/v1/files/presign \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "filename": "document.pdf",
    "mime_type": "application/pdf",
    "size": 102400
  }' | jq '.'
```

**Expected response:**
```json
{
  "file_id": "550e8400-e29b-41d4-a716-446655440000",
  "upload_url": "http://localhost:9000/signflow-documents/uploads/550e.../document.pdf?X-Amz-Algorithm=...",
  "storage_key": "uploads/550e8400-e29b-41d4-a716-446655440000/document.pdf",
  "expires_in": 900
}
```

**✅ CHECK:** URL contains `localhost:9000` NOT `minio:9000`

### STEP 3: Upload File

```bash
# Save file_id and upload_url from response
export FILE_ID="550e8400-e29b-41d4-a716-446655440000"
export UPLOAD_URL="http://localhost:9000/signflow-documents/uploads/..."

# Create test file
echo "Test PDF content" > test.pdf

# Upload using presigned URL
curl -X PUT \
  -H "Content-Type: application/pdf" \
  --data-binary "@test.pdf" \
  "$UPLOAD_URL"
```

**Expected:** Empty response with HTTP 200

**✅ CHECK:** No `SignatureDoesNotMatch` error

### STEP 4: Finalize Upload

```bash
curl -X POST "http://localhost:8000/api/v1/files/$FILE_ID/finalize" \
  -H "Authorization: Bearer $TOKEN" | jq '.'
```

**Expected response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "filename": "document.pdf",
  "mime_type": "application/pdf",
  "size": 18,
  "status": "COMPLETED"
}
```

**✅ CHECK:** Status is `COMPLETED`, size is set

### STEP 5: Verify in MinIO

```bash
# Access MinIO console
open http://localhost:9001

# Login: minioadmin / minioadmin
# Navigate to: signflow-documents bucket
# Check: uploads/<file_id>/document.pdf exists
```

---

## Error Scenarios (All Fixed)

### ❌ Before: SignatureDoesNotMatch
**Cause:** Presigned URL generated with `minio:9000` but client tried to access it from outside Docker

**Fix:** URL rewriting in `storage.py` replaces internal endpoint with public endpoint

### ❌ Before: bucket NULL constraint violation
**Cause:** `bucket` not passed to `create_file`

**Fix:** `service.py` always passes `MINIO_BUCKET`

### ❌ Before: stat_object crashes
**Cause:** Incorrect `bucket_name=self.minio._base_url.bucket`

**Fix:** Use `bucket_name=file_obj.bucket` from DB

### ❌ Before: expires.total_seconds error
**Cause:** Passing `expires_seconds: int` instead of `timedelta`

**Fix:** Always use `timedelta(seconds=900)`

---

## API Endpoints

### POST /api/v1/files/presign
**Auth:** Required (JWT)  
**Request:**
```json
{
  "filename": "document.pdf",
  "mime_type": "application/pdf",
  "size": 102400
}
```

**Response:** 200 OK
```json
{
  "file_id": "uuid",
  "upload_url": "http://localhost:9000/...",
  "storage_key": "uploads/uuid/document.pdf",
  "expires_in": 900
}
```

**Errors:**
- `400` - Invalid size or unsupported mime type
- `401` - Unauthorized
- `500` - Storage error

### POST /api/v1/files/{file_id}/finalize
**Auth:** Required (JWT)  
**Response:** 200 OK
```json
{
  "id": "uuid",
  "filename": "document.pdf",
  "mime_type": "application/pdf",
  "size": 102400,
  "status": "COMPLETED"
}
```

**Errors:**
- `400` - Upload already failed
- `404` - File not found or access denied
- `500` - Storage verification error

---

## Production Checklist

✅ No Docker internal hostnames in URLs  
✅ Proper error messages (not generic)  
✅ Bucket always set (no NULL constraint violations)  
✅ Idempotent finalize (safe to call multiple times)  
✅ Failed uploads marked in DB  
✅ MinIO SDK used correctly (no boto3)  
✅ Expires as timedelta (not int)  
✅ Clean separation of concerns  
✅ No commented code  
✅ No duplicate methods  

---

## Files Modified Summary

| File | Changes | Why |
|------|---------|-----|
| `storage.py` | URL rewriting, endpoint naming | Fix `minio:9000` in URLs |
| `service.py` | bucket handling, stat_object, errors | Fix NULL bucket, crashes |
| `repo.py` | Remove duplicate method | Clean code |
| `schemas.py` | Remove duplicates, add file_id | Clean API |
| `router.py` | Better error handling | Proper HTTP codes |
| `models.py` | No changes | Already correct |

---

**Status:** ✅ PRODUCTION-READY

Upload flow is now:
- Stable
- Secure
- Boring (in a good way)
- Ready for scale

