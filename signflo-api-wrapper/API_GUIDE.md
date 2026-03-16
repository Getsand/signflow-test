# SignFlo API Wrapper – Complete Guide

This guide explains how to **run** the wrapper, **create and use API keys**, and **test every API** with cURL and expected responses. No code changes required.

---

## Table of contents

1. [How to run](#1-how-to-run)
2. [How to get an API key](#2-how-to-get-an-api-key)
3. [Where to use the API key](#3-where-to-use-the-api-key)
4. [Complete workflow (end-to-end)](#4-complete-workflow-end-to-end)
5. [All APIs – cURL and responses](#5-all-apis--curl-and-responses)
6. [Quick reference](#6-quick-reference)

---

## 1. How to run

### Prerequisites

- Python 3.8+ with `pip`
- SignFlo backend running on port **8000** (for document/signing APIs)
- Terminal (CMD, PowerShell, or Git Bash) and optionally a browser for `/docs`

### Step 1: Install dependencies

From the **signflo-api-wrapper** folder:

```bash
cd signflo-api-wrapper
pip install -r requirements.txt
```

### Step 2: Configure environment

1. Copy the example env file:

   ```bash
   copy .env.example .env
   ```

   (On Linux/Mac: `cp .env.example .env`)

2. Edit `.env` and set at least:

   | Variable | Required for | Description |
   |----------|--------------|-------------|
   | `BACKEND_BASE_URL` | All | SignFlo backend URL, e.g. `http://127.0.0.1:8000` |
   | `BACKEND_EMAIL` | Document APIs | A user that exists in your SignFlo app (e.g. you registered) |
   | `BACKEND_PASSWORD` | Document APIs | That user’s password |
   | `ADMIN_SECRET` | First API key | Any secret string; you’ll send it as `X-Admin-Secret` to create the first key |

   Create the backend user in your SignFlo website (register or admin) and use that email/password here.

### Step 3: Start SignFlo backend

Start your main SignFlo app so it listens on **port 8000**.  
(How you do this depends on your project; e.g. run the backend server from the `signflow` folder.)

### Step 4: Start the API wrapper

From the **signflo-api-wrapper** folder:

- **Windows:** double‑click `run_hypercorn.bat` or `run_wrapper.bat`, or in CMD:
  ```bash
  run_hypercorn.bat
  ```
- **Manual (any OS):**
  ```bash
  cd signflo-api-wrapper
  python -m uvicorn app.main:app --host 127.0.0.1 --port 9080
  ```

The wrapper will listen on **http://127.0.0.1:9080**.

### Verify it’s running

- Browser: open **http://127.0.0.1:9080/health**
- Or in terminal:

  ```bash
  curl http://127.0.0.1:9080/health
  ```

  You should see something like: `{"status":"healthy","service":"signflo-api-wrapper"}`

---

## 2. How to get an API key

You need at least one API key to call document and key-creation APIs.

### First API key (bootstrap)

Use this when you don’t have any API key yet.

1. In `.env`, set:
   ```env
   ADMIN_SECRET=my-secret-string-123
   ```
2. Restart the wrapper if it was already running.
3. Call **POST /api/v1/keys** with the header **X-Admin-Secret: my-secret-string-123** (same value as in `.env`).

Example:

```bash
curl -X POST "http://127.0.0.1:9080/api/v1/keys" ^
  -H "Content-Type: application/json" ^
  -H "X-Admin-Secret: my-secret-string-123" ^
  -d "{\"company_name\":\"My App\",\"rate_limit_per_minute\":60}"
```

(Linux/Mac: use `\` instead of `^` and single quotes for the JSON.)

**Response (201):**

```json
{
  "api_key": "sf_live_AbCdEfGhIjKlMnOpQrStUvWxYz123456",
  "key_prefix": "sf_live_...56",
  "company_name": "My App",
  "rate_limit_per_minute": 60
}
```

- **Save the `api_key` value.** It is shown only once. Use it as `YOUR_API_KEY` in the next section.
- You can use `api_key` in **Authorization: Bearer …** or **X-API-Key: …** for all protected APIs.

### More API keys (when you already have one)

Use your existing API key to create more keys (e.g. for different apps or teams).

```bash
curl -X POST "http://127.0.0.1:9080/api/v1/keys" ^
  -H "Content-Type: application/json" ^
  -H "Authorization: Bearer YOUR_EXISTING_API_KEY" ^
  -d "{\"company_name\":\"Other App\",\"rate_limit_per_minute\":120}"
```

Same response shape: you get a new `api_key` (plain key) once; store it securely.

---

## 3. Where to use the API key

Use the API key on **every request** to protected endpoints.

**Option A – Bearer (recommended)**

```text
Authorization: Bearer YOUR_API_KEY
```

**Option B – Custom header**

```text
X-API-Key: YOUR_API_KEY
```

**Endpoints that need the API key**

- `POST /api/v1/keys` (when creating a key with an existing API key; bootstrap uses `X-Admin-Secret` instead)
- `GET /api/v1/documents`
- `POST /api/v1/documents/upload-from-url`
- `POST /api/v1/documents/send`
- `GET /api/v1/documents/{document_id}`
- `GET /api/v1/documents/{document_id}/download`

**Endpoints that do NOT need the API key**

- `GET /`
- `GET /ping`
- `GET /health`
- `GET /api/v1`
- `GET /api/v1/backend/health`
- `GET /docs`, `GET /openapi.json`

---

## 4. Complete workflow (end-to-end)

High-level flow:

1. **Run** backend (8000) and wrapper (9080), configure `.env`.
2. **Create first API key** with `X-Admin-Secret` (see [How to get an API key](#2-how-to-get-an-api-key)).
3. **Upload a document** from a URL → you get a `template_id`.
4. **Send for signature** using `template_id` and recipients → you get a `document_id`.
5. **List or get document** to see status.
6. **Download** the signed PDF when the document is completed.

Details and example cURLs are in [Section 5](#5-all-apis--curl-and-responses).

---

## 5. All APIs – cURL and responses

Base URL for all examples: **http://127.0.0.1:9080**  
Replace `YOUR_API_KEY` with your real API key.  
On Windows in CMD, use `^` for line continuation; in PowerShell use `` ` ``; in Bash use `\`.

---

### 5.1 System (no API key)

#### GET / – Service info

**Request:**

```bash
curl -X GET "http://127.0.0.1:9080/"
```

**Response (200):**

```json
{
  "service": "signflo-api-wrapper",
  "health": "http://127.0.0.1:9080/health",
  "docs": "http://127.0.0.1:9080/docs"
}
```

---

#### GET /ping – Plain text check

**Request:**

```bash
curl -X GET "http://127.0.0.1:9080/ping"
```

**Response (200):** body is the plain text: `pong`

---

#### GET /health – Wrapper health

**Request:**

```bash
curl -X GET "http://127.0.0.1:9080/health"
```

**Response (200):**

```json
{
  "status": "healthy",
  "service": "signflo-api-wrapper"
}
```

---

#### GET /api/v1 – API info

**Request:**

```bash
curl -X GET "http://127.0.0.1:9080/api/v1"
```

**Response (200):**

```json
{
  "name": "SignFlo Public API",
  "version": "v1",
  "docs": "/docs",
  "backend": "http://127.0.0.1:8000"
}
```

---

#### GET /api/v1/backend/health – Backend health (proxy)

**Request:**

```bash
curl -X GET "http://127.0.0.1:9080/api/v1/backend/health"
```

**Response (200)** when backend is up:

```json
{
  "backend_status": 200,
  "backend_response": { ... }
}
```

**Response** when backend is down or unreachable: `backend_status` will indicate error and there may be a `detail` message.

---

### 5.2 Create API key (bootstrap or with existing key)

#### POST /api/v1/keys – Create API key

**Bootstrap (first key)** – use `X-Admin-Secret` (no API key):

```bash
curl -X POST "http://127.0.0.1:9080/api/v1/keys" ^
  -H "Content-Type: application/json" ^
  -H "X-Admin-Secret: my-secret-string-123" ^
  -d "{\"company_name\":\"My App\",\"rate_limit_per_minute\":60}"
```

**With existing API key:**

```bash
curl -X POST "http://127.0.0.1:9080/api/v1/keys" ^
  -H "Content-Type: application/json" ^
  -H "Authorization: Bearer YOUR_API_KEY" ^
  -d "{\"company_name\":\"Another key\",\"rate_limit_per_minute\":120}"
```

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| company_name | string | No | Label for the key (e.g. app name) |
| rate_limit_per_minute | number | No | Default 60; max requests per minute for this key |

**Response (201):**

```json
{
  "api_key": "sf_live_AbCdEfGhIjKlMnOpQrStUvWxYz123456",
  "key_prefix": "sf_live_...56",
  "company_name": "My App",
  "rate_limit_per_minute": 60
}
```

- **Save `api_key`**; it is not returned again. Use it in `Authorization: Bearer ...` or `X-API-Key: ...`.

**Error (401):** Missing or invalid API key / wrong or missing `X-Admin-Secret` for bootstrap.

---

### 5.3 Documents (all require API key)

Use `Authorization: Bearer YOUR_API_KEY` or `X-API-Key: YOUR_API_KEY` on every request below.

---

#### GET /api/v1/documents – List documents (envelopes)

**Request:**

```bash
curl -X GET "http://127.0.0.1:9080/api/v1/documents" ^
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Response (200):** JSON array of signing requests (envelopes). Example:

```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "file_id": "660e8400-e29b-41d4-a716-446655440001",
    "title": "Contract",
    "status": "SENT",
    "signing_order": "SEQUENTIAL",
    "created_at": "2025-02-20T10:00:00",
    "updated_at": "2025-02-20T10:05:00",
    "sent_at": "2025-02-20T10:05:00",
    "completed_at": null,
    "filename": "contract.pdf",
    "file_status": "COMPLETED"
  }
]
```

If there are none, you get: `[]`

---

#### POST /api/v1/documents/upload-from-url – Create document (template) from URL

Uploads a PDF from a public URL and creates a template. Use the returned **template_id** in “Send document”.

**Request:**

```bash
curl -X POST "http://127.0.0.1:9080/api/v1/documents/upload-from-url" ^
  -H "Content-Type: application/json" ^
  -H "Authorization: Bearer YOUR_API_KEY" ^
  -d "{\"document_url\":\"https://example.com/sample.pdf\",\"filename\":\"contract.pdf\"}"
```

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| document_url | string (URL) | Yes | Public URL of the PDF |
| filename | string | No | Filename to use (default derived from URL) |

**Response (201):**

```json
{
  "template_id": "660e8400-e29b-41d4-a716-446655440001",
  "filename": "contract.pdf"
}
```

- Use **template_id** in the next step as `template_id`.

**Errors:** 400 (bad URL, fetch failed, file too large), 401 (invalid API key), 502 (upload/finalize failed).

---

#### POST /api/v1/documents/send – Send document for signature

Creates an envelope from a template and sends it to recipients. Returns **document_id** for list/get/download.

**Request:**

```bash
curl -X POST "http://127.0.0.1:9080/api/v1/documents/send" ^
  -H "Content-Type: application/json" ^
  -H "Authorization: Bearer YOUR_API_KEY" ^
  -d "{\"template_id\":\"660e8400-e29b-41d4-a716-446655440001\",\"title\":\"Contract\",\"signing_order\":\"SEQUENTIAL\",\"recipients\":[{\"role\":\"Signer 1\",\"email\":\"signer@example.com\",\"order_index\":0}]}"
```

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| template_id | string (UUID) | Yes | From upload-from-url response |
| title | string | No | Envelope title |
| signing_order | string | No | `SEQUENTIAL` or `PARALLEL` (default `SEQUENTIAL`) |
| recipients | array | Yes | At least one recipient |
| recipients[].role | string | Yes | e.g. "Signer 1" |
| recipients[].email | string | Yes | Signer email |
| recipients[].order_index | number | No | 0-based order (default 0) |

**Response (201):**

```json
{
  "document_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "SENT",
  "sent": true,
  "failed_recipients": []
}
```

- Use **document_id** for GET document and GET download.

**Errors:** 400 (invalid template_id or body), 401 (invalid API key), 429 (rate limit).

---

#### GET /api/v1/documents/{document_id} – Get one document

**Request:**

```bash
curl -X GET "http://127.0.0.1:9080/api/v1/documents/550e8400-e29b-41d4-a716-446655440000" ^
  -H "Authorization: Bearer YOUR_API_KEY"
```

Replace `550e8400-e29b-41d4-a716-446655440000` with your real document_id (UUID).

**Response (200):** JSON with full envelope details (metadata, file info, recipients, fields, etc.). Example shape:

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "file_id": "660e8400-e29b-41d4-a716-446655440001",
  "title": "Contract",
  "status": "SENT",
  "signing_order": "SEQUENTIAL",
  "created_at": "...",
  "updated_at": "...",
  "sent_at": "...",
  "completed_at": null,
  "filename": "contract.pdf",
  "recipients": [ ... ],
  "fields": [ ... ],
  ...
}
```

**Errors:** 401 (invalid API key), 404 (document not found).

---

#### GET /api/v1/documents/{document_id}/download – Download signed PDF

Returns the signed PDF (when the envelope is completed). If not yet completed, backend may return an error.

**Request:**

```bash
curl -X GET "http://127.0.0.1:9080/api/v1/documents/550e8400-e29b-41d4-a716-446655440000/download" ^
  -H "Authorization: Bearer YOUR_API_KEY" ^
  -o signed.pdf
```

**Response (200):** Binary PDF. With `-o signed.pdf` the file is saved as `signed.pdf`.

**Errors:** 401 (invalid API key), 404 (document not found or not ready).

---

## 6. Quick reference

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| GET | `/` | No | Service info |
| GET | `/ping` | No | Plain "pong" |
| GET | `/health` | No | Wrapper health |
| GET | `/api/v1` | No | API info |
| GET | `/api/v1/backend/health` | No | Backend health proxy |
| POST | `/api/v1/keys` | X-Admin-Secret (first key) or Bearer API key | Create API key |
| GET | `/api/v1/documents` | Bearer or X-API-Key | List documents |
| POST | `/api/v1/documents/upload-from-url` | Bearer or X-API-Key | Create template from URL → template_id |
| POST | `/api/v1/documents/send` | Bearer or X-API-Key | Send for signature → document_id |
| GET | `/api/v1/documents/{id}` | Bearer or X-API-Key | Get document |
| GET | `/api/v1/documents/{id}/download` | Bearer or X-API-Key | Download signed PDF |

**Auth header:** `Authorization: Bearer YOUR_API_KEY` or `X-API-Key: YOUR_API_KEY`  
**Rate limit:** Per API key (default 60/min). 429 when exceeded.  
**Interactive docs:** http://127.0.0.1:9080/docs

---

## One-shot test script (copy-paste)

Set your API key and (for the first key) admin secret, then run from the same machine. Adjust the document URL if needed.

```bash
set BASE=http://127.0.0.1:9080
set ADMIN_SECRET=my-secret-string-123

REM 1) Health
curl -s %BASE%/health

REM 2) Create first API key (use the api_key from response in next steps)
curl -s -X POST "%BASE%/api/v1/keys" -H "Content-Type: application/json" -H "X-Admin-Secret: %ADMIN_SECRET%" -d "{\"company_name\":\"Test\",\"rate_limit_per_minute\":60}"

REM 3) Set the key you got (replace with actual value)
set API_KEY=sf_live_xxxx

REM 4) List documents
curl -s -X GET "%BASE%/api/v1/documents" -H "Authorization: Bearer %API_KEY%"

REM 5) Upload from URL (use a real PDF URL)
curl -s -X POST "%BASE%/api/v1/documents/upload-from-url" -H "Content-Type: application/json" -H "Authorization: Bearer %API_KEY%" -d "{\"document_url\":\"https://www.w3.org/WAI/WCAG21/Techniques/pdf/img/table-word.pdf\",\"filename\":\"sample.pdf\"}"

REM 6) Send for signature (replace TEMPLATE_ID with template_id from step 5)
REM curl -s -X POST "%BASE%/api/v1/documents/send" -H "Content-Type: application/json" -H "Authorization: Bearer %API_KEY%" -d "{\"template_id\":\"TEMPLATE_ID\",\"title\":\"Test\",\"recipients\":[{\"role\":\"Signer 1\",\"email\":\"you@example.com\",\"order_index\":0}]}"
```

For Bash (Linux/Mac), use `export BASE=...`, `export API_KEY=...`, and `$BASE` / `$API_KEY` instead of `%BASE%` / `%API_KEY%`.

This completes the guide: how to run, how to get and use API keys, and how to run and test all APIs with cURL and expected responses.
