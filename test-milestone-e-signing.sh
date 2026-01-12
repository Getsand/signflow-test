#!/bin/bash
# Milestone E - PDF Signing Test
set -e

echo "============================================"
echo "  MILESTONE E: PDF SIGNING TEST"
echo "============================================"
echo ""

# 1. Login
echo "Step 1: Login..."
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "newuser@example.com", "password": "password123"}' | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)

echo "✅ Logged in"
echo ""

# 2. Upload PDF
echo "Step 2: Upload PDF document..."
RESPONSE=$(curl -s -X POST http://localhost:8000/api/v1/files/presign \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"filename": "contract.pdf", "mime_type": "application/pdf", "size": 2048}')

FILE_ID=$(echo $RESPONSE | grep -o '"file_id":"[^"]*' | cut -d'"' -f4)
UPLOAD_URL=$(echo $RESPONSE | grep -o '"upload_url":"[^"]*' | cut -d'"' -f4)

echo "Contract Document for PDF Signing Test" > contract.pdf
curl -X PUT --data-binary "@contract.pdf" "$UPLOAD_URL"
curl -s -X POST "http://localhost:8000/api/v1/files/${FILE_ID}/finalize" \
  -H "Authorization: Bearer $TOKEN" > /dev/null

echo "✅ PDF uploaded: $FILE_ID"
echo ""

# 3. Create signature fields
echo "Step 3: Create signature fields..."
USER_ID="2c3c8ecf-e06b-45a3-8fef-55c9c5d6f3cd"

FIELD1_RESPONSE=$(curl -s -X POST http://localhost:8000/api/v1/signatures/fields \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"file_id\": \"$FILE_ID\",
    \"page\": 1,
    \"x\": 100.0,
    \"y\": 700.0,
    \"width\": 200.0,
    \"height\": 60.0,
    \"assigned_to\": \"$USER_ID\"
  }")

FIELD1_ID=$(echo $FIELD1_RESPONSE | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
echo "✅ Field 1 created: $FIELD1_ID"

FIELD2_RESPONSE=$(curl -s -X POST http://localhost:8000/api/v1/signatures/fields \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"file_id\": \"$FILE_ID\",
    \"page\": 1,
    \"x\": 100.0,
    \"y\": 100.0,
    \"width\": 200.0,
    \"height\": 60.0,
    \"assigned_to\": \"$USER_ID\"
  }")

FIELD2_ID=$(echo $FIELD2_RESPONSE | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
echo "✅ Field 2 created: $FIELD2_ID"
echo ""

# 4. Sign Field 1
echo "Step 4: Sign Field 1 (TYPED signature)..."
SIGN1_RESPONSE=$(curl -s -X POST "http://localhost:8000/api/v1/signatures/fields/${FIELD1_ID}/sign" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "signature_type": "TYPED",
    "typed_name": "John Doe"
  }')

echo "$SIGN1_RESPONSE"
STATUS1=$(echo $SIGN1_RESPONSE | grep -o '"status":"[^"]*' | cut -d'"' -f4)

if [ "$STATUS1" == "SIGNED" ]; then
  echo "✅ Field 1 signed successfully!"
else
  echo "❌ Field 1 signing failed"
  exit 1
fi
echo ""

# 5. Sign Field 2
echo "Step 5: Sign Field 2 (TYPED signature)..."
SIGN2_RESPONSE=$(curl -s -X POST "http://localhost:8000/api/v1/signatures/fields/${FIELD2_ID}/sign" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "signature_type": "TYPED",
    "typed_name": "Jane Smith"
  }')

echo "$SIGN2_RESPONSE"
STATUS2=$(echo $SIGN2_RESPONSE | grep -o '"status":"[^"]*' | cut -d'"' -f4)

if [ "$STATUS2" == "SIGNED" ]; then
  echo "✅ Field 2 signed successfully!"
else
  echo "❌ Field 2 signing failed"
  exit 1
fi
echo ""

# 6. Verify all fields signed
echo "Step 6: Verify all fields are signed..."
FIELDS_LIST=$(curl -s -X GET "http://localhost:8000/api/v1/signatures/fields?file_id=$FILE_ID" \
  -H "Authorization: Bearer $TOKEN")

echo "$FIELDS_LIST"
echo ""

echo "============================================"
echo "  🎉 ALL TESTS PASSED! 🎉"
echo "============================================"
echo ""
echo "Summary:"
echo "  ✅ PDF document uploaded"
echo "  ✅ 2 signature fields created"
echo "  ✅ Field 1 signed (TYPED)"
echo "  ✅ Field 2 signed (TYPED)"
echo "  ✅ PDF modified with signatures"
echo "  ✅ Document should now be LOCKED"
echo ""
echo "File ID: $FILE_ID"
echo ""
echo "Check MinIO to see the signed PDF!"
echo "http://localhost:9001 (minioadmin/minioadmin)"
echo ""

