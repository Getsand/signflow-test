#!/bin/bash
# Complete file upload test flow for SignFlow
# Run this after: docker-compose up -d

set -e

echo "🧪 SignFlow File Upload Test"
echo "=============================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# STEP 1: Login
echo -e "${BLUE}STEP 1: Login${NC}"
echo "Logging in..."

LOGIN_RESPONSE=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }')

TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.access_token')

if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
  echo -e "${RED}❌ Login failed${NC}"
  echo "$LOGIN_RESPONSE"
  exit 1
fi

echo -e "${GREEN}✅ Login successful${NC}"
echo "Token: ${TOKEN:0:20}..."
echo ""

# STEP 2: Request presigned URL
echo -e "${BLUE}STEP 2: Request Presigned URL${NC}"
echo "Requesting presigned upload URL..."

# Create test file
echo "Test PDF content - $(date)" > test-upload.pdf

FILE_SIZE=$(wc -c < test-upload.pdf)

PRESIGN_RESPONSE=$(curl -s -X POST http://localhost:8000/api/v1/files/presign \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"filename\": \"test-upload.pdf\",
    \"mime_type\": \"application/pdf\",
    \"size\": $FILE_SIZE
  }")

FILE_ID=$(echo $PRESIGN_RESPONSE | jq -r '.file_id')
UPLOAD_URL=$(echo $PRESIGN_RESPONSE | jq -r '.upload_url')

if [ "$FILE_ID" == "null" ] || [ -z "$FILE_ID" ]; then
  echo -e "${RED}❌ Presign failed${NC}"
  echo "$PRESIGN_RESPONSE"
  exit 1
fi

echo -e "${GREEN}✅ Presigned URL generated${NC}"
echo "File ID: $FILE_ID"
echo "Upload URL: ${UPLOAD_URL:0:60}..."

# Check URL contains localhost:9000 (not minio:9000)
if [[ "$UPLOAD_URL" == *"localhost:9000"* ]]; then
  echo -e "${GREEN}✅ URL contains localhost:9000 (correct)${NC}"
elif [[ "$UPLOAD_URL" == *"minio:9000"* ]]; then
  echo -e "${RED}❌ URL contains minio:9000 (WRONG - Docker internal)${NC}"
  exit 1
else
  echo -e "${RED}⚠️  Unexpected URL format${NC}"
fi
echo ""

# STEP 3: Upload file
echo -e "${BLUE}STEP 3: Upload File to MinIO${NC}"
echo "Uploading test-upload.pdf..."

UPLOAD_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X PUT \
  -H "Content-Type: application/pdf" \
  --data-binary "@test-upload.pdf" \
  "$UPLOAD_URL")

if [ "$UPLOAD_STATUS" == "200" ]; then
  echo -e "${GREEN}✅ File uploaded successfully (HTTP $UPLOAD_STATUS)${NC}"
else
  echo -e "${RED}❌ Upload failed (HTTP $UPLOAD_STATUS)${NC}"
  exit 1
fi
echo ""

# STEP 4: Finalize upload
echo -e "${BLUE}STEP 4: Finalize Upload${NC}"
echo "Finalizing upload..."

FINALIZE_RESPONSE=$(curl -s -X POST "http://localhost:8000/api/v1/files/$FILE_ID/finalize" \
  -H "Authorization: Bearer $TOKEN")

STATUS=$(echo $FINALIZE_RESPONSE | jq -r '.status')
FILE_SIZE_FINAL=$(echo $FINALIZE_RESPONSE | jq -r '.size')

if [ "$STATUS" == "COMPLETED" ]; then
  echo -e "${GREEN}✅ Upload finalized successfully${NC}"
  echo "Status: $STATUS"
  echo "Size: $FILE_SIZE_FINAL bytes"
else
  echo -e "${RED}❌ Finalization failed${NC}"
  echo "$FINALIZE_RESPONSE"
  exit 1
fi
echo ""

# Cleanup
rm -f test-upload.pdf

# Summary
echo "=============================="
echo -e "${GREEN}🎉 ALL TESTS PASSED${NC}"
echo "=============================="
echo ""
echo "Summary:"
echo "  ✅ Login successful"
echo "  ✅ Presigned URL generated (localhost:9000)"
echo "  ✅ File uploaded to MinIO"
echo "  ✅ Upload finalized (COMPLETED)"
echo ""
echo "File ID: $FILE_ID"
echo ""
echo "Verify in MinIO:"
echo "  1. Open http://localhost:9001"
echo "  2. Login: minioadmin / minioadmin"
echo "  3. Check bucket: signflow-documents"
echo "  4. Find: uploads/$FILE_ID/test-upload.pdf"

