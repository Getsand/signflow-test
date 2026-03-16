# SignFlo – Complete setup on MacBook (local run)

This guide installs everything needed and runs SignFlo locally on macOS. No code changes.

---

## 1. Tools required

| Tool | Purpose | How to install on Mac |
|------|---------|------------------------|
| **Docker Desktop** | Runs PostgreSQL, Redis, MinIO, backend | See below |
| **Node.js** (LTS, e.g. 20.x) | Runs frontend (Vite) | See below |
| **Git** | Clone repo (usually already installed) | `xcode-select --install` or Homebrew |
| **Homebrew** (optional) | Easiest way to install Node/Docker | https://brew.sh |

---

## 2. Install tools on MacBook

### 2.1 Homebrew (if not installed)

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

Follow the on-screen instructions (including adding `brew` to your PATH if prompted).

### 2.2 Docker Desktop

1. Install:
   ```bash
   brew install --cask docker
   ```
2. Open **Docker** from Applications (or Spotlight).
3. Wait until the menu bar icon shows “Docker Desktop is running”.
4. Verify:
   ```bash
   docker --version
   docker compose version
   ```

### 2.3 Node.js

```bash
brew install node
```

Verify:

```bash
node -v   # e.g. v20.x.x
npm -v    # e.g. 10.x.x
```

### 2.4 Git (if needed)

```bash
xcode-select --install
# or
brew install git
git --version
```

---

## 3. Get the project

```bash
cd ~/Desktop   # or wherever you keep projects
git clone <YOUR_REPO_URL> "website signflow"
cd "website signflow/signflow"
```

If you already have the folder (e.g. copied from Windows), just `cd` into the `signflow` directory (the one that contains `docker-compose.yml` and the `backend` and `frontend` folders).

---

## 4. Environment configuration

### 4.1 Backend `.env` (project root)

The file must be at **`signflow/.env`** (same folder as `docker-compose.yml`).

Create or edit it with the following. **`FRONTEND_BASE_URL=http://localhost:5173`** is correct for local run.

```env
APP_NAME=SignFlo
APP_ENV=development
APP_VERSION=0.1.0
DEBUG=true

# Database (used by backend inside Docker)
DATABASE_URL=postgresql+asyncpg://signflow:signflow_dev_password@postgres:5432/signflow_db

# Redis (optional; used for rate limiting)
REDIS_URL=redis://redis:6379/0

# MinIO (document storage). When backend runs in Docker, use host.docker.internal so presigned URLs work in the browser.
MINIO_INTERNAL_ENDPOINT=minio:9000
MINIO_PUBLIC_ENDPOINT=host.docker.internal:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=signflow-documents
MINIO_SECURE=false

# Email (Resend) – signing invitation links
RESEND_API_KEY=your_resend_api_key_here
EMAIL_FROM=noreply@yourdomain.com

# Frontend URL – used in emails for “Sign document” links (local dev)
FRONTEND_BASE_URL=http://localhost:5173
```

