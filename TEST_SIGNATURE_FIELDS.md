# Signature Fields API Testing Guide

This guide provides curl commands to test the signature fields (Milestone D) functionality.

## Prerequisites

1. Backend is running: `http://localhost:8000`
2. You have a valid user account: `newuser@example.com` / `password123`
3. You have uploaded a file and have its `file_id`

## Environment Setup

```bash
# Set these variables for easier testing
export API_BASE="http://localhost:8000/api/v1"
export TEST_EMAIL="newuser@example.com"
export TEST_PASSWORD="password123"
```

## Test Flow

### Step 1: Login and Get Token

```bash
# Login
curl -X POST $API_BASE/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$TEST_EMAIL\", \"password\": \"$TEST_PASSWORD\"}"

# Copy the access_token from response
export TOKEN="<paste-your-token-here>"
```

### Step 2: Upload a File (if you don't have one)

```bash
# Get presigned URL
PRESIGN_RESPONSE=$(curl -s -X POST $API_BASE/files/presign \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"filename": "document.pdf", "mime_type": "application/pdf", "size": 10240}')

echo "$PRESIGN_RESPONSE" | jq '.'

# Extract file_id and upload_url
export FILE_ID=$(echo $PRESIGN_RESPONSE | jq -r '.file_id')
export UPLOAD_URL=$(echo $PRESIGN_RESPONSE | jq -r '.upload_url')

# Create and upload test file
echo "Test PDF content" > document.pdf
curl -X PUT --data-binary "@document.pdf" "$UPLOAD_URL"

# Finalize
curl -X POST "$API_BASE/files/${FILE_ID}/finalize" \
  -H "Authorization: Bearer $TOKEN"

echo "File ID: $FILE_ID"
```

### Step 3: Create Signature Fields

```bash
# Get user ID (you'll need this for assigned_to)
# You can get it from the JWT token or create a separate endpoint
# For testing, use the same user ID as the owner
export USER_ID="<user-id-from-jwt>"

# Create first signature field (e.g., for client signature)
curl -X POST $API_BASE/signatures/fields \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"file_id\": \"$FILE_ID\",
    \"page\": 1,
    \"x\": 100,
    \"y\": 700,
    \"width\": 200,
    \"height\": 50,
    \"assigned_to\": \"$USER_ID\"
  }" | jq '.'

# Save the signature field ID
export FIELD_ID_1="<field-id-from-response>"

# Create second signature field (e.g., for witness signature)
curl -X POST $API_BASE/signatures/fields \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"file_id\": \"$FILE_ID\",
    \"page\": 1,
    \"x\": 100,
    \"y\": 600,
    \"width\": 200,
    \"height\": 50,
    \"assigned_to\": \"$USER_ID\"
  }" | jq '.'

# Create third signature field on page 2
curl -X POST $API_BASE/signatures/fields \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"file_id\": \"$FILE_ID\",
    \"page\": 2,
    \"x\": 300,
    \"y\": 400,
    \"width\": 180,
    \"height\": 60,
    \"assigned_to\": \"$USER_ID\"
  }" | jq '.'
```

### Step 4: List All Signature Fields for File

```bash
curl -X GET "$API_BASE/signatures/fields?file_id=$FILE_ID" \
  -H "Authorization: Bearer $TOKEN" | jq '.'
```

Expected response:
```json
{
  "fields": [
    {
      "id": "uuid-here",
      "file_id": "file-uuid",
      "page_number": 1,
      "x": 100.0,
      "y": 700.0,
      "width": 200.0,
      "height": 50.0,
      "assigned_to": "user-uuid",
      "status": "PENDING",
      "created_at": "2026-01-08T10:00:00Z"
    },
    ...
  ],
  "count": 3
}
```

### Step 5: Delete a Signature Field

```bash
# Delete the first field (must be PENDING status)
curl -X DELETE "$API_BASE/signatures/fields/$FIELD_ID_1" \
  -H "Authorization: Bearer $TOKEN" -v

# Should return 204 No Content

# Verify it's deleted
curl -X GET "$API_BASE/signatures/fields?file_id=$FILE_ID" \
  -H "Authorization: Bearer $TOKEN" | jq '.'
```

## Error Cases to Test

### 1. Unauthorized Access (no token)

```bash
curl -X POST $API_BASE/signatures/fields \
  -H "Content-Type: application/json" \
  -d "{
    \"file_id\": \"$FILE_ID\",
    \"page\": 1,
    \"x\": 100,
    \"y\": 500,
    \"width\": 200,
    \"height\": 50,
    \"assigned_to\": \"$USER_ID\"
  }"

# Expected: 401 Unauthorized
```

### 2. Invalid Page Number

```bash
curl -X POST $API_BASE/signatures/fields \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"file_id\": \"$FILE_ID\",
    \"page\": 0,
    \"x\": 100,
    \"y\": 500,
    \"width\": 200,
    \"height\": 50,
    \"assigned_to\": \"$USER_ID\"
  }"

# Expected: 400 Bad Request - "Page number must be >= 1"
```

### 3. Negative Coordinates

```bash
curl -X POST $API_BASE/signatures/fields \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"file_id\": \"$FILE_ID\",
    \"page\": 1,
    \"x\": -10,
    \"y\": 500,
    \"width\": 200,
    \"height\": 50,
    \"assigned_to\": \"$USER_ID\"
  }"

# Expected: 400 Bad Request - "Coordinates must be >= 0"
```

### 4. Invalid Dimensions

```bash
curl -X POST $API_BASE/signatures/fields \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"file_id\": \"$FILE_ID\",
    \"page\": 1,
    \"x\": 100,
    \"y\": 500,
    \"width\": 0,
    \"height\": 50,
    \"assigned_to\": \"$USER_ID\"
  }"

# Expected: 400 Bad Request - "Width and height must be positive"
```

### 5. File Not Found

```bash
curl -X POST $API_BASE/signatures/fields \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"file_id\": \"00000000-0000-0000-0000-000000000000\",
    \"page\": 1,
    \"x\": 100,
    \"y\": 500,
    \"width\": 200,
    \"height\": 50,
    \"assigned_to\": \"$USER_ID\"
  }"

# Expected: 404 Not Found - "File not found or access denied"
```

## Success Criteria

✅ All three endpoints work (create, list, delete)  
✅ Ownership checks enforced  
✅ Validation errors return clear messages  
✅ No impact on existing file upload flow  
✅ Database constraints working (foreign keys, cascades)

## Next Steps (Future Milestones)

- Milestone E: Actual PDF signing
- Milestone F: Signature images and rendering
- Milestone G: Multi-party signing workflow

