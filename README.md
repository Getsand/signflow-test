# SignFlo – Enterprise Document Signature Management System

> A complete, full-stack SaaS platform for digital document signing and workflow management, inspired by Zoho Sign.

[![FastAPI](https://img.shields.io/badge/FastAPI-0.109+-009688?logo=fastapi)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://reactjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-336791?logo=postgresql)](https://www.postgresql.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript)](https://www.typescriptlang.org/)

SignFlo is a **production-ready** document signature management system. Users can upload PDFs, create templates with signature fields, send signing requests (sequential or parallel), and sign documents via email links. The backend also exposes a **public API** with API-key auth and rate limiting for integrations.

---

## ✨ Features

### Web application
- **Authentication** – JWT-based login/signup (email + password)
- **Document management** – Upload, view, rename, and delete PDFs; presigned uploads via MinIO
- **Templates** – Turn documents into reusable templates; add signature, initial, date, text, email, and related fields with role assignment (e.g. Signer 1, Signer 2)
- **Prepare** – Interactive PDF viewer to place and resize fields per page
- **Signing requests** – Create requests from templates, set **signing order** (sequential or parallel), map roles to recipient emails, send invitations
- **Sequential signing** – Optional queue: only the first signer gets the email; the next receives it after the previous completes; signers see prior signatures
- **Parallel signing** – All signers receive the email at once and can sign in any order
- **Public signing** – Recipients open a tokenized link (no login), sign or fill fields, and complete; professional modal (draw/type signature, clear overlay)
- **Email invitations** – Signing links sent via Resend (configurable)
- **Status tracking** – Draft, Sent, In progress, Completed for requests and recipients
- **Download** – Signed PDF download for completed requests
- **Responsive UI** – React + Tailwind; Zoho Sign–inspired layout (sidebar, dashboard, documents, templates)

### Public API (Zoho Sign–style)
- **Auth** – Register, login (JWT), create/list/revoke API keys
- **Documents** – List, presign, finalize, get, update (rename), delete
- **Templates** – List, create, get, update, add/list fields
- **Field types** – GET supported types (SIGNATURE, INITIAL, DATE, TEXT, EMAIL, etc.)
- **Requests** – List, stats, create from template, get, send, download signed PDF, delete
- **Users** – Me, list users, invite, update profile/access/role, delete (optional user-management migration)
- **Rate limiting** – Per API key (e.g. 60 req/min), optional Redis

See **`backend/WRAPPER_README.md`** and **`backend/PUBLIC_API.md`** for full API details.

---

## 🛠️ Tech stack

### Backend
- **Python 3.11+** – Async support
- **FastAPI** – Async web framework
- **SQLAlchemy 2.0** – Async ORM, type hints
- **PostgreSQL 15** – Database
- **Alembic** – Migrations
- **Redis 7** – Caching / rate limiting (optional)
- **MinIO** – S3-compatible object storage (presigned URLs)
- **Resend** – Transactional email (signing invitations)
- **Pydantic v2** – Validation and settings
- **JWT** – Auth tokens; API keys for public API

### Frontend
- **React 19** – Hooks, lazy-loaded routes
- **TypeScript 5.9** – Type safety
- **Vite 7** – Build and dev server
- **Tailwind CSS** – Styling
- **React Router 7** – Routing
- **React-PDF** – PDF.js-based viewer and field overlays

---

## 📁 Project structure

```
signflow/
├── backend/
│   ├── app/
│   │   ├── api/                    # Public API (API key auth)
│   │   │   ├── controllers/         # documents, templates, requests, users, api_keys, field_types
│   │   │   ├── deps.py             # API key auth, rate limit
│   │   │   ├── models.py           # ApiKey, ApiUsageLog
│   │   │   ├── repo.py
│   │   │   ├── router.py           # Mounts under /api/v1
│   │   │   └── schemas.py
│   │   ├── core/                   # config, db, security, storage, logging, middleware
│   │   ├── modules/
│   │   │   ├── auth/               # Register, login, JWT, user model
│   │   │   ├── files/              # Upload, presign, finalize, view URL
│   │   │   ├── signatures/         # Template field CRUD
│   │   │   └── signing_requests/   # Create/send requests, status; public signing (by token)
│   │   ├── shared/                 # Exceptions, etc.
│   │   └── main.py                # FastAPI app, CORS, routers
│   ├── alembic/                    # Migrations (including user-management fields)
│   ├── postman/                    # Public API collection
│   ├── WRAPPER_README.md           # Public API overview
│   ├── PUBLIC_API.md               # Full API + Zoho mapping
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── components/            # Sidebar, ProtectedRoute, UI, PDF overlays, layout
│   │   ├── pages/                 # auth, dashboard, upload, documents, Prepare, templates, signing-requests, signing (SignerPage)
│   │   ├── lib/                   # Auth context, API clients (files, signing, templates, etc.)
│   │   ├── types/
│   │   └── utils/
│   ├── package.json
│   └── vite.config.ts
├── docker-compose.yml              # postgres, redis, minio, backend
├── .env                            # DATABASE_URL, REDIS_URL, MINIO_*, RESEND_*, FRONTEND_BASE_URL, etc.
└── README.md                       # This file
```

---

## 🚀 Quick start

### Prerequisites
- **Docker** and **Docker Compose**
- **Node.js** (for frontend dev; LTS recommended)
- **Git**

### 1. Clone and enter project
```bash
git clone <repository-url>
cd signflow
```

### 2. Environment
- Copy or create `.env` in the **signflow** root (same folder as `docker-compose.yml`).
- Ensure at least: `DATABASE_URL`, `REDIS_URL` (optional), MinIO vars, `RESEND_API_KEY`, `FRONTEND_BASE_URL=http://localhost:5173`.
- See `backend/ENV_TEMPLATE.txt` (or project docs) for a full list.

### 3. Start backend services
```bash
docker compose up -d postgres redis minio backend
```

### 4. Run database migrations
Migrations must run **inside** the backend container (so the correct Python and env are used):
```bash
docker compose exec backend alembic upgrade head
```
This applies all migrations, including the one that adds `invited_by_id`, `is_active`, and `role` to `users` (required for login and optional API user management).

### 5. Frontend
```bash
cd frontend
npm install
npm run dev
```

### 6. Open the app
- **Web app:** http://localhost:5173  
- **API docs:** http://localhost:8000/docs  
- **MinIO console:** http://localhost:9001 (e.g. minioadmin / minioadmin)

### First-time use
1. Open http://localhost:5173 → **Sign up** with email and password.
2. **Log in** and go to **Dashboard**.
3. **Upload** a PDF or create a **Template** (upload → open document → Prepare → add fields → save as template).
4. From **Templates**, start a **New signing request**, choose sequential or parallel, add recipient emails, and **Send**.
5. Recipients use the link from the email to open the **public signing page** and complete their fields.

---

## 🔧 Configuration

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL (e.g. `postgresql+asyncpg://user:pass@host:5432/db`) |
| `REDIS_URL` | Optional; rate limiting and caching |
| `MINIO_*` | Storage endpoint, keys, bucket |
| `RESEND_API_KEY` | Sending signing invitation emails |
| `EMAIL_FROM` | Sender address for emails |
| `FRONTEND_BASE_URL` | Frontend origin (e.g. `http://localhost:5173`) for links in emails |
| `VITE_API_URL` | (Frontend) Backend base URL (e.g. `http://localhost:8000`) |

Frontend expects `VITE_API_URL`; create `frontend/.env` with:
```bash
VITE_API_URL=http://localhost:8000
```
Restart the Vite dev server after changing env.

---

## 📌 Useful commands

| Command | Description |
|--------|-------------|
| `docker compose up -d` | Start all services |
| `docker compose exec backend alembic upgrade head` | Run migrations (always in container) |
| `docker compose restart backend` | Restart backend after config/migration changes |
| `docker compose logs -f backend` | Tail backend logs |
| `cd frontend && npm run dev` | Start frontend dev server |
| `cd frontend && npm run build` | Production build |

Optional **Make** targets (if you have a `Makefile`):
- `make up` / `make down` – Start/stop services  
- `make migrate` – Run migrations via container  
- `make logs-backend` – Backend logs  

---

## 🏥 Health check

```bash
curl http://localhost:8000/health
```

Example response:
```json
{
  "status": "healthy",
  "app_name": "SignFlo",
  "environment": "development",
  "version": "0.1.0"
}
```

---

## 📄 Public API (summary)

- **Base URL:** `http://localhost:8000/api/v1`
- **Web auth:** Register → Login → use `access_token` as `Authorization: Bearer <access_token>`.
- **API keys:** Create key (e.g. `POST /api/v1/auth/api-keys` or `POST /api/v1/api-keys`) with JWT; use returned `api_key` as `Authorization: Bearer <api_key>` for documents, templates, requests, users.
- **Docs:** http://localhost:8000/docs and `GET /api/v1` for a short summary.
- **Postman:** Import `backend/postman/SignFlo_Public_API.postman_collection.json` and set `base_url`.

Details: **`backend/WRAPPER_README.md`**, **`backend/PUBLIC_API.md`**.

---

## ✅ Status

**Project: Complete.**

- ✅ User auth (register, login, JWT)  
- ✅ Document upload and management (presign, finalize, MinIO)  
- ✅ Templates and signature/field placement (Prepare)  
- ✅ Signing requests (create, send, sequential/parallel, email invitations)  
- ✅ Public signing page (token-based, draw/type, completion)  
- ✅ Download signed PDF  
- ✅ Public API with API keys and rate limiting  
- ✅ Database migrations (including user-management fields for API)

---

**SignFlo** – Document signature management, web app + API.
