"""
MinIO storage helpers

Strategy:
- All MinIO operations use MINIO_INTERNAL_ENDPOINT (e.g. minio:9000) so the backend
  in Docker can connect. Presigned URLs therefore contain that host.
- For the browser to reach MinIO when backend runs in Docker, either:
  A) Add "127.0.0.1 minio" to your hosts file (macOS/Linux: /etc/hosts), or
  B) Set MINIO_PUBLIC_ENDPOINT=host.docker.internal:9000 and use that for presigned
     URL generation (backend must connect to it; works on Docker Desktop Mac/Windows).
"""

import os
import logging
from datetime import timedelta

from minio import Minio
from minio.error import S3Error

# ---- ENV ----
MINIO_INTERNAL_ENDPOINT = os.getenv("MINIO_INTERNAL_ENDPOINT", "minio:9000")
# When backend runs in Docker, use host.docker.internal so backend can connect AND
# browser gets a URL it can resolve (Mac/Windows). Leave as localhost if backend runs on host.
MINIO_PUBLIC_ENDPOINT = os.getenv("MINIO_PUBLIC_ENDPOINT", "localhost:9000")

MINIO_ACCESS_KEY = os.getenv("MINIO_ACCESS_KEY", "minioadmin")
MINIO_SECRET_KEY = os.getenv("MINIO_SECRET_KEY", "minioadmin")
MINIO_BUCKET = os.getenv("MINIO_BUCKET", "signflow-documents")
MINIO_SECURE = os.getenv("MINIO_SECURE", "false").lower() == "true"


# ---- Internal Client (Backend Operations) ----
def get_internal_minio_client() -> Minio:
    """
    MinIO client for backend operations (bucket exists, stat_object, presign, etc.).
    Uses MINIO_INTERNAL_ENDPOINT (e.g. minio:9000) so backend in Docker can connect.
    """
    client = Minio(
        MINIO_INTERNAL_ENDPOINT,
        access_key=MINIO_ACCESS_KEY,
        secret_key=MINIO_SECRET_KEY,
        secure=MINIO_SECURE,
    )

    # Ensure bucket exists
    try:
        if not client.bucket_exists(MINIO_BUCKET):
            client.make_bucket(MINIO_BUCKET)
    except S3Error:
        pass  # Bucket may already exist

    return client


def get_presign_minio_client() -> Minio:
    """
    MinIO client for generating presigned URLs. Uses MINIO_PUBLIC_ENDPOINT when set
    to a host the backend can reach (e.g. host.docker.internal:9000 in Docker on Mac/Windows),
    so the SDK can connect if needed and the returned URL works in the browser.
    Otherwise uses internal endpoint (minio:9000); browser then needs "127.0.0.1 minio" in hosts.
    """
    endpoint = MINIO_PUBLIC_ENDPOINT.strip()
    # If public endpoint is localhost and we're in Docker, backend cannot connect to it.
    # Use internal endpoint so backend works; user must add hosts entry for browser.
    if endpoint in ("localhost:9000", "127.0.0.1:9000"):
        return get_internal_minio_client()
    client = Minio(
        endpoint,
        access_key=MINIO_ACCESS_KEY,
        secret_key=MINIO_SECRET_KEY,
        secure=MINIO_SECURE,
    )
    return client


# ---- Presigned URL Generation ----
def generate_presigned_put_url(object_name: str) -> str:
    """
    Generate presigned PUT URL for client uploads.
    Uses get_presign_minio_client() so when MINIO_PUBLIC_ENDPOINT is set to
    host.docker.internal:9000 (Docker Mac/Windows), backend and browser both work.
    """
    client = get_presign_minio_client()
    return client.presigned_put_object(
        bucket_name=MINIO_BUCKET,
        object_name=object_name,
        expires=timedelta(minutes=15),
    )


def generate_presigned_get_url(object_name: str, expires_minutes: int = 60) -> str:
    """
    Generate presigned GET URL for viewing/downloading files.
    Verifies object exists then returns URL (same endpoint logic as put).
    """
    logger = logging.getLogger(__name__)
    internal = get_internal_minio_client()
    try:
        internal.stat_object(
            bucket_name=MINIO_BUCKET,
            object_name=object_name,
        )
    except S3Error as e:
        logger.error(
            f"Object not found in MinIO: bucket={MINIO_BUCKET}, "
            f"storage_key={object_name}, error={e}"
        )
        raise
    client = get_presign_minio_client()
    url = client.presigned_get_object(
        bucket_name=MINIO_BUCKET,
        object_name=object_name,
        expires=timedelta(minutes=expires_minutes),
    )
    logger.debug(f"Generated presigned GET URL: {url}")
    return url
