# How to run the SignFlo API Wrapper

**For the full workflow, how to create/use API keys, and all APIs with cURL + responses, see [API_GUIDE.md](API_GUIDE.md).**

Runs on **port 9080**. Forwards requests to your SignFlo backend (port 8000). Uses its **own SQLite DB** (in `data/wrapper.db`) for API keys and usage logs; the SignFlo backend DB is not modified.

**Important:** You must run the wrapper **from inside the `signflo-api-wrapper` folder**. If you run uvicorn from the parent folder, the wrong `app` (e.g. the main SignFlo backend) can load and `/health` will not be the wrapper.

## 1. Install dependencies

From the **signflo-api-wrapper** folder:

```bash
# Activate venv if you use one
# Windows:  .venv\Scripts\activate
# Git Bash: source .venv/Scripts/activate

pip install -r requirements.txt
python -m pip install --upgrade pip
```

## 2. Configure (required for document APIs)

Copy `.env.example` to `.env` and set at least:

- **BACKEND_EMAIL** and **BACKEND_PASSWORD** – a SignFlo backend user the wrapper uses to log in and proxy document/signing requests. Create this user in your SignFlo app (e.g. register or admin).
- **ADMIN_SECRET** (optional) – used to create the first API key via `X-Admin-Secret` header (bootstrap). After that, use API keys to create more keys.

Without these, `/health` and `/docs` still work; document endpoints will fail when the wrapper tries to log in to the backend.

## 3. Start your SignFlo backend

Your main app on port 8000 is required for document/signing APIs. For `/health` and `/docs` only, the wrapper runs without it.

## 4. Start the API wrapper (pick one)

**Option A – Run script (recommended)**  
Always uses the correct folder and app:

- **Windows:** Double‑click `run_wrapper.bat` or in CMD: `run_wrapper.bat`
- **Git Bash / Linux / Mac:** `bash run_wrapper.sh`

**Option B – Manual (must be inside signflo-api-wrapper)**

```bash
cd signflo-api-wrapper
python -m uvicorn app.main:app --host 127.0.0.1 --port 9080
```

Using `python -m uvicorn` from inside `signflo-api-wrapper` ensures the wrapper’s `app` is loaded.

## 5. Use it

- **Wrapper health:** http://127.0.0.1:9080/health  
- **Plain text check:** http://127.0.0.1:9080/ping  
- **API docs (Swagger):** http://127.0.0.1:9080/docs  
- **API info:** http://127.0.0.1:9080/api/v1  
- **Backend health via wrapper:** http://127.0.0.1:9080/api/v1/backend/health  

Protected routes (documents, keys) require **Authorization: Bearer YOUR_API_KEY** or **X-API-Key: YOUR_API_KEY**. Create the first key with `POST /api/v1/keys` and header **X-Admin-Secret: your-admin-secret** (see `.env`). See **[API_GUIDE.md](API_GUIDE.md)** for all endpoints.

Flow: **Client → wrapper (9080) → SignFlo backend (8000)**.

## If you get "localhost sent an invalid response" (ERR_INVALID_HTTP_RESPONSE)

Do these in order:

1. **Use 127.0.0.1 in the browser**  
   Open **http://127.0.0.1:9080/ping** (not localhost).

2. **Run with Hypercorn**  
   Use **`run_hypercorn.bat`**; then open http://127.0.0.1:9080/ping and http://127.0.0.1:9080/docs  

3. **WinError 10013 (port forbidden / in use)**  
   The wrapper now uses **port 9080** instead of 9000. If you still get 10013, close any other app using 9080, or set `PORT=9090` in a `.env` file and use that port in the run script.

4. **Optional: isolate HTTP**  
   If `http://127.0.0.1:9080/ping` fails, try another port via `PORT` in `.env` and your run script, or check firewall/antivirus blocking local servers.

## Optional: override with .env

Copy `.env.example` to `.env` and set `BACKEND_BASE_URL`, `BACKEND_EMAIL`, `BACKEND_PASSWORD`, `ADMIN_SECRET`, `PORT`, etc. See `.env.example` for all options.
