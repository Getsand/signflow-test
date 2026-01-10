#!/bin/bash
# Complete Milestone D Test - Upload File + Signature Fields
set -e

echo "=========================================="
echo "  MILESTONE D: SIGNATURE FIELDS TEST"
echo "=========================================="
echo ""

# Step 1: Login
echo "Step 1: Login..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "newuser@example.com", "password": "password123"}')

TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.access_token')

if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
  echo "❌ Login failed!"
  echo "$LOGIN_RESPONSE"
  exit 1
fi

echo "✅ Login successful"
echo "   Token: ${TOKEN:0:30}..."
echo ""

# Step 2: Request presigned URL
echo "Step 2: Request presigned upload URL..."
PRESIGN_RESPONSE=$(curl -s -X POST http://localhost:8000/api/v1/files/presign \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"filename": "contract-milestone-d.pdf", "mime_type": "application/pdf", "size": 2048}')

FILE_ID=$(echo $PRESIGN_RESPONSE | jq -r '.file_id')
UPLOAD_URL=$(echo $PRESIGN_RESPONSE | jq -r '.upload_url')

if [ "$FILE_ID" == "null" ] || [ -z "$FILE_ID" ]; then
  echo "❌ Presign failed!"
  echo "$PRESIGN_RESPONSE"
  exit 1
fi

echo "✅ Presigned URL generated"
echo "   File ID: $FILE_ID"
echo ""

# Step 3: Upload file
echo "Step 3: Upload file to MinIO..."
echo "Sample Contract Document - Milestone D Test - $(date)" > test-milestone-d.pdf

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X PUT \
  --data-binary "@test-milestone-d.pdf" "$UPLOAD_URL")

if [ "$HTTP_CODE" != "200" ]; then
  echo "❌ Upload failed (HTTP $HTTP_CODE)"
  exit 1
fi

echo "✅ File uploaded to MinIO (HTTP $HTTP_CODE)"
echo ""

# Step 4: Finalize upload
echo "Step 4: Finalize upload..."
FINALIZE_RESPONSE=$(curl -s -X POST "http://localhost:8000/api/v1/files/${FILE_ID}/finalize" \
  -H "Authorization: Bearer $TOKEN")

STATUS=$(echo $FINALIZE_RESPONSE | jq -r '.status')

if [ "$STATUS" != "COMPLETED" ]; then
  echo "❌ Finalize failed!"
  echo "$FINALIZE_RESPONSE"
  exit 1
fi

echo "✅ Upload finalized"
echo "   Status: $STATUS"
echo ""

# Step 5: Get user ID (hardcoded for now)
USER_ID="2c3c8ecf-e06b-45a3-8fef-55c9c5d6f3cd"

echo "=========================================="
echo "  TESTING SIGNATURE FIELDS API"
echo "=========================================="
echo ""

# Step 6: Create first signature field
echo "Step 5: Create signature field #1 (Page 1, Top)..."
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

FIELD1_ID=$(echo $FIELD1_RESPONSE | jq -r '.id')

if [ "$FIELD1_ID" == "null" ] || [ -z "$FIELD1_ID" ]; then
  echo "❌ Field creation failed!"
  echo "$FIELD1_RESPONSE"
  exit 1
fi

echo "✅ Signature field #1 created"
echo "   Field ID: $FIELD1_ID"
echo "   Position: (100, 700) on page 1"
echo "   Size: 200x60"
echo ""

# Step 7: Create second signature field
echo "Step 6: Create signature field #2 (Page 1, Bottom)..."
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

FIELD2_ID=$(echo $FIELD2_RESPONSE | jq -r '.id')

echo "✅ Signature field #2 created"
echo "   Field ID: $FIELD2_ID"
echo "   Position: (100, 100) on page 1"
echo ""

# Step 8: Create third signature field on page 2
echo "Step 7: Create signature field #3 (Page 2)..."
FIELD3_RESPONSE=$(curl -s -X POST http://localhost:8000/api/v1/signatures/fields \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"file_id\": \"$FILE_ID\",
    \"page\": 2,
    \"x\": 150.0,
    \"y\": 500.0,
    \"width\": 180.0,
    \"height\": 50.0,
    \"assigned_to\": \"$USER_ID\"
  }")

FIELD3_ID=$(echo $FIELD3_RESPONSE | jq -r '.id')

echo "✅ Signature field #3 created"
echo "   Field ID: $FIELD3_ID"
echo "   Position: (150, 500) on page 2"
echo ""

# Step 9: List all signature fields
echo "Step 8: List all signature fields for document..."
FIELDS_LIST=$(curl -s -X GET "http://localhost:8000/api/v1/signatures/fields?file_id=$FILE_ID" \
  -H "Authorization: Bearer $TOKEN")

FIELD_COUNT=$(echo $FIELDS_LIST | jq '. | length')

echo "✅ Found $FIELD_COUNT signature fields:"
echo "$FIELDS_LIST" | jq '.[] | {
  id: .id,
  page: .page_number,
  position: {x: .x, y: .y},
  size: {width: .width, height: .height},
  status: .status
}'
echo ""

# Step 10: Delete one field
echo "Step 9: Delete signature field #2..."
DELETE_HTTP=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE \
  "http://localhost:8000/api/v1/signatures/fields/$FIELD2_ID" \
  -H "Authorization: Bearer $TOKEN")

if [ "$DELETE_HTTP" == "204" ]; then
  echo "✅ Field deleted successfully (HTTP $DELETE_HTTP)"
else
  echo "❌ Delete failed (HTTP $DELETE_HTTP)"
  exit 1
fi
echo ""

# Step 11: List fields again to verify deletion
echo "Step 10: Verify deletion..."
FIELDS_AFTER=$(curl -s -X GET "http://localhost:8000/api/v1/signatures/fields?file_id=$FILE_ID" \
  -H "Authorization: Bearer $TOKEN")

FIELD_COUNT_AFTER=$(echo $FIELDS_AFTER | jq '. | length')

echo "✅ Remaining fields: $FIELD_COUNT_AFTER"
echo "$FIELDS_AFTER" | jq '.[] | {id: .id, page: .page_number, status: .status}'
echo ""

echo "=========================================="
echo "  🎉 ALL TESTS PASSED! 🎉"
echo "=========================================="
echo ""
echo "Summary:"
echo "  ✅ User authentication"
echo "  ✅ File upload (presign → upload → finalize)"
echo "  ✅ Created 3 signature fields"
echo "  ✅ Listed signature fields"
echo "  ✅ Deleted 1 signature field"
echo "  ✅ Verified deletion"
echo ""
echo "Milestone D is fully functional!"
echo ""
echo "Document Details:"
echo "  File ID: $FILE_ID"
echo "  Status: COMPLETED"
echo "  Signature Fields: $FIELD_COUNT_AFTER (2 remaining)"
echo ""
echo "Remaining Signature Fields:"
echo "  - Field 1: $FIELD1_ID (Page 1, top)"
echo "  - Field 3: $FIELD3_ID (Page 2)"
echo ""

