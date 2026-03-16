#!/usr/bin/env bash
cd "$(dirname "$0")"
echo "Starting SignFlo API Wrapper on http://127.0.0.1:9080"
echo "Health: http://127.0.0.1:9080/health  Docs: http://127.0.0.1:9080/docs"
echo ""
python -m uvicorn app.main:app --host 127.0.0.1 --port 9080 --loop asyncio
