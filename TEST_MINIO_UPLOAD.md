# Test MinIO Presigned Upload

## Quick Test

```bash
# 1. Get auth token (replace with your auth endpoint)
TOKEN="your_jwt_token"

# 2. Request presigned URL
curl -X POST http://localhost:8000/api/v1/files/presign \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "filename": "test.pdf",
    "mime_type": "application/pdf",
    "size": 1024
  }' | jq '.'

# Expected response:
# {
#   "file_id": "some-uuid",
#   "upload_url": "http://minio:9000/signflow-documents/uploads/.../test.pdf?X-Amz-...",
#   "storage_key": "uploads/some-uuid/test.pdf",
#   "expires_in": 900
# }

# 3. Extract upload URL and upload file
UPLOAD_URL="<paste_upload_url_here>"

echo "Test content" > test.pdf

curl -X PUT \
  -H "Content-Type: application/pdf" \
  -T test.pdf \
  "$UPLOAD_URL"

# Expected: Empty response with 200 OK

# 4. Finalize upload (tell backend file is uploaded)
FILE_ID="<paste_file_id_here>"

curl -X POST "http://localhost:8000/api/v1/files/$FILE_ID/finalize" \
  -H "Authorization: Bearer $TOKEN"
```

## Test from Docker

If MinIO endpoint is `minio:9000` (internal Docker network), test from backend container:

```bash
# Get shell in backend container
docker-compose exec backend bash

# Inside container:
TOKEN="your_token"

# Request presigned URL
curl -X POST http://localhost:8000/api/v1/files/presign \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"filename":"test.pdf","mime_type":"application/pdf","size":1024}'

# Upload file using returned URL
UPLOAD_URL="http://minio:9000/signflow-documents/..."
echo "test" > /tmp/test.pdf
curl -X PUT -T /tmp/test.pdf "$UPLOAD_URL"
```

## Verify Upload in MinIO

```bash
# Access MinIO console
open http://localhost:9001

# Login: minioadmin / minioadmin
# Navigate to: signflow-documents bucket
# Look for: uploads/<uuid>/test.pdf
```

## Common Issues

### Issue: `minio:9000` not accessible from host

**Solution:** If testing from your machine (not Docker), replace `minio:9000` with `localhost:9000` in the URL:

```bash
# Original URL:
http://minio:9000/signflow-documents/uploads/...

# Replace with:
http://localhost:9000/signflow-documents/uploads/...
```

### Issue: Signature mismatch

**Cause:** URL was modified or expired (900 seconds = 15 minutes)

**Solution:** Generate a fresh presigned URL

### Issue: Access denied

**Check:**
1. MinIO credentials are correct (MINIO_ACCESS_KEY, MINIO_SECRET_KEY)
2. Bucket exists and is accessible
3. URL hasn't expired

## Environment Variables

Ensure these are set in `docker-compose.yml` or `.env`:

```bash
# Backend needs these:
MINIO_INTERNAL_ENDPOINT=minio:9000
MINIO_PUBLIC_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=signflow-documents
MINIO_SECURE=false
```

## Expected Behavior

1. **Request presigned URL** → Returns URL with signature
2. **Upload file to URL** → MinIO accepts upload (200 OK)
3. **Finalize upload** → Backend marks file as COMPLETED
4. **Check MinIO** → File exists in bucket

---

✅ If all steps work, MinIO presigned upload is functioning correctly!

