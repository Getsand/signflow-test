#!/bin/bash
# Complete file upload test - Run after: docker-compose up -d

set -e

echo "🧪 Testing File Upload Flow"
echo "============================"
echo ""

# Step 1: Login
echo "1️⃣ Login..."
LOGIN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"newuser@example.com","password":"password123"}')

TOKEN=$(echo $LOGIN | jq -r '.access_token')

if [ "$TOKEN" == "null" ]; then
  echo "❌ Login failed"
  echo "$LOGIN"
  exit 1
fi

echo "✅ Logged in"
echo "Token: ${TOKEN:0:30}..."
echo ""

# Step 2: Request presigned URL
echo "2️⃣ Request presigned upload URL..."
PRESIGN=$(curl -s -X POST http://localhost:8000/api/v1/files/presign \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"filename":"test.pdf","mime_type":"application/pdf","size":1024}')

FILE_ID=$(echo $PRESIGN | jq -r '.file_id')
UPLOAD_URL=$(echo $PRESIGN | jq -r '.upload_url')

if [ "$FILE_ID" == "null" ]; then
  echo "❌ Presign failed"
  echo "$PRESIGN"
  exit 1
fi

echo "✅ Presigned URL generated"
echo "File ID: $FILE_ID"
echo "Upload URL: ${UPLOAD_URL:0:80}..."

# Check URL contains localhost:9000
if [[ "$UPLOAD_URL" == *"localhost:9000"* ]]; then
  echo "✅ URL contains localhost:9000"
elif [[ "$UPLOAD_URL" == *"minio:9000"* ]]; then
  echo "❌ URL contains minio:9000 (WRONG!)"
  exit 1
fi
echo ""

# Step 3: Upload file
echo "3️⃣ Upload file to MinIO..."
echo "Hello SignFlow - Test Upload" > test.pdf

UPLOAD_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X PUT \
  -H "Content-Type: application/pdf" \
  --data-binary "@test.pdf" \
  "$UPLOAD_URL")

if [ "$UPLOAD_STATUS" == "200" ]; then
  echo "✅ File uploaded (HTTP $UPLOAD_STATUS)"
else
  echo "❌ Upload failed (HTTP $UPLOAD_STATUS)"
  exit 1
fi
echo ""

# Step 4: Finalize
echo "4️⃣ Finalize upload..."
FINALIZE=$(curl -s -X POST "http://localhost:8000/api/v1/files/$FILE_ID/finalize" \
  -H "Authorization: Bearer $TOKEN")

STATUS=$(echo $FINALIZE | jq -r '.status')

if [ "$STATUS" == "COMPLETED" ]; then
  echo "✅ Upload finalized"
  echo "$FINALIZE" | jq '.'
else
  echo "❌ Finalize failed"
  echo "$FINALIZE"
  exit 1
fi
echo ""

# Cleanup
rm -f test.pdf

# Summary
echo "============================"
echo "✅ ALL TESTS PASSED"
echo "============================"
echo ""
echo "File uploaded successfully!"
echo "File ID: $FILE_ID"
echo ""
echo "Verify in MinIO:"
echo "  http://localhost:9001"
echo "  Login: minioadmin / minioadmin"
echo "  Bucket: signflow-documents"
echo "  Path: uploads/$FILE_ID/test.pdf"

