# ✅ Working File Upload Solution

## Problem
S3/MinIO signatures include the hostname, so URL rewriting breaks signatures.

## Solution
Use the same hostname from both inside and outside Docker.

---

## OPTION 1: Test from Inside Docker (Easiest)

This works immediately without any configuration changes.

### Step 1: Enter Backend Container
```bash
docker-compose exec backend bash
```

### Step 2: Run Tests Inside Container
```bash
# Login
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"newuser@example.com","password":"password123"}' \
  | jq -r '.access_token')

echo "Token: $TOKEN"

# Presign
RESPONSE=$(curl -s -X POST http://localhost:8000/api/v1/files/presign \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"filename":"test.pdf","mime_type":"application/pdf","size":1024}')

echo $RESPONSE | jq '.'

FILE_ID=$(echo $RESPONSE | jq -r '.file_id')
UPLOAD_URL=$(echo $RESPONSE | jq -r '.upload_url')

echo "File ID: $FILE_ID"
echo "Upload URL: $UPLOAD_URL"

# Upload (minio:9000 works inside Docker)
echo "Hello SignFlow" > test.pdf
curl -X PUT -H "Content-Type: application/pdf" --data-binary "@test.pdf" "$UPLOAD_URL"

# Should return: Empty response with HTTP 200 ✅

# Finalize
curl -X POST "http://localhost:8000/api/v1/files/$FILE_ID/finalize" \
  -H "Authorization: Bearer $TOKEN" | jq '.'

# Should return: {"status":"COMPLETED",...} ✅
```

**This WILL work** because inside Docker, `minio:9000` resolves correctly.

---

## OPTION 2: Make it Work from Host Machine

Add `minio` to your hosts file so your machine can resolve it.

### Windows
1. Open Notepad as Administrator
2. Open: `C:\Windows\System32\drivers\etc\hosts`
3. Add this line:
   ```
   127.0.0.1  minio
   ```
4. Save and close

### Linux/Mac
```bash
sudo nano /etc/hosts
```
Add this line:
```
127.0.0.1  minio
```
Save with Ctrl+X, Y, Enter

### Update Environment Variables
In `docker-compose.yml`, backend service:
```yaml
environment:
  MINIO_INTERNAL_ENDPOINT: "minio:9000"
  MINIO_PUBLIC_ENDPOINT: "minio:9000"  # Both same!
```

### Restart
```bash
docker-compose down
docker-compose up -d
```

### Test from Host
```bash
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"newuser@example.com","password":"password123"}' \
  | jq -r '.access_token')

RESPONSE=$(curl -s -X POST http://localhost:8000/api/v1/files/presign \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"filename":"test.pdf","mime_type":"application/pdf","size":1024}')

FILE_ID=$(echo $RESPONSE | jq -r '.file_id')
UPLOAD_URL=$(echo $RESPONSE | jq -r '.upload_url')

echo "test" > test.pdf
curl -X PUT -H "Content-Type: application/pdf" --data-binary "@test.pdf" "$UPLOAD_URL"

curl -X POST "http://localhost:8000/api/v1/files/$FILE_ID/finalize" \
  -H "Authorization: Bearer $TOKEN" | jq '.'
```

Now `minio:9000` works from both inside and outside Docker! ✅

---

## OPTION 3: Production Setup

In production, use a real domain:

```yaml
environment:
  MINIO_INTERNAL_ENDPOINT: "s3.yourdomain.com"
  MINIO_PUBLIC_ENDPOINT: "s3.yourdomain.com"
```

Or use AWS S3:
```yaml
environment:
  MINIO_INTERNAL_ENDPOINT: "s3.amazonaws.com"
  MINIO_PUBLIC_ENDPOINT: "s3.amazonaws.com"
```

---

## Verification Checklist

After running tests:

✅ No `SignatureDoesNotMatch` errors  
✅ No `Failed to generate upload URL` errors  
✅ No `bucket is null` errors  
✅ Upload returns HTTP 200  
✅ Finalize returns `status: "COMPLETED"`  
✅ File visible in MinIO at http://localhost:9001  

---

## Why This Works

**The Issue:**
- S3/MinIO signatures include the Host header
- Changing hostname breaks the signature
- `minio:9000` → `localhost:9000` = Invalid signature

**The Fix:**
- Use ONE hostname everywhere
- Make it resolvable from both contexts
- Inside Docker: Works via Docker DNS
- Outside Docker: Works via hosts file

**Result:**
- Signature generated for `minio:9000`
- Client accesses `minio:9000`
- Signatures match ✅

---

## Quick Debug

If you still get errors:

```bash
# Check MinIO is running
curl http://localhost:9000/minio/health/live

# Check bucket exists
curl -X HEAD http://localhost:9000/signflow-documents

# Check backend can reach MinIO
docker-compose exec backend curl http://minio:9000/minio/health/live

# Check hosts file (Windows)
type C:\Windows\System32\drivers\etc\hosts

# Check hosts file (Linux/Mac)
cat /etc/hosts | grep minio
```

---

**Recommendation:** Start with Option 1 (test from inside Docker) to verify the code works, then implement Option 2 for host access.

