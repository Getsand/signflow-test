# ✅ Milestone D: Signature Fields — COMPLETE

## 📋 Summary

**Signature Fields (Boxes)** have been successfully implemented.

This milestone adds the ability to:
- ✅ Create signature placeholder boxes on documents
- ✅ Store position, size, and page information
- ✅ Assign signature fields to specific users
- ✅ List signature fields for a document
- ✅ Delete signature fields (if not yet signed)

**This is pure metadata** — No PDF manipulation or actual signing yet.

---

## 🗄️ Database Changes

### New Table: `signature_fields`

```sql
CREATE TABLE signature_fields (
    id              UUID PRIMARY KEY,
    file_id         UUID NOT NULL REFERENCES file_objects(id) ON DELETE CASCADE,
    page_number     INTEGER NOT NULL,
    x               FLOAT NOT NULL,
    y               FLOAT NOT NULL,
    width           FLOAT NOT NULL,
    height          FLOAT NOT NULL,
    assigned_to     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status          signaturefieldstatus NOT NULL DEFAULT 'PENDING',
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX ix_signature_fields_file_id ON signature_fields(file_id);
CREATE INDEX ix_signature_fields_assigned_to ON signature_fields(assigned_to);
```

### Enum Type: `signaturefieldstatus`
- `PENDING`: Awaiting signature
- `SIGNED`: Already signed

---

## 🔌 API Endpoints

### 1. Create Signature Field
**POST** `/api/v1/signatures/fields`

Creates a new signature box on a document.

**Auth Required:** Yes (JWT)

**Request Body:**
```json
{
  "file_id": "uuid-of-document",
  "page": 1,
  "x": 120.0,
  "y": 540.0,
  "width": 180.0,
  "height": 60.0,
  "assigned_to": "uuid-of-signer"
}
```

**Response:** `201 Created`
```json
{
  "id": "field-uuid",
  "file_id": "uuid-of-document",
  "page_number": 1,
  "x": 120.0,
  "y": 540.0,
  "width": 180.0,
  "height": 60.0,
  "assigned_to": "uuid-of-signer",
  "status": "PENDING",
  "created_at": "2026-01-09T13:45:00Z"
}
```

**Rules:**
- ✅ Only file owner can create fields
- ✅ File must exist and be owned by current user
- ✅ Page number must be >= 1
- ✅ Width and height must be > 0

---

### 2. List Signature Fields
**GET** `/api/v1/signatures/fields?file_id={uuid}`

Lists all signature fields for a document.

**Auth Required:** Yes (JWT)

**Query Parameters:**
- `file_id` (required): UUID of the document

**Response:** `200 OK`
```json
[
  {
    "id": "field-uuid-1",
    "file_id": "uuid-of-document",
    "page_number": 1,
    "x": 120.0,
    "y": 540.0,
    "width": 180.0,
    "height": 60.0,
    "assigned_to": "uuid-of-signer-1",
    "status": "PENDING",
    "created_at": "2026-01-09T13:45:00Z"
  },
  {
    "id": "field-uuid-2",
    "file_id": "uuid-of-document",
    "page_number": 2,
    "x": 200.0,
    "y": 400.0,
    "width": 180.0,
    "height": 60.0,
    "assigned_to": "uuid-of-signer-2",
    "status": "SIGNED",
    "created_at": "2026-01-09T13:46:00Z"
  }
]
```

**Rules:**
- ✅ File owner can see all fields
- ✅ Assigned signer can see fields assigned to them
- ✅ Fields are ordered by page number, then creation time

---

### 3. Delete Signature Field
**DELETE** `/api/v1/signatures/fields/{field_id}`

Deletes a signature field (only if not yet signed).

**Auth Required:** Yes (JWT)

**Path Parameters:**
- `field_id` (required): UUID of the signature field

**Response:** `204 No Content`

**Rules:**
- ✅ Only file owner can delete
- ✅ Only if status is PENDING (not yet signed)
- ✅ Returns 400 if field is already signed

---

## 🧪 Testing with cURL

### Step 1: Login and Get Token

```bash
# Login
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "newuser@example.com", "password": "password123"}' | jq -r '.access_token')

echo "Token: $TOKEN"
```

### Step 2: Upload a File (to get file_id)

```bash
# Get presigned URL
RESPONSE=$(curl -s -X POST http://localhost:8000/api/v1/files/presign \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"filename": "contract.pdf", "mime_type": "application/pdf", "size": 102400}')

FILE_ID=$(echo $RESPONSE | jq -r '.file_id')
UPLOAD_URL=$(echo $RESPONSE | jq -r '.upload_url')

echo "File ID: $FILE_ID"

# Upload file
echo "Sample contract content" > contract.pdf
curl -X PUT --data-binary "@contract.pdf" "$UPLOAD_URL"

# Finalize
curl -X POST "http://localhost:8000/api/v1/files/${FILE_ID}/finalize" \
  -H "Authorization: Bearer $TOKEN"
```

