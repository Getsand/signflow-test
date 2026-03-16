@echo off
cd /d "%~dp0"
echo Starting SignFlo API Wrapper with Hypercorn on http://127.0.0.1:9080
echo In browser: http://127.0.0.1:9080/ping  http://127.0.0.1:9080/health  http://127.0.0.1:9080/docs
echo.
python -m hypercorn app.main:app --bind 127.0.0.1:9080
pause