- Replace `your_resend_api_key_here` with your Resend API key (get one at https://resend.com). If you leave it empty, the app runs but won’t send emails.
- Replace `noreply@yourdomain.com` with a sender you’ve verified in Resend.

### 4.2 Frontend `.env`

Create **`signflow/frontend/.env`** with:

```env
VITE_API_URL=http://localhost:8000
```

This tells the frontend (Vite) where the backend is. Restart the frontend dev server after changing this file.

---

## 5. Start backend services (Docker)

From the **`signflow`** folder (where `docker-compose.yml` is):

```bash
docker compose up -d postgres redis minio backend
```

Wait ~30 seconds, then check:

```bash
docker compose ps
```

All four services should show as “running” (and healthy if healthchecks are defined).

---

## 6. Run database migrations

Migrations must run **inside** the backend container:

```bash
docker compose exec backend alembic upgrade head
```

You should see “INFO  [alembic.runtime.migration] Running upgrade …” and no errors. This creates/updates tables and adds columns like `users.invited_by_id`, `is_active`, `role`.

---

## 7. Run the frontend

```bash
cd frontend
npm install
npm run dev
```

Vite will print something like:

- **Local:** http://localhost:5173/

Open **http://localhost:5173** in your browser.

---

## 8. Verify everything

| What | URL or command |
|------|----------------|
| Frontend | http://localhost:5173 |
| API docs | http://localhost:8000/docs |
| API summary | http://localhost:8000/api/v1 |
| Health | `curl http://localhost:8000/health` |
| MinIO console | http://localhost:9001 (user: minioadmin, password: minioadmin) |

---

## 9. Use the app

1. Go to http://localhost:5173.
2. **Sign up** with email and password.
3. **Log in**.
4. Upload a document, create a template (Prepare → add fields), then create a signing request and send. Recipients use the link from the email (or the same URL with token for testing).

---

## 10. Useful commands (MacBook)

| Task | Command |
|------|---------|
| Start all backend services | `docker compose up -d` (from `signflow`) |
| Stop all | `docker compose down` |
| View backend logs | `docker compose logs -f backend` |
| Run migrations again | `docker compose exec backend alembic upgrade head` |
| Restart backend | `docker compose restart backend` |
| Frontend dev server | `cd frontend && npm run dev` |
| Frontend production build | `cd frontend && npm run build` |

---

## After git pull – Fix login and signup on MacBook

If you **pulled the code from GitHub** on a MacBook and login/signup don’t work, do the following **on the MacBook only**. No code changes.

### 1. Create or fix env files (they are not in git)

**Backend** – In the `signflow` folder (same folder as `docker-compose.yml`), create or edit **`.env`** with at least:

```env
APP_NAME=SignFlo
APP_ENV=development
DEBUG=true
DATABASE_URL=postgresql+asyncpg://signflow:signflow_dev_password@postgres:5432/signflow_db
REDIS_URL=redis://redis:6379/0
MINIO_INTERNAL_ENDPOINT=minio:9000
MINIO_PUBLIC_ENDPOINT=host.docker.internal:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=signflow-documents
MINIO_SECURE=false
FRONTEND_BASE_URL=http://localhost:5173
RESEND_API_KEY=
EMAIL_FROM=noreply@example.com
```

**Frontend** – In **`signflow/frontend/`**, create **`.env`** with:

```env
VITE_API_URL=http://localhost:8000
```

Without this, the frontend may call the wrong URL and login/signup will fail.

### 2. Start Docker and run migrations

From **`signflow`**:

```bash
docker compose up -d postgres redis minio backend
docker compose exec backend alembic upgrade head
```

The MacBook has its **own database** (empty after a fresh pull). Migrations create the `users` table and columns like `invited_by_id`. If you skip this, login/signup can return 500 or “column does not exist”.

### 3. Create the MinIO bucket

1. Open http://localhost:9001 and log in with `minioadmin` / `minioadmin`.
2. Go to **Buckets** → **Create Bucket** → name: **`signflow-documents`** → Create.

### 4. Restart frontend (so it reads `.env`)

```bash
cd signflow/frontend
npm install
npm run dev
```

Stop the dev server (Ctrl+C) and run `npm run dev` again if you added or changed `frontend/.env`.

### 5. Register again on the MacBook

The Mac database is **separate** from your Windows one. There are no users until you create one.

1. Open http://localhost:5173.
2. Click **Sign up** and register with email and password.
3. Then use the same credentials to **Sign in**.

After these steps, login and signup should work on the MacBook. No changes are required in the repo.

---

## Summary

- **FRONTEND_BASE_URL** for local run: **`http://localhost:5173`** (already correct in your setup).
- **Tools on MacBook:** Docker Desktop, Node.js, Git (Homebrew optional).
- **Config:** `signflow/.env` (backend) and `signflow/frontend/.env` with `VITE_API_URL=http://localhost:8000`.
- **Run:** `docker compose up -d` → `docker compose exec backend alembic upgrade head` → `cd frontend && npm install && npm run dev` → open http://localhost:5173.

No code changes are required; only install tools, set env files, and run the commands above.
