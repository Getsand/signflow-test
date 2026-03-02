# SignFlo Public API – Postman

Use these files to test the full API wrapper in Postman.

## Why “socket hang up” happens (and how it’s fixed)

**Cause:** If `DATABASE_URL` or `REDIS_URL` were missing, the app crashed on startup before binding to the port. Postman then saw “socket hang up” because nothing was listening (or the connection was closed).

**What we did:**
1. The app can start even when `DATABASE_URL`/`REDIS_URL` are missing (so `/health` can respond).
2. `.env` is loaded at startup from the backend folder so the server finds it no matter where you run uvicorn from.
3. **You must have a `.env`** in the backend folder with at least `DATABASE_URL` and `REDIS_URL` for Register, Login, and the rest of the API to work. Copy `ENV_TEMPLATE.txt` to `.env` and set those.

**Running with Docker (typical setup):** The app runs in Docker. Use `docker compose restart backend` after code changes. Keep `postgres` and `redis` in `.env` (they resolve in the compose network). From your PC use `http://127.0.0.1:8000/health` (or the port your compose exposes). In Postman set `base_url` to that. If you get "socket hang up", run `docker compose logs backend`; turn off Postman proxy (Settings → Proxy) and retry.

**Check the server is up (when not using Docker):** From the backend folder run `uvicorn app.main:app --host 127.0.0.1 --port 8000`. You should see “Application startup complete”. Then call `http://127.0.0.1:8000/health` in Postman or a browser; you should get JSON. If you still get “socket hang up”, turn off Postman proxy (Settings → Proxy → “Use proxy” off) and try again.

**Without Docker:** Only if you run the server on your machine (e.g. `uvicorn`), use `localhost` in `DATABASE_URL` and `REDIS_URL` instead of `postgres`/`redis`.

## Import in Postman

1. Open Postman.
2. **Import collection:** Click **Import** → choose `SignFlo_Public_API.postman_collection.json`.
3. (Optional) **Import environment:** Import → choose `SignFlo_Local.postman_environment.json` → select **SignFlo Local** in the environment dropdown.

The collection already has variables (`base_url`, `jwt_token`, `api_key`, etc.). You can use the collection as-is or use the environment to override `base_url` (e.g. `http://localhost:8000` or your server URL).

## How to test (order of requests)

### 1. Auth (get JWT)

- **Health Check** – Run this first. Confirms the server is reachable (GET /health). If this fails or you get “socket hang up” on Register, start the backend and use `base_url` **http://127.0.0.1:8000** (default). In Postman: Settings → General → increase **Request timeout in ms** (e.g. 60000).
- **Register** – Create a user (use same email/password in Login).
- **Login** – Saves `access_token` into the collection variable `jwt_token` automatically.

Update the body in Register/Login if you want a different email/password.

### 2. API Keys (create key for public API)

- **Create API Key** – The collection uses **`{{base_url}}/api/v1/auth/api-keys`** so it works even when the Public API module is not loaded (avoids 404).
  - **Auth:** Use **Bearer Token** (not "JWT Bearer"). In the Token field put **`{{jwt_token}}`** or paste the **access_token** from the Login response. Do **not** use "JWT Bearer" with a Secret — that signs a new JWT; we need to *send* the token you got from Login.
  - **Body:** raw JSON, e.g. `{"name": "Postman test key", "rate_limit_per_minute": 60}`.
  - **If you still get 404:** Ensure `base_url` is only the origin (e.g. `http://127.0.0.1:8000`). Re-import the collection to get the latest URL.
- **List API Keys** – See your keys (full key is not shown again).
- **Revoke API Key** – Deletes the key whose id is in `key_id`.

### 3. Documents (all use API key)

- **List Documents** – Gets your documents; first document’s `id` saved to `file_id`.
- **Get Document Types** – Supported document types (Zoho-style: PDF, PNG, JPEG).
- **Get Document** – Get one document by `file_id`.
- **Presign Upload** – Get upload URL; response sets `file_id`. PUT file to `upload_url`, then **Finalize Document**.
- **Finalize Document** – Call after uploading file to the presigned URL.
- **Update Document** – Rename document (body: `{"filename": "new.pdf"}`).
- **Delete Document** – Delete document by `file_id`.

