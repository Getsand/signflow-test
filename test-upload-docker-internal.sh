#!/bin/bash
# Test presigned upload flow from INSIDE Docker network
# This works because minio:9000 is accessible from within Docker

set -e

echo "=== SignFlow File Upload Test (Docker Internal) ==="
echo ""

# 1. Login
echo "Step 1: Login..."
LOGIN_RESPONSE=$(curl -s -X POST http://backend:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "newuser@example.com", "password": "password123"}')

TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.access_token')

if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
  echo "❌ Login failed!"
  echo "$LOGIN_RESPONSE"
  exit 1
fi

echo "✅ Login successful"
echo "Token: ${TOKEN:0:20}..."
echo ""

# 2. Get presigned URL
echo "Step 2: Request presigned upload URL..."
PRESIGN_RESPONSE=$(curl -s -X POST http://backend:8000/api/v1/files/presign \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"filename": "test-docker.pdf", "mime_type": "application/pdf", "size": 1024}')

echo "$PRESIGN_RESPONSE" | jq '.'

UPLOAD_URL=$(echo $PRESIGN_RESPONSE | jq -r '.upload_url')
FILE_ID=$(echo $PRESIGN_RESPONSE | jq -r '.file_id')

if [ "$UPLOAD_URL" == "null" ] || [ -z "$UPLOAD_URL" ]; then
  echo "❌ Presign failed!"
  exit 1
fi

echo "✅ Presigned URL generated"
echo "File ID: $FILE_ID"
echo "Upload URL: ${UPLOAD_URL:0:50}..."
echo ""

# 3. Create test file
echo "Step 3: Create test file..."
echo "Test content for SignFlow - $(date)" > /tmp/test-docker.pdf
echo "✅ Test file created"
echo ""

# 4. Upload file
echo "Step 4: Upload file to MinIO..."
UPLOAD_RESULT=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X PUT \
  --data-binary "@/tmp/test-docker.pdf" \
  "$UPLOAD_URL")

HTTP_CODE=$(echo "$UPLOAD_RESULT" | grep "HTTP_CODE" | cut -d: -f2)

if [ "$HTTP_CODE" != "200" ]; then
  echo "❌ Upload failed with HTTP $HTTP_CODE"
  echo "$UPLOAD_RESULT"
  exit 1
fi

echo "✅ File uploaded successfully"
echo ""

# 5. Finalize upload
echo "Step 5: Finalize upload..."
FINALIZE_RESPONSE=$(curl -s -X POST "http://backend:8000/api/v1/files/${FILE_ID}/finalize" \
  -H "Authorization: Bearer $TOKEN")

echo "$FINALIZE_RESPONSE" | jq '.'

STATUS=$(echo $FINALIZE_RESPONSE | jq -r '.status')

if [ "$STATUS" == "COMPLETED" ]; then
  echo ""
  echo "✅ ✅ ✅ ALL TESTS PASSED! ✅ ✅ ✅"
  echo ""
  echo "File uploaded and finalized successfully:"
  echo "- File ID: $FILE_ID"
  echo "- Status: $STATUS"
  echo "- Bucket: $(echo $FINALIZE_RESPONSE | jq -r '.bucket')"
  echo "- Storage Key: $(echo $FINALIZE_RESPONSE | jq -r '.storage_key')"
else
  echo "❌ Finalize failed or status not COMPLETED"
  exit 1
fi

