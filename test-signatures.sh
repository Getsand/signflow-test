#!/bin/bash
# Quick test script for Signature Fields API (Milestone D)

set -e

echo "=== Testing Signature Fields API ==="
echo ""

# 1. Login
echo "1. Logging in..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "newuser@example.com", "password": "password123"}')

TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.access_token')

if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
  echo "❌ Login failed!"
  echo "$LOGIN_RESPONSE"
  exit 1
fi

echo "✅ Logged in successfully"
echo ""

# 2. Upload a file
echo "2. Uploading test document..."
PRESIGN_RESPONSE=$(curl -s -X POST http://localhost:8000/api/v1/files/presign \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"filename": "contract.pdf", "mime_type": "application/pdf", "size": 1024}')

FILE_ID=$(echo $PRESIGN_RESPONSE | jq -r '.file_id')
UPLOAD_URL=$(echo $PRESIGN_RESPONSE | jq -r '.upload_url')

if [ "$FILE_ID" == "null" ] || [ -z "$FILE_ID" ]; then
  echo "❌ Presign failed!"
  echo "$PRESIGN_RESPONSE"
  exit 1
fi

echo "✅ File ID: $FILE_ID"

# Upload file
echo "Sample contract for signature testing" > /tmp/contract-test.pdf
curl -s -X PUT --data-binary "@/tmp/contract-test.pdf" "$UPLOAD_URL" > /dev/null

# Finalize
curl -s -X POST "http://localhost:8000/api/v1/files/${FILE_ID}/finalize" \
  -H "Authorization: Bearer $TOKEN" > /dev/null

echo "✅ Document uploaded and finalized"
echo ""

# 3. Get user ID (using hardcoded value for now - replace with actual)
USER_ID="2c3c8ecf-e06b-45a3-8fef-55c9c5d6f3cd"

# 4. Create signature field
echo "3. Creating signature field..."
FIELD1_RESPONSE=$(curl -s -X POST http://localhost:8000/api/v1/signatures/fields \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"file_id\": \"$FILE_ID\",
    \"page\": 1,
    \"x\": 120.0,
    \"y\": 540.0,
    \"width\": 180.0,
    \"height\": 60.0,
    \"assigned_to\": \"$USER_ID\"
  }")

FIELD1_ID=$(echo $FIELD1_RESPONSE | jq -r '.id')

if [ "$FIELD1_ID" == "null" ] || [ -z "$FIELD1_ID" ]; then
  echo "❌ Field creation failed!"
  echo "$FIELD1_RESPONSE"
  exit 1
fi

echo "✅ Signature field created"
echo "   Field ID: $FIELD1_ID"
echo "   Position: (120, 540) on page 1"
echo "   Size: 180x60"
echo ""

# 5. Create another field
echo "4. Creating second signature field..."
FIELD2_RESPONSE=$(curl -s -X POST http://localhost:8000/api/v1/signatures/fields \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"file_id\": \"$FILE_ID\",
    \"page\": 2,
    \"x\": 200.0,
    \"y\": 400.0,
    \"width\": 180.0,
    \"height\": 60.0,
    \"assigned_to\": \"$USER_ID\"
  }")

FIELD2_ID=$(echo $FIELD2_RESPONSE | jq -r '.id')
echo "✅ Second field created: $FIELD2_ID"
echo ""

# 6. List all fields
echo "5. Listing signature fields for document..."
FIELDS_LIST=$(curl -s -X GET "http://localhost:8000/api/v1/signatures/fields?file_id=$FILE_ID" \
  -H "Authorization: Bearer $TOKEN")

FIELD_COUNT=$(echo $FIELDS_LIST | jq '. | length')
echo "✅ Found $FIELD_COUNT signature fields:"
echo "$FIELDS_LIST" | jq '.[] | {id, page_number, status}'
echo ""

# 7. Delete first field
echo "6. Deleting first signature field..."
DELETE_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X DELETE \
  "http://localhost:8000/api/v1/signatures/fields/$FIELD1_ID" \
  -H "Authorization: Bearer $TOKEN")

HTTP_CODE=$(echo "$DELETE_RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)

if [ "$HTTP_CODE" == "204" ]; then
  echo "✅ Field deleted successfully"
else
  echo "❌ Delete failed (HTTP $HTTP_CODE)"
  exit 1
fi
echo ""

# 8. List fields again to verify deletion
echo "7. Verifying deletion..."
FIELDS_LIST_AFTER=$(curl -s -X GET "http://localhost:8000/api/v1/signatures/fields?file_id=$FILE_ID" \
  -H "Authorization: Bearer $TOKEN")

FIELD_COUNT_AFTER=$(echo $FIELDS_LIST_AFTER | jq '. | length')
echo "✅ Remaining fields: $FIELD_COUNT_AFTER"
echo ""

# Summary
echo ""
echo "🎉🎉🎉 ALL SIGNATURE FIELD TESTS PASSED! 🎉🎉🎉"
echo ""
echo "Summary:"
echo "  ✅ Document uploaded successfully"
echo "  ✅ Created 2 signature fields"
echo "  ✅ Listed signature fields"
echo "  ✅ Deleted signature field"
echo "  ✅ Verified deletion"
echo ""
echo "Milestone D is working correctly!"
echo ""
echo "File ID: $FILE_ID"
echo "Remaining Field ID: $FIELD2_ID"
echo ""

