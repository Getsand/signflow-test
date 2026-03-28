# Zoho Sign Compatible API Guide (SignFlo Wrapper)

This guide explains how to run the **Zoho Sign compatible wrapper** and call the **Zoho-shaped endpoints**.

## 1) Run the services

### Backend (SignFlo core)
From `signflow/backend`:

```powershell
cd "C:\Users\hi\Desktop\website signflow\signflow\backend"
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --loop asyncio
```

The backend loads `DATABASE_URL` and other settings from your `signflow/.env`.

### Wrapper (Zoho-compatible API layer)
From `signflow/signflo-api-wrapper`:

```powershell
cd "C:\Users\hi\Desktop\website signflow\signflow\signflo-api-wrapper"
python -m uvicorn app.main:app --host 127.0.0.1 --port 9080 --loop asyncio
```

You can also use the provided scripts:
- `run_wrapper.bat`
- `run_hypercorn.bat`

### Verify
Open in browser or curl:

```text
http://127.0.0.1:9080/health
http://127.0.0.1:9080/docs
```

## 2) Configure wrapper `.env`

Edit `signflo-api-wrapper/.env` and ensure:
- `BACKEND_BASE_URL` points to your running backend (default `http://127.0.0.1:8000`)
- `BACKEND_EMAIL` / `BACKEND_PASSWORD` belong to a real user in SignFlo
- `ADMIN_SECRET` is set (used only for wrapper API keys; SignFlo endpoints use SignFlo-oauthtoken)
- `FRONTEND_BASE_URL` (optional) controls the `sign_url` returned under `/actions/.../sign`

## 3) Zoho OAuth token

Endpoint:
`POST /oauth/v2/token`

Headers:
- `Content-Type: application/json`

Supported `grant_type`:
- `authorization_code`
- `refresh_token`

Example (authorization_code):

```powershell
$body = @{
  grant_type = "authorization_code"
  code = "dummy_code_from_zoho"
} | ConvertTo-Json

Invoke-RestMethod -Method Post `
  -Uri "http://127.0.0.1:9080/oauth/v2/token" `
  -ContentType "application/json" `
  -Body $body
```

Response fields:
`access_token`, `refresh_token`, `api_domain`, `token_type`, `expires_in`

## 4) Zoho Auth header (STRICT)

All Zoho wrapper endpoints require:

`Authorization: SignFlo-oauthtoken {access_token}`

## 5) Requests APIs

### 5.1 Create Request
`POST /api/v1/requests` with `multipart/form-data`

Form fields:
- `requests` (stringified JSON)
- `file` (PDF upload)

Zoho request JSON **must include signature box coordinates** in `requests.actions` (best-effort mapping):
- `pageNumber` (or `page`)
- `left`/`x` and `top`/`y`
- `width`
- `height`
- signer email (for role matching): `signerEmail` / `signer_email` / `email`

Example shape (you may need to adjust keys to your Zoho payload):

```json
{
  "signing_order": "SEQUENTIAL",
  "recipients": [
    { "role": "Signer 1", "email": "signer@example.com", "order_index": 0 }
  ],
  "actions": [
    {
      "type": "SIGN",
      "signerEmail": "signer@example.com",
      "pageNumber": 1,
      "left": 100,
      "top": 200,
      "width": 80,
      "height": 30
    }
  ]
}
```

If coordinates are missing, the wrapper returns:
`{ "code": 400, "message": "No signature field coordinates found..." }`

### 5.2 Send Request
`POST /api/v1/requests/{request_id}/send`

If SignFlo auto-sent on create, this wrapper returns success anyway (soft success for:
`Cannot send from SENT status`).

### 5.3 Get Request Details
`GET /api/v1/requests/{request_id}`

Response:
```json
{
  "code": 0,
  "requests": {
    "request_id": "...",
    "request_status": "...",
    "actions": [...],
    "recipients": [...]
  }
}
```

### 5.4 List Requests
`GET /api/v1/requests?page=1&per_page=10`

### 5.5 Delete Request
`DELETE /api/v1/requests/{request_id}`

### 5.6 Download PDF
`GET /api/v1/requests/{request_id}/pdf`

Returns `application/pdf`.

## 6) Actions APIs

### 6.1 List Actions
`GET /api/v1/requests/{request_id}/actions`

### 6.2 Sign URL for an Action
`GET /api/v1/requests/{request_id}/actions/{action_id}/sign`

Returns:
```json
{ "code": 0, "sign_url": "..." }
```

`sign_url` points to your existing SignFlo frontend route:
`{FRONTEND_BASE_URL}/sign/{token}`

## 7) Template APIs (note)

Zoho templates in this wrapper currently:
- `POST /api/v1/templates` uploads a PDF and creates a file/template in SignFlo.
- `POST /api/v1/templates/{template_id}/create_request` creates a signing request from that template.

Important limitation:
`create_request_from_template` relies on the template already having **signature fields** configured in SignFlo.
If you uploaded the template via this wrapper and did not add signature fields, the backend will refuse to send.

