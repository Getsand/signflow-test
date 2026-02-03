# SignFlow — Complete Workflow & API Reference

**For junior developers:** This document explains the full project workflow from signup to downloading a signed PDF, plus all APIs and how they fit together. No code changes—reference only.

---

## 1. Project Overview

SignFlow is a Zoho Sign–style e-signature platform:

- **Document owner** uploads a PDF (template), adds recipients, places signature/date/text fields, then creates and sends a signing request.
- **Signers** receive an email with a link; they open it (no login), sign their fields, and complete.
- **Owner** can view document status and download the final signed PDF.

**Stack:**

- **Backend:** Python, FastAPI, PostgreSQL (async), MinIO (PDF storage), Resend (email).
- **Frontend:** React, Vite, TypeScript, Tailwind. Axios for API calls; JWT in `Authorization` header for protected routes.

---

## 2. Complete User Workflow (Signup → Signed PDF Download)

### Step 1 — Sign up & Log in

| Step | Where | What happens |
|------|--------|----------------|
| Sign up | `/signup` | User enters email + password. Frontend calls `POST /api/v1/auth/register`. Backend creates user, returns user object. |
| Log in | `/login` | User enters email + password. Frontend calls `POST /api/v1/auth/login`. Backend returns `access_token`. Frontend stores token (e.g. localStorage) and uses it for all later API calls. |

After login, user is redirected to `/dashboard` (or the app’s default).

---

### Step 2 — Create a Template (Upload PDF)

| Step | Where | What happens |
|------|--------|----------------|
| Upload | `/upload` or **Templates** → **Add Template** | User selects a PDF. Frontend calls `POST /api/v1/files/presign` with filename/size → gets a **presigned upload URL**. Frontend uploads the file **directly to MinIO** with that URL. |
| Finalize | (same flow) | After upload, frontend calls `POST /api/v1/files/{file_id}/finalize` so backend marks the file as COMPLETED and stores size. |
| List templates | `/templates` | Frontend calls `GET /api/v1/files`. Backend returns files owned by the user (filtered by status in UI: e.g. UPLOADING, COMPLETED). Shown as list with name, status, uploaded time. |

**Important:** Files listed on **Templates** are the same as in `GET /api/v1/files`; “templates” = PDFs that are not yet locked (DRAFT/READY). Same API, different page.

---

### Step 3 — Add Recipients (Roles + Emails)

| Step | Where | What happens |
|------|--------|----------------|
| Choose template | `/templates` → **Use Template** or **prepare** | User clicks “Use Template” → goes to **Send for Signature** (step 5). Or clicks “prepare” → **Add Recipients** first. |
| Add recipients | `/templates/:file_id/recipients` | User adds “Me” and/or “Signer 1”, “Signer 2”, etc., with emails. **No API call yet**—only frontend state. |
| Next | **Next: Prepare** button | Navigates to `/templates/:file_id/prepare` with recipients in route state. |

Recipients are passed in memory (e.g. `location.state.recipients`) to the Prepare page and later to “Send for Signature”.

---

### Step 4 — Prepare Document (Place Fields on PDF)

| Step | Where | What happens |
|------|--------|----------------|
| Open prepare | `/templates/:file_id/prepare` | Frontend loads file with `GET /api/v1/files/{file_id}`, PDF URL with `GET /api/v1/files/{file_id}/view-url`, and existing fields with `GET /api/v1/signatures/fields?file_id=...`. |
| Place fields | Same page | User selects a recipient (Me, Signer 1, …), then a field type (Signature, Initial, Date, Full name, Email, Text, Company). User draws a rectangle on the PDF. Frontend calls `POST /api/v1/signatures/fields` with file_id, page, x, y, width, height, field_type, assigned_to (current user id), role (e.g. "Signer 1"). |
| Delete field | Same page | User clicks red X on a field. Frontend calls `DELETE /api/v1/signatures/fields/{field_id}`. |
| Next | **Next: Add Signers** | Navigates to `/signing-requests/new/:template_id` with recipients (and optionally expectedSignerCount) in state. |

Field types (e.g. SIGNATURE, INITIAL, DATE, TEXT, FULLNAME, EMAIL, COMPANY) are stored in the backend; frontend sends `field_type` and `role` per field.

---

### Step 5 — Create Signing Request & Send

