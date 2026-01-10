# Manual Testing Guide - Milestone D

Run these commands in **Git Bash** one by one:

## Step 1: Login
```bash
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "newuser@example.com", "password": "password123"}' | jq -r '.access_token')

echo "Token: ${TOKEN:0:30}..."
```

## Step 2: Upload a New File

```bash
# Get presigned URL
RESPONSE=$(curl -s -X POST http://localhost:8000/api/v1/files/presign \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"filename": "milestone-d-test.pdf", "mime_type": "application/pdf", "size": 2048}')

echo "$RESPONSE" | jq '.'

FILE_ID=$(echo $RESPONSE | jq -r '.file_id')
UPLOAD_URL=$(echo $RESPONSE | jq -r '.upload_url')

echo "File ID: $FILE_ID"
```

## Step 3: Upload File to MinIO

```bash
# Create test file
echo "Milestone D Test Document - $(date)" > milestone-d-test.pdf

# Upload
curl -v -X PUT --data-binary "@milestone-d-test.pdf" "$UPLOAD_URL"
# Should see: HTTP/1.1 200 OK
```

## Step 4: Finalize Upload

```bash
curl -s -X POST "http://localhost:8000/api/v1/files/${FILE_ID}/finalize" \
  -H "Authorization: Bearer $TOKEN" | jq '.'
# Should show: "status": "COMPLETED"
```

## Step 5: Create Signature Field

```bash
# Use your actual user ID
USER_ID="2c3c8ecf-e06b-45a3-8fef-55c9c5d6f3cd"

# Create first signature field
FIELD_RESPONSE=$(curl -s -X POST http://localhost:8000/api/v1/signatures/fields \
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

echo "$FIELD_RESPONSE" | jq '.'

FIELD_ID=$(echo $FIELD_RESPONSE | jq -r '.id')
echo "Field ID: $FIELD_ID"
```

## Step 6: Create More Signature Fields

```bash
# Field on page 1, bottom
curl -s -X POST http://localhost:8000/api/v1/signatures/fields \
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
  }" | jq '.'

# Field on page 2
curl -s -X POST http://localhost:8000/api/v1/signatures/fields \
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
  }" | jq '.'
```

## Step 7: List All Signature Fields

```bash
curl -s -X GET "http://localhost:8000/api/v1/signatures/fields?file_id=$FILE_ID" \
  -H "Authorization: Bearer $TOKEN" | jq '.'
```

Expected output: **3 signature fields** with details

## Step 8: Delete a Signature Field

```bash
curl -v -X DELETE "http://localhost:8000/api/v1/signatures/fields/$FIELD_ID" \
  -H "Authorization: Bearer $TOKEN"
# Should see: HTTP/1.1 204 No Content
```

## Step 9: Verify Deletion

```bash
curl -s -X GET "http://localhost:8000/api/v1/signatures/fields?file_id=$FILE_ID" \
  -H "Authorization: Bearer $TOKEN" | jq '.'
```

Expected output: **2 signature fields** remaining (one deleted)

---

## ✅ Success Criteria

You should see:
- ✅ File uploaded successfully (HTTP 200)
- ✅ File status: COMPLETED
- ✅ 3 signature fields created
- ✅ All fields listed with correct coordinates
- ✅ 1 field deleted (HTTP 204)
- ✅ 2 fields remaining after deletion

---

## 🎉 If All Steps Work

**Milestone D is complete and working!**

The system can now:
- Upload documents
- Create signature placeholders (boxes) on documents
- Assign signature fields to users
- List signature fields
- Delete signature fields

Ready for **Milestone E** (actual PDF signing)!

