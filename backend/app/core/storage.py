"""
MinIO storage helpers

Strategy:
- Backend uses minio:9000 for actual operations (Docker network)
- Presigned URLs use localhost:9000 (what clients can reach)
- SDK generates URLs with region='us-east-1' to minimize connection needs
"""

import os
from datetime import timedelta

from minio import Minio
from minio.error import S3Error

# ---- ENV ----
MINIO_INTERNAL_ENDPOINT = os.getenv("MINIO_INTERNAL_ENDPOINT", "minio:9000")
MINIO_PUBLIC_ENDPOINT = os.getenv("MINIO_PUBLIC_ENDPOINT", "localhost:9000")

MINIO_ACCESS_KEY = os.getenv("MINIO_ACCESS_KEY", "minioadmin")
MINIO_SECRET_KEY = os.getenv("MINIO_SECRET_KEY", "minioadmin")
MINIO_BUCKET = os.getenv("MINIO_BUCKET", "signflow-documents")
MINIO_SECURE = os.getenv("MINIO_SECURE", "false").lower() == "true"


# ---- Internal Client (Backend Operations) ----
def get_internal_minio_client() -> Minio:
    """
    MinIO client for backend operations.
    Uses internal Docker endpoint: minio:9000
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


# Legacy function for compatibility
def get_presign_minio_client() -> Minio:
    """Deprecated: Use get_internal_minio_client() instead"""
    return get_internal_minio_client()


# ---- Presigned URL Generation ----
def generate_presigned_put_url(object_name: str) -> str:
    """
    Generate presigned PUT URL for client uploads.
    
    Uses internal client (minio:9000).
    Client must be able to resolve 'minio' hostname (add to hosts file).
    
    Args:
        object_name: Storage key (e.g., "uploads/uuid/filename.pdf")
    
    Returns:
        Presigned URL with minio:9000
    """
    client = get_internal_minio_client()
    
    return client.presigned_put_object(
        bucket_name=MINIO_BUCKET,
        object_name=object_name,
        expires=timedelta(minutes=15),
    )
