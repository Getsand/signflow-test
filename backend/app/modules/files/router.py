
from app.modules.files.service import FileService
from app.modules.files.schemas import FilePresignRequest, FilePresignResponse
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.modules.files.service import FileService
from app.modules.files.schemas import PresignRequest, PresignResponse

router = APIRouter(prefix="/api/v1/files", tags=["files"])


@router.post("/presign", response_model=PresignResponse)
async def presign_upload(
    payload: PresignRequest,
    db: AsyncSession = Depends(get_db),
):
    service = FileService()
    upload_url, storage_key = service.create_presigned_upload(
        filename=payload.filename,
        mime_type=payload.mime_type,
    )

    return {
        "upload_url": upload_url,
        "storage_key": storage_key,
        "expires_in": 900,
    }
