# SignFlo API Wrapper - runs on 9080, proxies to backend
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app/ ./app/
RUN mkdir -p /app/data

# Default: run with uvicorn (override with docker run or compose)
ENV PORT=9080
EXPOSE 9080

CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "9080"]
