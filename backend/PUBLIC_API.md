# SignFlo Public API Reference

Base URL: `http://127.0.0.1:8000` (or your server) → all paths below are under **`/api/v1`**.

-

## Complete wrapper – quick reference

| Auth | Method | Endpoint | Description |
|------|--------|----------|-------------|
| **None** | GET | `/health` | Server health |
| **None** | GET | `/api/v1` | Public API info (sections, auth, rate_limit) |
| **JWT** | POST | `/api/v1/auth/register` | Register user |
| **JWT** | POST | `/api/v1/auth/login` | Login → get `access_token` |
| **JWT** | POST | `/api/v1/api-keys` or `/api/v1/auth/api-keys` | Create API key → get `api_key` **once** |
| **JWT** | GET | `/api/v1/api-keys` | List API keys |
| **JWT** | DELETE | `/api/v1/api-keys/{key_id}` | Revoke API key |
| **API key** | GET | `/api/v1/documents` | List documents |
| **API key** | GET | `/api/v1/documents/types` | Get document types (Zoho-style) |
| **API key** | POST | `/api/v1/documents/presign` | Create document – presigned URL |
| **API key** | GET | `/api/v1/documents/{file_id}` | Get document |
| **API key** | PUT | `/api/v1/documents/{file_id}` | Manage document – update (rename) |
| **API key** | POST | `/api/v1/documents/{file_id}/finalize` | Finalize upload |
| **API key** | DELETE | `/api/v1/documents/{file_id}` | Delete document |
| **API key** | GET | `/api/v1/templates` | Get template list (Zoho-style) |
| **API key** | POST | `/api/v1/templates/presign` | Create template – presigned URL |
| **API key** | GET | `/api/v1/templates/{id}` | Get template |
| **API key** | PUT | `/api/v1/templates/{id}` | Update template (rename) |
| **API key** | POST | `/api/v1/templates/{id}/finalize` | Finalize template upload |
| **API key** | POST | `/api/v1/templates/{id}/fields` | Add field to template |
| **API key** | GET | `/api/v1/templates/{id}/fields` | List template fields |
| **API key** | GET | `/api/v1/field-types` | Retrieve field types (Zoho-style) |
| **API key** | GET | `/api/v1/users/me` | Retrieve current user (account details) |
| **API key** | GET | `/api/v1/users` | Retrieve users list (owner + invited) |
| **API key** | GET | `/api/v1/users/{user_id}` | Get user by ID |
| **API key** | POST | `/api/v1/users/invite` | Invite a user |
| **API key** | PUT | `/api/v1/users/{user_id}` | Update user (name) |
| **API key** | PUT | `/api/v1/users/{user_id}/access` | Update user access (enable/disable) |
| **API key** | PUT | `/api/v1/users/{user_id}/role` | Update user role |
| **API key** | DELETE | `/api/v1/users/{user_id}` | Delete user (invited only) |
| **API key** | GET | `/api/v1/requests` | List signing requests |
| **API key** | GET | `/api/v1/requests/stats` | Request counts by status |
| **API key** | POST | `/api/v1/requests` | Create signing request |
| **API key** | GET | `/api/v1/requests/{id}` | Get signing request |
| **API key** | POST | `/api/v1/requests/{id}/send` | Send request |
| **API key** | GET | `/api/v1/requests/{id}/download` | Download signed PDF |
| **API key** | DELETE | `/api/v1/requests/{id}` | Delete signing request |

- **JWT** = `Authorization: Bearer <access_token>` (from Login).
- **API key** = `Authorization: Bearer <api_key>` or `Authorization: ApiKey <api_key>` (from Create API key).
- **Rate limit:** per API key (default 60/min). Set `REDIS_URL` in `.env` to enable.
- **Response (documents/requests):** `{"code": 0, "message": "success", "data": ...}`.

**Minimal test flow:** Register → Login → Create API key (save `api_key`) → `GET /api/v1/documents` with `Authorization: Bearer <api_key>`.