### Step 3: Get User ID (for assigned_to)

```bash
# Get current user info (you'll need to implement GET /api/v1/auth/me or use the user_id from registration)
# For testing, use your actual user UUID
USER_ID="2c3c8ecf-e06b-45a3-8fef-55c9c5d6f3cd"  # Replace with actual UUID
```

### Step 4: Create Signature Field

```bash
# Create signature field at position (120, 540) on page 1
FIELD_RESPONSE=$(curl -s -X POST http://localhost:8000/api/v1/signatures/fields \
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

echo "$FIELD_RESPONSE" | jq '.'

FIELD_ID=$(echo $FIELD_RESPONSE | jq -r '.id')
echo "Field ID: $FIELD_ID"
```

### Step 5: List Signature Fields

```bash
# List all fields for the document
curl -s -X GET "http://localhost:8000/api/v1/signatures/fields?file_id=$FILE_ID" \
  -H "Authorization: Bearer $TOKEN" | jq '.'
```

### Step 6: Create Another Field (Different Page)

```bash
# Add signature field on page 2
curl -s -X POST http://localhost:8000/api/v1/signatures/fields \
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
  }" | jq '.'
```

### Step 7: Delete a Signature Field

```bash
# Delete the first field (only works if PENDING)
curl -s -X DELETE "http://localhost:8000/api/v1/signatures/fields/$FIELD_ID" \
  -H "Authorization: Bearer $TOKEN"

# Should return 204 No Content (empty response)
```

### Step 8: Verify Deletion

```bash
# List fields again - should see one less
curl -s -X GET "http://localhost:8000/api/v1/signatures/fields?file_id=$FILE_ID" \
  -H "Authorization: Bearer $TOKEN" | jq '.'
```

---

## 🔐 Security Features

✅ **Authentication Required**: All endpoints require valid JWT token

✅ **Ownership Enforcement**: 
- Only file owner can create/delete signature fields
- File owner can see all fields
- Assigned signer can see their assigned fields

✅ **Validation**:
- Page number must be >= 1
- Width and height must be > 0
- File must exist and be accessible
- Cannot delete already-signed fields

✅ **Cascade Deletion**:
- If file is deleted, all signature fields are automatically deleted
- If user is deleted, their assigned fields are deleted

---

## 🏗️ Architecture

```
app/modules/signatures/
├── __init__.py         # Module exports
├── models.py           # SQLAlchemy models
├── schemas.py          # Pydantic request/response schemas
├── repo.py             # Database operations
├── service.py          # Business logic & authorization
└── router.py           # API endpoints
```

### Clean Separation of Concerns:

**Router** (`router.py`)
- HTTP layer
- Request validation (Pydantic)
- Response formatting
- Auth dependency injection

**Service** (`service.py`)
- Business logic
- Authorization checks
- Validation rules
- Orchestration

**Repository** (`repo.py`)
- Pure database operations
- No business logic
- Async SQLAlchemy queries

**Models** (`models.py`)
- SQLAlchemy table definitions
- Database constraints
- Relationships

**Schemas** (`schemas.py`)
- Request validation
- Response serialization
- Field-level validation

---

## ⚡ Performance

- **Fast**: Pure database operations, no file I/O
- **Efficient**: Indexed queries on `file_id` and `assigned_to`
- **Scalable**: Async operations throughout
- **Clean**: No MinIO access, no PDF parsing

---

## ✅ Success Criteria

All criteria met:

✅ Existing upload flow still works (no regressions)  
✅ Signature fields can be created with coordinates  
✅ Signature fields can be listed for a document  
✅ Signature fields can be deleted (if PENDING)  
✅ Ownership is enforced correctly  
✅ Authorization rules work as expected  
✅ Database constraints prevent invalid data  
✅ API returns clear error messages  

---

## 🎯 Next Steps: Milestone E

**Milestone D is complete!** 

Ready for **Milestone E**: Actual PDF signing
- Apply digital signatures to PDFs
- Render signature images
- Validate existing signatures
- Update signature field status to SIGNED

---

## 📝 Notes

- This milestone is **metadata only** — no PDF files are modified
- Signature fields are just rectangles with coordinates
- Actual signing will be implemented in Milestone E
- All code follows existing project patterns
- No breaking changes to existing functionality
- Clean, typed, and well-documented code

---

**Status**: ✅ **MILESTONE D COMPLETE**  
**Date**: January 9, 2026  
**Version**: 0.1.0