### 4. Templates (all use API key; Zoho-style)

- **List Templates** – Same as documents list; first item’s `id` can set `file_id`.
- **Get Template** – Get template (document) by `file_id`.
- **Presign Template** – Get upload URL for new template; then PUT file and **Finalize Template**.
- **Finalize Template** – After uploading file to presigned URL.
- **Update Template** – Rename template (body: `{"filename": "new.pdf"}`).
- **Add Template Field** – Add signature field (page, x, y, width, height, field_type, role).
- **List Template Fields** – List fields on template.

### 5. Field Types (API key)

- **Get Field Types** – Supported field types (SIGNATURE, INITIAL, DATE, TEXT, etc.).

### 6. Users (API key; Zoho Sign–style user management)

Requires the user-management migration (`alembic upgrade head` adds `invited_by_id`, `is_active`, `role` to `users`).

- **Get Current User (me)** – Account details for the API key owner.
- **List Users** – Owner plus users they invited; first user’s `id` saved to `user_id`.
- **Get User by ID** – Get a user by `user_id` (self or invited only).
- **Invite User** – Create user and send invite email (body: `{"email": "...", "name": "..."}`). Requires `RESEND_API_KEY` for email.
- **Update User** – Update name (body: `{"name": "..."}`).
- **Update User Access** – Enable/disable user (body: `{"enabled": true}` or `false`). Invited users only.
- **Update User Role** – Set role (body: `{"role": "member"}` or `"admin"`).
- **Delete User** – Delete invited user by `user_id` (cannot delete self).

### 7. Requests (all use API key)

- **List Signing Requests** – Lists requests; first request’s `id` is saved to `signing_request_id`.
- **Get Request Stats** – Counts by status.
- **Create Signing Request** – Uses `file_id` (template). Set `recipients` in the body; response sets `signing_request_id`.
- **Get Signing Request** – Get one request by `signing_request_id`.
- **Send Signing Request** – Send the request (DRAFT → SENT).
- **Download Signed PDF** – Download PDF; save response as file in Postman if needed.
- **Delete Signing Request** – Delete by `signing_request_id`.

## Variables (collection / environment)

| Variable             | Set by                    | Used in                          |
|----------------------|---------------------------|----------------------------------|
| `base_url`           | You (default: localhost:8000) | All requests                     |
| `jwt_token`          | Login                     | API Keys folder                  |
| `api_key`            | Create API Key            | Documents, Requests              |
| `file_id`            | List Documents / Presign / List Templates / Presign Template | Get Document, Finalize, Update, Delete; Templates; Create Signing Request |
| `signing_request_id` | List Requests / Create    | Get, Send, Download, Delete Request |
| `key_id`             | Create API Key            | Revoke API Key                   |

## 404 "Not Found" on Create API Key

If you get `{"detail": "Not Found"}` on **Create API Key**:

1. **Use the full path including `/api/v1`.** The URL must be:
   - `http://127.0.0.1:8000/api/v1/api-keys` (or your host/port + `/api/v1/api-keys`).
2. **Do not add a trailing slash** (e.g. not `/api/v1/api-keys/`).
3. **Check `base_url` in Postman:** It must be only the origin, e.g. `http://127.0.0.1:8000`. If you set it to `http://127.0.0.1:8000/api/v1`, the request URL becomes wrong and returns 404.
4. **Confirm the route exists:** Open `http://127.0.0.1:8000/docs` and look for **POST /api/v1/api-keys**. If it’s missing, restart the backend (e.g. `docker compose restart backend`) so the latest code is loaded.

## Quick run (Runner)

1. Select the collection **SignFlo Public API**.
2. Run **Auth > Login** then **API Keys > Create API Key** so `jwt_token` and `api_key` are set.
3. Run **Documents**, **Templates**, **Field Types**, or **Requests** to test endpoints with the API key.

If you use an environment, set **SignFlo Local** (or your env) before running.