---

## Zoho Sign–style operations (mapping)

SignFlo public API aligns with Zoho Sign operations where the backend supports them (no folders/document types in DB).

| Zoho Sign operation | SignFlo public API |
|---------------------|--------------------|
| **Document Management** | |
| Create document | `POST /documents/presign` → PUT file to URL → `POST /documents/{id}/finalize` |
| Manage document | `GET /documents/{id}`, `PUT /documents/{id}` (rename), `DELETE /documents/{id}` |
| Send documents for signature | `POST /requests` (create signing request from template file_id) |
| Get documents list | `GET /documents` |
| Get document type | `GET /documents/types` |
| Create document type | *Not implemented (no document-type entity in DB)* |
| Create new folder / Get folders list | *Not implemented (no folders in DB)* |
| **Template Management** | |
| Create template | `POST /templates/presign` → PUT file → `POST /templates/{id}/finalize` |
| Update template | `PUT /templates/{id}` (rename) |
| Send document for signature using template | `POST /requests` with `file_id` = template id |
| Get template list | `GET /templates` |
| Add field to template | `POST /templates/{id}/fields`; list with `GET /templates/{id}/fields` |
| **Field Type** | |
| Retrieve field type | `GET /field-types` |
| **User Management** | |
| Retrieve user account details | `GET /users/me` |
| Invite a user | `POST /users/invite` |
| Retrieve users list | `GET /users` |
| Update user (profile) | `PUT /users/{user_id}` |
| Update user access | `PUT /users/{user_id}/access` |
| Update user role | `PUT /users/{user_id}/role` |
| Delete user | `DELETE /users/{user_id}` (invited users only) |

---

## Wrapper completeness & `/docs`

The public API wrapper is implemented under `app/api` and is mounted at `/api/v1`. It provides:

- **API key auth** – Documents and Requests require `Authorization: Bearer <api_key>` (or `ApiKey <key>`).
- **Rate limiting** – Per API key (default 60/min); requires `REDIS_URL` in `.env` (if not set, limits are skipped).
- **Standard response** – `{"code": 0, "message": "success", "data": ...}` for documents/requests.

**In Swagger UI (`http://127.0.0.1:8000/docs`) you should see:**

| Tag / Section | Endpoints |
|---------------|-----------|
| **Public API** | `GET /api/v1` – this info |
| **api-keys** | `POST /api/v1/api-keys`, `GET /api/v1/api-keys`, `DELETE /api/v1/api-keys/{key_id}` |
| **documents** | `GET /documents`, `GET /documents/types`, presign, `{id}`, `PUT {id}`, finalize, delete |
| **templates** | `GET /templates`, presign, `{id}`, finalize, `PUT {id}`, `GET/POST {id}/fields` |
| **field-types** | `GET /field-types` |
| **users** | `GET /users/me`, `GET /users`, `GET /users/{id}`, `POST /users/invite`, `PUT /users/{id}`, `PUT /users/{id}/access`, `PUT /users/{id}/role`, `DELETE /users/{id}` |
| **requests** | `GET/POST /api/v1/requests`, stats, `{id}`, send, download, delete |
| **auth** | `POST /api/v1/auth/register`, `POST /api/v1/auth/login`, `POST /api/v1/auth/api-keys`, `GET /api/v1/auth/me` |

If **api-keys** (or documents/requests) do **not** appear in `/docs`:

1. **Check backend logs** – On startup you should see: `Public API (api_router) loaded: /api/v1/documents, /api/v1/requests, /api/v1/api-keys`. If you see `Public API (app.api) failed to load: ...`, the `app/api` package failed to import.
2. **Ensure `app/api` exists** – The folder `backend/app/api/` must exist with `__init__.py`, `router.py`, `deps.py`, `repo.py`, `schemas.py`, `models.py`, and `controllers/` (documents, requests, api_keys). If you use Docker, ensure the volume mounts the full backend (e.g. `./backend:/app`) and restart: `docker compose up -d --build backend`.
3. **Call `GET /api/v1`** – If the wrapper loaded, you get a short JSON summary. If it failed, you get `{"error": "Public API module failed to load", "detail": "..."}`.

