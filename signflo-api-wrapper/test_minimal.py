"""
Minimal test: run this to see if ERR_INVALID_HTTP_RESPONSE is uvicorn or our app.
  python -m uvicorn test_minimal:app --host 127.0.0.1 --port 9001
Then open http://127.0.0.1:9001/ping (port 9001 to avoid conflict).
If that works, the issue is in app/main.py (lifespan or routes). If it fails too, the issue is uvicorn/Chrome.
"""
from fastapi import FastAPI
from starlette.responses import Response

app = FastAPI()

@app.get("/ping")
def ping():
    return Response(content=b"pong", media_type="text/plain")
