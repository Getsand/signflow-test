# Email Sending API Test - cURL Commands

## Prerequisites
- Backend running on `http://localhost:8000`
- Valid user account credentials
- A signing request in DRAFT status

## Step-by-Step cURL Commands

### Step 1: Login to Get JWT Token

```bash
curl -X POST "http://localhost:8000/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your-email@example.com",
    "password": "your-password"
  }'
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer"
}
```

**Save the token:**
```bash
TOKEN="your-access-token-here"
```

---

### Step 2: List Signing Requests

```bash
curl -X GET "http://localhost:8000/api/v1/signing-requests" \
  -H "Authorization: Bearer ${TOKEN}"
```

**Response:**
```json
[
  {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "title": "Contract Agreement",
    "status": "DRAFT",
    "filename": "contract.pdf",
    ...
  }
]
```

**Save the signing request ID:**
```bash
SIGNING_REQUEST_ID="123e4567-e89b-12d3-a456-426614174000"
```

---

### Step 3: Get Signing Request Detail (Optional - to verify recipients)

```bash
curl -X GET "http://localhost:8000/api/v1/signing-requests/${SIGNING_REQUEST_ID}" \
  -H "Authorization: Bearer ${TOKEN}"
```

**Response:**
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "status": "DRAFT",
  "recipients": [
    {
      "id": "...",
      "email": "signer1@example.com",
      "role": "Signer 1",
      "status": "PENDING"
    },
    {
      "id": "...",
      "email": "signer2@example.com",
      "role": "Signer 2",
      "status": "PENDING"
    }
  ],
  ...
}
```

---

### Step 4: Send Signing Request (Triggers Email Sending)

```bash
curl -X POST "http://localhost:8000/api/v1/signing-requests/${SIGNING_REQUEST_ID}/send" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json"
```

**Response:**
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "title": "Contract Agreement",
  "status": "SENT",
  "sent_at": "2026-01-28T11:30:00Z",
  "filename": "contract.pdf",
  ...
}
```

---

## Complete One-Liner Test

```bash
# Login and get token
TOKEN=$(curl -s -X POST "http://localhost:8000/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"your-email@example.com","password":"your-password"}' \
  | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)

# Get first DRAFT signing request ID
SIGNING_REQUEST_ID=$(curl -s -X GET "http://localhost:8000/api/v1/signing-requests" \
  -H "Authorization: Bearer ${TOKEN}" \
  | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)

# Send the signing request
curl -X POST "http://localhost:8000/api/v1/signing-requests/${SIGNING_REQUEST_ID}/send" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  | jq '.'
```

---

## Check Email Sending Status

### Check Backend Logs

```bash
# View recent logs
docker-compose logs backend --tail 50

# Filter for email-related logs
docker-compose logs backend | grep -i "email\|resend\|signing invitation"
```

### Expected Log Messages

**If RESEND_API_KEY is NOT set:**
```
WARNING: Email service not configured (RESEND_API_KEY missing). 
Would send invitation to signer@example.com for document 'Contract Agreement'
Signing URL: http://localhost:5173/sign/abc123...
```

**If RESEND_API_KEY is SET:**
```
INFO: Signing invitation email sent successfully to signer@example.com 
for document 'Contract Agreement' (Resend ID: re_abc123...)
```

---

## Troubleshooting

### Error: "Cannot send from SENT status"
- The signing request must be in DRAFT status
- Create a new signing request or use a different one

### Error: "Cannot send without recipients"
- Ensure the signing request has at least one recipient
- Check the signing request detail endpoint

### Error: "Cannot send without signature fields"
- Ensure the template has signature fields placed
- Go to Prepare page and add signature fields

### No emails received
- Check if `RESEND_API_KEY` is set in `.env`
- Check backend logs for email sending errors
- Verify `EMAIL_FROM` domain is verified in Resend
- Check spam folder

---

## Notes

- The endpoint requires authentication (JWT token)
- The signing request must be in DRAFT status
- Emails are sent to all recipients in the signing request
- Each recipient gets a unique signing token
- The signing request status changes from DRAFT → SENT after sending