---

## Authentication

### API key (for Documents & Requests)

Send your API key in the `Authorization` header:

- `Authorization: Bearer <your_api_key>`
- or `Authorization: ApiKey <your_api_key>`

Create API keys via **API key management** (JWT required). Each key is scoped to your account; all data is isolated by key owner.

### JWT (for API key management)

1. **Register:** `POST /api/v1/auth/register`  
   Body: `{ "email": "...", "password": "..." }`
2. **Login:** `POST /api/v1/auth/login`  
   Body: `{ "email": "...", "password": "..." }`  
   Response: `{ "access_token": "...", "token_type": "bearer" }`
3. Use the token: `Authorization: Bearer <access_token>`

---

## Response format

All public API (documents/requests) responses use this envelope:

```json
{
  "code": 0,
  "message": "success",
  "data": { ... }
}
```

- **Success:** `code === 0`, `data` contains the result.
- **Error:** `code` is HTTP-style (e.g. 400, 404, 500), `message` is the error description, `data` is `null`.

---

## Rate limiting

- Enforced **per API key**.
- Limit is configurable per key (default **60 requests per minute**).
- When exceeded: **429 Too Many Requests**.

---

# API key management (JWT required)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/api-keys` or `/api/v1/auth/api-keys` | Create API key (body: optional `name`, `rate_limit_per_minute`). Returns `api_key` **once**; store it securely. |
| `GET`  | `/api/v1/api-keys` | List your API keys (full key never returned). |
| `DELETE` | `/api/v1/api-keys/{key_id}` | Revoke an API key. |

**Postman:** Use **Bearer Token** auth and paste the `access_token` from Login. Do **not** use "JWT Bearer" with a Secret — that is for signing; send the token as `Authorization: Bearer <access_token>`.

### Create API key

**Request**

```http
POST /api/v1/api-keys
# Or: POST /api/v1/auth/api-keys  (same path as Login; use if the first returns 404)
Authorization: Bearer <access_token_from_login>
Content-Type: application/json

{
  "name": "My integration",
  "rate_limit_per_minute": 60
}
```

**Response (201)**

```json
{
  "id": "uuid",
  "key_prefix": "sk_live_xxxx…",
  "name": "My integration",
  "rate_limit_per_minute": 60,
  // "api_key": "sk_live_xxxxxxxxxxxxxxxxxxxxxxxx",
  "created_at": "2026-02-21T12:00:00Z"
}
```

---

# Documents (API key required)

Documents are files (templates/PDFs) owned by the API key’s account.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`  | `/api/v1/documents` | List all documents. |
| `GET`  | `/api/v1/documents/{file_id}` | Get document metadata and signature fields. |
| `POST` | `/api/v1/documents/presign` | Get presigned URL to upload a file. Then `PUT` file to that URL and call **finalize**. |
| `POST` | `/api/v1/documents/{file_id}/finalize` | Finalize upload after file is uploaded to presigned URL. |
| `DELETE` | `/api/v1/documents/{file_id}` | Delete a document. |

### List documents

**Request**

```http
GET /api/v1/documents
Authorization: Bearer <api_key>
```

**Response (200)**

```json
{
  "code": 0,
  "message": "success",
  "data": [
    {
      "id": "uuid",
      "filename": "contract.pdf",
      "status": "COMPLETED",
      "created_at": "2026-02-21T12:00:00Z"
    }
  ]
}
```

### Presign upload

**Request**

```http
POST /api/v1/documents/presign
Authorization: Bearer <api_key>
Content-Type: application/json

