# SignFlo API Wrapper – cURL examples

**For the complete guide (run, API keys, workflow, and every response), see [API_GUIDE.md](API_GUIDE.md).**

Base URL: **http://127.0.0.1:9080**  
Start the wrapper with `run_hypercorn.bat` or `run_wrapper.bat` before running these.

---

## 1. Root (service info)

```bash
curl -X GET "http://127.0.0.1:9080/"
```

---

## 2. Ping (plain text check)

```bash
curl -X GET "http://127.0.0.1:9080/ping"
```

---

## 3. Health (wrapper health)

```bash
curl -X GET "http://127.0.0.1:9080/health"
```

---

## 4. API info (v1)

```bash
curl -X GET "http://127.0.0.1:9080/api/v1"
```

---

## 5. Backend health (proxy to SignFlo backend)

Proxies to your SignFlo backend `GET /health`. Backend must be running on port 8000.

```bash
curl -X GET "http://127.0.0.1:9080/api/v1/backend/health"
```

---

## All in one (copy-paste)

```bash
# Base URL
BASE="http://127.0.0.1:9080"

# 1. Root
curl -X GET "$BASE/"

# 2. Ping
curl -X GET "$BASE/ping"

# 3. Health
curl -X GET "$BASE/health"

# 4. API info
curl -X GET "$BASE/api/v1"

# 5. Backend health (needs SignFlo backend on :8000)
curl -X GET "$BASE/api/v1/backend/health"
```

---

## With verbose output

```bash
curl -v "http://127.0.0.1:9080/health"
```

---

## Windows (PowerShell)

```powershell
$base = "http://127.0.0.1:9080"
Invoke-RestMethod -Uri "$base/" -Method Get
Invoke-RestMethod -Uri "$base/ping" -Method Get
Invoke-RestMethod -Uri "$base/health" -Method Get
Invoke-RestMethod -Uri "$base/api/v1" -Method Get
Invoke-RestMethod -Uri "$base/api/v1/backend/health" -Method Get
```

---

---

## 6. Create API key (bootstrap with admin secret)

Set `ADMIN_SECRET` in `.env`, then create the first key (plain key returned once):

```bash
curl -X POST "http://127.0.0.1:9080/api/v1/keys" \
  -H "Content-Type: application/json" \
  -H "X-Admin-Secret: your-admin-secret" \
  -d '{"company_name":"My App","rate_limit_per_minute":60}'
```

Or with an existing API key:

```bash
curl -X POST "http://127.0.0.1:9080/api/v1/keys" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"company_name":"Another key","rate_limit_per_minute":120}'
```

---

## 7. List documents (requires API key)

```bash
curl -X GET "http://127.0.0.1:9080/api/v1/documents" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

---

## 8. Create document from URL (requires API key)

Upload a PDF from a URL; returns `template_id` for use in send.

```bash
curl -X POST "http://127.0.0.1:9080/api/v1/documents/upload-from-url" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"document_url":"https://example.com/doc.pdf","filename":"contract.pdf"}'
```

---

## 9. Send document for signature (requires API key)

Create envelope from `template_id` and send to recipients.

```bash
curl -X POST "http://127.0.0.1:9080/api/v1/documents/send" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "template_id":"<file_id from upload-from-url>",
    "title":"Contract",
    "signing_order":"SEQUENTIAL",
    "recipients":[{"role":"Signer 1","email":"signer@example.com","order_index":0}]
  }'
```

---

## 10. Get document (requires API key)

```bash
curl -X GET "http://127.0.0.1:9080/api/v1/documents/{document_id}" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

---

## 11. Download signed PDF (requires API key)

```bash
curl -X GET "http://127.0.0.1:9080/api/v1/documents/{document_id}/download" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -o signed.pdf
```

---

## Summary

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/` | No | Service info and links |
| GET | `/ping` | No | Plain text `pong` |
| GET | `/health` | No | Wrapper health JSON |
| GET | `/api/v1` | No | Public API info |
| GET | `/api/v1/backend/health` | No | Proxy to backend `/health` |
| POST | `/api/v1/keys` | API key or X-Admin-Secret | Create API key |
| GET | `/api/v1/documents` | API key | List documents (envelopes) |
| POST | `/api/v1/documents/upload-from-url` | API key | Create template from URL |
| POST | `/api/v1/documents/send` | API key | Send document for signature |
| GET | `/api/v1/documents/{id}` | API key | Get document |
| GET | `/api/v1/documents/{id}/download` | API key | Download signed PDF |

Use `Authorization: Bearer YOUR_API_KEY` or `X-API-Key: YOUR_API_KEY` for protected routes.
