"""
MinIO storage helpers

Strategy:
- Backend uses minio:9000 for actual operations (Docker network)
- Presigned URLs use localhost:9000 (what clients can reach)
- SDK generates URLs with region='us-east-1' to minimize connection needs
"""

import os
import logging
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
    
    NOTE: Presigned URLs include hostname in signature.
    Cannot replace hostname without invalidating signature.
    Client must be able to access minio:9000 (via hosts file or Docker network).
    
    Args:
        object_name: Storage key (e.g., "uploads/uuid/filename.pdf")
    
    Returns:
        Presigned PUT URL (as-is from MinIO, hostname in signature)
    """
    client = get_internal_minio_client()
    
    # Return URL as-is - signature includes hostname
    # Client must access using the same hostname (minio:9000)
    # For browser access, add minio to hosts file: 127.0.0.1 minio
    url = client.presigned_put_object(
        bucket_name=MINIO_BUCKET,
        object_name=object_name,
        expires=timedelta(minutes=15),
    )
    
    return url


def generate_presigned_get_url(object_name: str, expires_minutes: int = 60) -> str:
    """
    Generate presigned GET URL for viewing/downloading files.
    
    NOTE: Presigned URLs include hostname in signature.
    URL will contain minio:9000 - browser must be able to access it.
    Add to hosts file: 127.0.0.1 minio
    
    Args:
        object_name: Storage key (e.g., "uploads/uuid/filename.pdf")
        expires_minutes: URL expiration time in minutes (default: 60)
    
    Returns:
        Presigned GET URL (as-is from MinIO, hostname in signature)
    
    Raises:
        S3Error: If object does not exist in bucket
    """
    client = get_internal_minio_client()
    
    # CRITICAL: Verify object exists before generating presigned URL
    # This prevents returning URLs that return error documents (54-byte responses)
    try:
        client.stat_object(
            bucket_name=MINIO_BUCKET,
            object_name=object_name,
        )
    except S3Error as e:
        # Log clearly for debugging
        logger = logging.getLogger(__name__)
        logger.error(
            f"Object not found in MinIO: bucket={MINIO_BUCKET}, "
            f"storage_key={object_name}, error={e}"
        )
        raise
    
    # Generate presigned URL - signature includes hostname
    # Cannot replace hostname without invalidating signature
    # Client must access using same hostname (minio:9000)
    url = client.presigned_get_object(
        bucket_name=MINIO_BUCKET,
        object_name=object_name,
        expires=timedelta(minutes=expires_minutes),
    )
    
    logger = logging.getLogger(__name__)
    logger.debug(f"Generated presigned GET URL: {url}")
    
    return url