{
  "filename": "document.pdf",
  "mime_type": "application/pdf"
}
```

**Response (200)**

```json
{
  "code": 0,
  "message": "Upload URL generated. PUT file to upload_url then finalize.",
  "data": {
    "file_id": "uuid",
    "upload_url": "https://...",
    "storage_key": "uploads/uuid/document.pdf",
    "expires_in": 900
  }
}
```

Then: `PUT` the file to `upload_url`, then call `POST /api/v1/documents/{file_id}/finalize`.

### Get document

**Request**

```http
GET /api/v1/documents/{file_id}
Authorization: Bearer <api_key>
```

**Response (200)** – `data` includes file metadata and `signature_fields` array.

### Finalize document

**Request**

```http
POST /api/v1/documents/{file_id}/finalize
Authorization: Bearer <api_key>
```

**Response (200)** – `data` contains `id`, `filename`, `mime_type`, `size`, `status`.

### Delete document

**Request**

```http
DELETE /api/v1/documents/{file_id}
Authorization: Bearer <api_key>
```

**Response (200)** – `data`: `null`, `message`: `"Document deleted"`.

---

# User Management (API key required)

Zoho Sign–style user management: retrieve account, list users (owner + invited), invite, update profile/access/role, delete invited users. Requires the migration that adds `invited_by_id`, `is_active`, and `role` to the `users` table (`alembic upgrade head`).

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`  | `/api/v1/users/me` | Current user (API key owner) account details. |
| `GET`  | `/api/v1/users` | List users: current user and users they invited. |
| `GET`  | `/api/v1/users/{user_id}` | Get user by ID (only self or invited). |
| `POST` | `/api/v1/users/invite` | Invite a user (create account, send email with temp password). |
| `PUT`  | `/api/v1/users/{user_id}` | Update user name (self or invited). |
| `PUT`  | `/api/v1/users/{user_id}/access` | Update user access – enable/disable (invited users only). |
| `PUT`  | `/api/v1/users/{user_id}/role` | Update user role (e.g. `admin`, `member`). |
| `DELETE` | `/api/v1/users/{user_id}` | Delete user (invited users only; cannot delete self). |

### Get current user

**Request**

```http
GET /api/v1/users/me
Authorization: Bearer <api_key>
```

**Response (200)** – `data` includes `id`, `email`, `name`, `is_verified`, `is_active`, `role`, `invited_by_id`, `created_at`.

### List users

**Request**

```http
GET /api/v1/users
Authorization: Bearer <api_key>
```

**Response (200)** – `data` is an array of user objects (owner + users invited by the owner).

### Invite user

**Request**

```http
POST /api/v1/users/invite
Authorization: Bearer <api_key>
Content-Type: application/json

{
  "email": "newuser@example.com",
  "name": "New User"
}
```

**Response (201)** – User is created with a temporary password; if `RESEND_API_KEY` is set, an invite email is sent with login URL and temp password.

### Update user / access / role

- **PUT /users/{user_id}** – Body: `{ "name": "New Name" }`.
- **PUT /users/{user_id}/access** – Body: `{ "enabled": true }` or `{ "enabled": false }`. Only for invited users (not self).
- **PUT /users/{user_id}/role** – Body: `{ "role": "admin" }` or `{ "role": "member" }`.

### Delete user

**Request**

```http
DELETE /api/v1/users/{user_id}
Authorization: Bearer <api_key>
```

Only allowed for users that were invited by the current API key owner. Cannot delete your own account.

---

# Signing requests (API key required)

