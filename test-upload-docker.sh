#!/bin/bash
# Test file upload from inside Docker container
# This WILL work because minio:9000 resolves inside Docker

echo "🧪 Testing File Upload (Inside Docker)"
echo "======================================"
echo ""
echo "Running tests inside backend container..."
echo ""

docker-compose exec backend bash -c '
set -e

echo "1️⃣ Login..."
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"newuser@example.com\",\"password\":\"password123\"}" \
  | jq -r ".access_token")

if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then
  echo "❌ Login failed"
  exit 1
fi

echo "✅ Logged in"
echo "Token: ${TOKEN:0:30}..."
echo ""

echo "2️⃣ Request presigned URL..."
RESPONSE=$(curl -s -X POST http://localhost:8000/api/v1/files/presign \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"filename\":\"test.pdf\",\"mime_type\":\"application/pdf\",\"size\":1024}")

FILE_ID=$(echo $RESPONSE | jq -r ".file_id")
UPLOAD_URL=$(echo $RESPONSE | jq -r ".upload_url")

if [ "$FILE_ID" = "null" ]; then
  echo "❌ Presign failed"
  echo "$RESPONSE"
  exit 1
fi

echo "✅ Presigned URL generated"
echo "File ID: $FILE_ID"
echo "Upload URL: ${UPLOAD_URL:0:80}..."
echo ""

echo "3️⃣ Upload file..."
echo "Test content - $(date)" > /tmp/test.pdf

UPLOAD_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X PUT \
  -H "Content-Type: application/pdf" \
  --data-binary "@/tmp/test.pdf" \
  "$UPLOAD_URL")

if [ "$UPLOAD_STATUS" = "200" ]; then
  echo "✅ File uploaded (HTTP $UPLOAD_STATUS)"
else
  echo "❌ Upload failed (HTTP $UPLOAD_STATUS)"
  exit 1
fi
echo ""

echo "4️⃣ Finalize upload..."
FINALIZE=$(curl -s -X POST "http://localhost:8000/api/v1/files/$FILE_ID/finalize" \
  -H "Authorization: Bearer $TOKEN")

STATUS=$(echo $FINALIZE | jq -r ".status")

if [ "$STATUS" = "COMPLETED" ]; then
  echo "✅ Upload finalized"
  echo "$FINALIZE" | jq "."
else
  echo "❌ Finalize failed"
  echo "$FINALIZE"
  exit 1
fi

rm -f /tmp/test.pdf

echo ""
echo "======================================"
echo "✅ ALL TESTS PASSED"
echo "======================================"
echo ""
echo "File ID: $FILE_ID"
echo ""
echo "Verify in MinIO:"
echo "  http://localhost:9001"
echo "  Login: minioadmin / minioadmin"
echo "  Bucket: signflow-documents"
echo "  Path: uploads/$FILE_ID/test.pdf"
'

echo ""
echo "✅ Test completed successfully!"

