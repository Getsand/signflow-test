@echo off
cd /d "%~dp0"
echo Starting SignFlo API Wrapper on http://127.0.0.1:9080
echo In browser: http://127.0.0.1:9080/ping  http://127.0.0.1:9080/health  http://127.0.0.1:9080/docs
echo.
python -m uvicorn app.main:app --host 127.0.0.1 --port 9080 --loop asyncio
pause