Signing requests are “envelopes” created from a document (template), with recipients and signature fields.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`  | `/api/v1/requests` | List all signing requests. |
| `GET`  | `/api/v1/requests/stats` | Get counts by status (total, draft, sent, in_progress, completed). |
| `POST` | `/api/v1/requests` | Create a signing request from a template file. |
| `GET`  | `/api/v1/requests/{signing_request_id}` | Get signing request details (recipients, fields). |
| `POST` | `/api/v1/requests/{signing_request_id}/send` | Send the request (DRAFT → SENT). |
| `GET`  | `/api/v1/requests/{signing_request_id}/download` | Download signed PDF (all signatures applied). |
| `DELETE` | `/api/v1/requests/{signing_request_id}` | Delete a signing request (template file is not deleted). |

### List signing requests

**Request**

```http
GET /api/v1/requests
Authorization: Bearer <api_key>
```

**Response (200)** – `data` is an array of signing request list items (`id`, `file_id`, `title`, `status`, `signing_order`, `created_at`, `updated_at`, `sent_at`, `completed_at`, `filename`, `file_status`).

### Get stats

**Request**

```http
GET /api/v1/requests/stats
Authorization: Bearer <api_key>
```

**Response (200)** – `data` contains counts, e.g. `total`, `draft`, `sent`, `in_progress`, `completed`.

### Create signing request

**Request**

```http
POST /api/v1/requests
Authorization: Bearer <api_key>
Content-Type: application/json

{
  "file_id": "uuid-of-template-file",
  "title": "Contract Q1",
  "signing_order": "SEQUENTIAL",
  "recipients": [
    { "role": "Signer 1", "email": "signer1@example.com", "order_index": 0 },
    { "role": "Signer 2", "email": "signer2@example.com", "order_index": 1 }
  ]
}
```

- `signing_order`: `"SEQUENTIAL"` or `"PARALLEL"`.
- Template roles must match `recipients[].role`.

**Response (201)** – `data` contains the created signing request (id, file_id, title, status, etc.).

### Get signing request

**Request**

```http
GET /api/v1/requests/{signing_request_id}
Authorization: Bearer <api_key>
```

**Response (200)** – `data` includes full request, `recipients`, `fields`, `total_signature_fields`, `signed_fields_count`.

### Send signing request

**Request**

```http
POST /api/v1/requests/{signing_request_id}/send
Authorization: Bearer <api_key>
```

**Response (200)** – `data` includes updated `signing_request`, `sent` (boolean), `failed_recipients` (list of emails that failed).

### Download signed PDF

**Request**

```http
GET /api/v1/requests/{signing_request_id}/download
Authorization: Bearer <api_key>
```

**Response (200)** – Binary PDF; `Content-Disposition: attachment; filename="..."`.

### Delete signing request

**Request**

```http
DELETE /api/v1/requests/{signing_request_id}
Authorization: Bearer <api_key>
```

**Response (200)** – `data`: `null`, `message`: `"Signing request deleted"`.

---

## Error responses

- **401 Unauthorized** – Missing or invalid API key / JWT.
- **403 Forbidden** – Valid key but no access to the resource.
- **404 Not Found** – Resource not found or not owned by the key’s account.
- **429 Too Many Requests** – Rate limit exceeded for the API key.

Error body (for public API endpoints):

```json
{
  "code": 404,
  "message": "File not found or access denied",
  "data": null
}
```

---

## Quick test (curl)

1. **Create user and login (get JWT):**
   ```bash
   curl -X POST http://localhost:8000/api/v1/auth/register -H "Content-Type: application/json" -d '{"email":"you@example.com","password":"yourpassword"}'
   curl -X POST http://localhost:8000/api/v1/auth/login  -H "Content-Type: application/json" -d '{"email":"you@example.com","password":"yourpassword"}'
   ```
2. **Create API key (use the `access_token` from login):**
   ```bash
   curl -X POST http://localhost:8000/api/v1/api-keys -H "Authorization: Bearer <access_token>" -H "Content-Type: application/json" -d '{"name":"Test","rate_limit_per_minute":60}'
   ```
3. **Call public API (use the `api_key` from step 2):**
   ```bash
   curl -X GET http://localhost:8000/api/v1/documents -H "Authorization: Bearer <api_key>"
   ```

Replace `localhost:8000` with your server URL.

---

## Automated tests

From the backend directory, with dependencies installed:

```bash
pip install -r requirements.txt
python -m pytest app/tests/test_public_api.py -v
```

Tests verify: 401 without API key/JWT, 200 with valid API key, standardized response shape, and API key creation with JWT.
