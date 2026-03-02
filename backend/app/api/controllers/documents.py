"""Public API: document endpoints (API key required)."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.modules.files.repo import FileRepository
from app.modules.files.service import FileService
from app.modules.signatures.repo import SignatureFieldRepository
from app.modules.signatures.service import SignatureFieldService
from app.api.deps import get_validated_api_key
from app.api.models import ApiKey
from app.api.schemas import (
    ApiResponse,
    DocumentListItem,
    PresignRequest,
    PresignData,
    DocumentDetailData,
    DocumentUpdateRequest,
)

router = APIRouter(prefix="/documents", tags=["documents"])

# Supported document (file) types for upload (Zoho-style: get document type)
ALLOWED_MIME_TYPES = [
    {"id": "application/pdf", "name": "PDF", "description": "Portable Document Format"},
    {"id": "image/png", "name": "PNG", "description": "PNG image"},
    {"id": "image/jpeg", "name": "JPEG", "description": "JPEG image"},
]


@router.get("/types", response_model=ApiResponse[list])
async def get_document_types(
    api_key: ApiKey = Depends(get_validated_api_key),
):
    """Retrieve supported document types (Zoho Sign style)."""
    return ApiResponse.success(data=ALLOWED_MIME_TYPES)


@router.get("", response_model=ApiResponse[list])
async def list_documents(
    db: AsyncSession = Depends(get_db),
    api_key: ApiKey = Depends(get_validated_api_key),
):
    """List all documents for the API key owner."""
    service = FileService(FileRepository(db))
    files = await service.list_user_files(owner_id=api_key.owner_id)
    items = [
        DocumentListItem(
            id=f.id,
            filename=f.filename,
            status=f.status.value,
            created_at=f.created_at,
        )
        for f in files
    ]
    return ApiResponse.success(data=items)


@router.post("/presign", response_model=ApiResponse[PresignData])
async def presign_upload(
    payload: PresignRequest,
    db: AsyncSession = Depends(get_db),
    api_key: ApiKey = Depends(get_validated_api_key),
):
    """Get presigned URL to upload a file. Then PUT file to upload_url and call finalize."""
    service = FileService(FileRepository(db))
    try:
        result = await service.create_presigned_upload(
            filename=payload.filename,
            mime_type=payload.mime_type,
            owner_id=api_key.owner_id,
        )
        return ApiResponse.success(
            data=PresignData(
                file_id=result["file_id"],
                upload_url=result["upload_url"],
                storage_key=result["storage_key"],
                expires_in=result["expires_in"],
            ),
            message="Upload URL generated. PUT file to upload_url then finalize.",
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/{file_id}", response_model=ApiResponse[DocumentDetailData])
async def get_document(
    file_id: UUID,
    db: AsyncSession = Depends(get_db),
    api_key: ApiKey = Depends(get_validated_api_key),
):
    """Get document metadata and signature fields."""
    service = FileService(FileRepository(db))
    sig_service = SignatureFieldService(
        sig_repo=SignatureFieldRepository(db),
        file_repo=FileRepository(db),
    )
    try:
        file_obj = await service.get_file_details(
            file_id=file_id,
            owner_id=api_key.owner_id,
        )
        signature_fields = await sig_service.list_fields(
            file_id=file_id,
            user_id=api_key.owner_id,
        )
        fields_data = [
            {
                "id": str(f.id),
                "page_number": f.page_number,
                "x": f.x,
                "y": f.y,
                "width": f.width,
                "height": f.height,
                "assigned_to": str(f.assigned_to),
                "status": getattr(f.status, "value", f.status),
                "signed_at": f.signed_at.isoformat() if getattr(f, "signed_at", None) else None,
            }
            for f in signature_fields
        ]
        return ApiResponse.success(
            data=DocumentDetailData(
                id=file_obj.id,
                filename=file_obj.filename,
                mime_type=file_obj.mime_type,
                size=file_obj.size,
                status=file_obj.status.value,
                signature_fields=fields_data,
            )
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found or access denied",
        )


@router.post("/{file_id}/finalize", response_model=ApiResponse[dict])
async def finalize_document(
    file_id: UUID,
    db: AsyncSession = Depends(get_db),
    api_key: ApiKey = Depends(get_validated_api_key),
):
    """Finalize upload after file was PUT to the presigned URL."""
    service = FileService(FileRepository(db))
    try:
        updated = await service.finalize_upload(
            file_id=file_id,
            owner_id=api_key.owner_id,
        )
        return ApiResponse.success(
            data={
                "id": str(updated.id),
                "filename": updated.filename,
                "mime_type": updated.mime_type,
                "size": updated.size,
                "status": updated.status.value,
            }
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found or access denied",
        )


@router.put("/{file_id}", response_model=ApiResponse[dict])
async def update_document(
    file_id: UUID,
    payload: DocumentUpdateRequest,
    db: AsyncSession = Depends(get_db),
    api_key: ApiKey = Depends(get_validated_api_key),
):
    """Manage document: update (rename) document. Zoho-style."""
    service = FileService(FileRepository(db))
    try:
        updated = await service.rename_file(
            file_id=file_id,
            owner_id=api_key.owner_id,
            new_filename=payload.filename,
        )
        return ApiResponse.success(
            data={
                "id": updated["id"],
                "filename": updated["filename"],
                "mime_type": updated["mime_type"],
                "size": updated["size"],
                "status": updated["status"],
            },
            message="Document updated",
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{file_id}", response_model=ApiResponse[None])
async def delete_document(
    file_id: UUID,
    db: AsyncSession = Depends(get_db),
    api_key: ApiKey = Depends(get_validated_api_key),
):
    """Delete a document."""
    service = FileService(FileRepository(db))
    try:
        await service.delete_file(
            file_id=file_id,
            owner_id=api_key.owner_id,
        )
        return ApiResponse.success(data=None, message="Document deleted")
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found or access denied",
        )