| Step | Where | What happens |
|------|--------|----------------|
| Send for signature | `/signing-requests/new/:template_id` | User sees template name, document title, signature field count. User enters/confirms recipients (role + email) and signing order (Sequential / Parallel). |
| Create request | Same page → **Create** (or similar) | Frontend calls `POST /api/v1/signing-requests` with file_id (template), title, signing_order, recipients (role, email, order_index). Backend creates a **signing request** (DRAFT), creates **signing_request_recipients** and **signing_request_fields** (from template signature fields). **One template can be used many times** (multiple signing requests per file_id). |
| Send | Same page → **Send** (after create) or from Documents | Frontend calls `POST /api/v1/signing-requests/{id}/send`. Backend generates a **signing token** per recipient, sends emails (e.g. via Resend) with link `{FRONTEND_URL}/sign/:token`, and marks the request as SENT (if at least one email succeeds). |

Signing request status flow: **DRAFT → SENT → IN_PROGRESS → COMPLETED**.

---

### Step 6 — Signer Signs (No Login)

| Step | Where | What happens |
|------|--------|----------------|
| Open link | Email link → `/sign/:token` | **Public route** (no auth). Frontend calls `GET /api/v1/signing/by-token/{token}`. Backend validates token, returns recipient, signing request, **PDF view URL**, and **fields for this recipient only**. |
| View PDF | Same page | PDF is shown read-only (same viewer as elsewhere). Fields overlay shows only this signer’s fields (Signature, Initial, Date, etc.). |
| Sign a field | Click field → modal | For **Signature**: draw or type, then confirm. For **Date**: pick date, confirm. Frontend calls `POST /api/v1/signing/fields/{field_id}/sign?token=...` with signature_type (DRAW/TYPED), signature_image_base64 or typed_name, or date value. Backend stores value on the signing_request_field and marks it SIGNED. |
| Finish | **Finish Signing** button | When all this recipient’s fields are signed, user clicks Finish. Frontend calls `POST /api/v1/signing/complete?token=...`. Backend marks recipient as SIGNED and updates request status (e.g. SENT → IN_PROGRESS, or all signed → COMPLETED). |
| Success | Same page | Message like “You have successfully signed this document.” |

Signing is token-based only; no login required.

---

### Step 7 — Owner Views Document & Downloads Signed PDF

| Step | Where | What happens |
|------|--------|----------------|
| List documents | `/documents` | Frontend calls `GET /api/v1/signing-requests`. Backend returns signing requests for the current user. Each row shows status (Draft/Sent/In Progress/Completed), recipients, and actions (Send / View / Download). |
| View PDF | **View** on a row | Opens document detail or a viewer that uses the **same PDF** as the signing request. View URL can be from `GET /api/v1/files/{file_id}/view-url` (original file). For **signed** view, backend may apply signatures on the fly when generating the view, or frontend shows the same file with overlay; exact implementation depends on your codebase. |
| Download signed PDF | **Download** (when status = COMPLETED) | Frontend calls `GET /api/v1/signing-requests/{signing_request_id}/download`. Backend loads the file from MinIO, applies all signed fields (images/typed/date) onto the PDF, and returns the PDF as a file download. |

So: **view** = see the document (and possibly signatures); **download** = get the final, flattened signed PDF.

---

## 3. All Backend APIs (Quick Reference)

Base URL: `http://localhost:8000` (or your backend URL).  
Auth: `Authorization: Bearer <access_token>` for all except signup, login, and signing-by-token.

### Auth — `POST /api/v1/auth/*`

| Method | Path | Purpose |
|--------|------|--------|
| POST | `/api/v1/auth/register` | Sign up. Body: email, password. Returns user. |
| POST | `/api/v1/auth/login` | Log in. Body: email, password. Returns access_token, user_id. |
| GET | `/api/v1/auth/me` | Current user (requires auth). |

---

### Files — `GET|POST|DELETE /api/v1/files/*`

| Method | Path | Purpose |
|--------|------|--------|
| POST | `/api/v1/files/presign` | Get presigned URL to upload a PDF. Body: filename, mime_type, size. Returns file_id, upload_url, storage_key. |
| GET | `/api/v1/files` | List files (templates) for current user. |
| GET | `/api/v1/files/{file_id}` | File detail + signature fields. |
| GET | `/api/v1/files/{file_id}/view-url` | Presigned URL to view the PDF. |
| POST | `/api/v1/files/{file_id}/finalize` | Mark upload complete (after client uploads to MinIO). |
| DELETE | `/api/v1/files/{file_id}` | Delete file (and its signature fields). |

---

### Signature Fields (Template) — `GET|POST|DELETE /api/v1/signatures/*`

| Method | Path | Purpose |
|--------|------|--------|
| GET | `/api/v1/signatures/fields?file_id=...` | List signature fields for a file (template). |
| POST | `/api/v1/signatures/fields` | Create a signature field. Body: file_id, page, x, y, width, height, assigned_to, field_type, role. |
| DELETE | `/api/v1/signatures/fields/{field_id}` | Delete a signature field. |

---

### Signing Requests (Owner) — `GET|POST|DELETE /api/v1/signing-requests/*`

| Method | Path | Purpose |
|--------|------|--------|
| POST | `/api/v1/signing-requests` | Create signing request. Body: file_id, title, signing_order, recipients[]. |
| GET | `/api/v1/signing-requests` | List signing requests for current user. |
| GET | `/api/v1/signing-requests/stats` | Counts (draft, sent, in_progress, completed). |
| GET | `/api/v1/signing-requests/{id}` | Signing request detail (recipients, fields, file info). |
| GET | `/api/v1/signing-requests/{id}/download` | Download signed PDF (flattened with all signatures). |
| POST | `/api/v1/signing-requests/{id}/send` | Send emails with signing links; move to SENT. |
| DELETE | `/api/v1/signing-requests/{id}` | Delete signing request. |

---

### Signing (Signer — Public by Token) — `GET|POST /api/v1/signing/*`

| Method | Path | Purpose |
|--------|------|--------|
| GET | `/api/v1/signing/by-token/{token}` | Get signer context: recipient, request, PDF view URL, fields for this recipient. No auth. |
| POST | `/api/v1/signing/fields/{field_id}/sign?token=...` | Sign one field (DRAW/TYPED/date). Body: signature_type, signature_image_base64 or typed_name, etc. |
| POST | `/api/v1/signing/complete?token=...` | Mark recipient complete after all their fields are signed. |

---

## 4. Frontend Routes (Summary)

| Route | Auth | Page | Purpose |
|-------|------|------|--------|
| `/login` | No | Login | Log in. |
| `/signup` | No | Signup | Register. |
| `/sign/:token` | No | SignerPage | Signer opens email link, signs, completes. |
| `/dashboard` | Yes | Dashboard | Home after login. |
| `/upload` | Yes | Upload | Upload new PDF (template). |
| `/templates` | Yes | Templates | List templates (files); Use Template / prepare. |
| `/templates/:file_id/recipients` | Yes | AddRecipients | Add Me, Signer 1, Signer 2, emails. |
| `/templates/:file_id/prepare` | Yes | Prepare | Place signature/date/text fields on PDF. |
| `/signing-requests/new/:template_id` | Yes | NewSigningRequest | Create signing request, add recipients, Send. |
| `/documents` | Yes | Documents | List signing requests (View / Download). |
| `/documents/:id` | Yes | DocumentDetail | One signing request detail (view PDF, download). |
| `/documents/:file_id/prepare` | Yes | Prepare | Prepare from Documents entry (same Prepare page). |

---

## 5. Key Concepts (For Juniors)

- **Template** = A PDF file (status UPLOADING or COMPLETED) that you can reuse. Same file can have many signing requests.
- **Signature field** = One placeholder on the PDF (signature, initial, date, text, etc.) with a role (Me, Signer 1, …). Stored in `signature_fields` for the file.
- **Signing request** = One “send for signature” workflow: one template + one set of recipients + one set of signing_request_fields (copied from template). Status: DRAFT → SENT → IN_PROGRESS → COMPLETED.
- **Signing request field** = One field instance for one recipient in that request. Has value (signature image, typed name, date string) and status PENDING/SIGNED.
- **Signer token** = Secret in the email link. Identifies the recipient; used to load context and sign without login.
- **View PDF** = Show the document (and possibly applied signatures). **Download** = Get the final PDF with all signatures burned in (from `/signing-requests/{id}/download`).

---

## 6. Data Flow (End-to-End)

1. **Register/Login** → JWT stored → used in `Authorization` for all owner APIs.
2. **Upload** → Presign → upload to MinIO → finalize → file record + storage.
3. **Prepare** → List fields, create/delete fields → stored per file_id with role.
4. **Create signing request** → Copy template fields into signing_request_fields; one request per “send”.
5. **Send** → Tokens generated, emails sent, status → SENT.
6. **Signer** → By token: get context → sign fields (POST sign) → complete (POST complete) → status IN_PROGRESS / COMPLETED.
7. **Owner** → List requests → View (PDF view URL or rendered view) → Download (GET download) → signed PDF with all signatures.

---

## 7. Where Things Live in Code (High Level)

- **Backend:** `signflow/backend/app/` — `main.py` mounts routers; modules under `modules/` (auth, files, signatures, signing_requests, signing_router).
- **Frontend:** `signflow/frontend/src/` — `App.tsx` defines routes; `pages/` has screens; `lib/` has API helpers (api, auth, fileApi, signatureFieldApi, signingRequestApi, signingApi).
- **Config:** Backend uses env (e.g. DATABASE_URL, MinIO, Resend). Frontend uses `VITE_API_URL` for backend base URL.

Use this doc to trace “from signup to download” and to look up which API to call for each step. No code was modified; this is reference only.
