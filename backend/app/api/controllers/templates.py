"""Public API: template endpoints (Zoho Sign style). Template = document with signature fields."""

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
    TemplateFieldCreate,
)

router = APIRouter(prefix="/templates", tags=["templates"])


@router.get("", response_model=ApiResponse[list])
async def list_templates(
    db: AsyncSession = Depends(get_db),
    api_key: ApiKey = Depends(get_validated_api_key),
):
    """Get template list. Templates are documents (files) that can be used for signing requests."""
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
async def create_template_presign(
    payload: PresignRequest,
    db: AsyncSession = Depends(get_db),
    api_key: ApiKey = Depends(get_validated_api_key),
):
    """Create template: get presigned URL to upload file. Then PUT to upload_url and call finalize."""
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
            message="Upload URL for template. PUT file then POST /templates/{file_id}/finalize.",
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/{template_id}", response_model=ApiResponse[DocumentDetailData])
async def get_template(
    template_id: UUID,
    db: AsyncSession = Depends(get_db),
    api_key: ApiKey = Depends(get_validated_api_key),
):
    """Get template (document) metadata and signature fields."""
    service = FileService(FileRepository(db))
    sig_service = SignatureFieldService(
        sig_repo=SignatureFieldRepository(db),
        file_repo=FileRepository(db),
    )
    try:
        file_obj = await service.get_file_details(
            file_id=template_id,
            owner_id=api_key.owner_id,
        )
        signature_fields = await sig_service.list_fields(
            file_id=template_id,
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
                "field_type": getattr(f, "field_type", "SIGNATURE"),
                "role": getattr(f, "role", None),
                "assigned_to": str(f.assigned_to),
                "status": getattr(f.status, "value", f.status),
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
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found or access denied",
        )


@router.post("/{template_id}/finalize", response_model=ApiResponse[dict])
async def finalize_template(
    template_id: UUID,
    db: AsyncSession = Depends(get_db),
    api_key: ApiKey = Depends(get_validated_api_key),
):
    """Finalize template upload after file was PUT to presigned URL."""
    service = FileService(FileRepository(db))
    try:
        updated = await service.finalize_upload(
            file_id=template_id,
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
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found or access denied",
        )


@router.put("/{template_id}", response_model=ApiResponse[dict])
async def update_template(
    template_id: UUID,
    payload: DocumentUpdateRequest,
    db: AsyncSession = Depends(get_db),
    api_key: ApiKey = Depends(get_validated_api_key),
):
    """Update template (rename)."""
    service = FileService(FileRepository(db))
    try:
        updated = await service.rename_file(
            file_id=template_id,
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
            message="Template updated",
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/{template_id}/fields", response_model=ApiResponse[dict], status_code=status.HTTP_201_CREATED)
async def add_template_field(
    template_id: UUID,
    payload: TemplateFieldCreate,
    db: AsyncSession = Depends(get_db),
    api_key: ApiKey = Depends(get_validated_api_key),
):
    """Add a signature field to a template. Role matches recipient when sending for signature."""
    sig_service = SignatureFieldService(
        sig_repo=SignatureFieldRepository(db),
        file_repo=FileRepository(db),
    )
    try:
        field = await sig_service.create_field(
            file_id=template_id,
            page_number=payload.page,
            x=payload.x,
            y=payload.y,
            width=payload.width,
            height=payload.height,
            assigned_to=api_key.owner_id,
            owner_id=api_key.owner_id,
            field_type=payload.field_type or "SIGNATURE",
            role=payload.role,
        )
        await db.commit()
        return ApiResponse.success(
            data={
                "id": str(field.id),
                "file_id": str(template_id),
                "page_number": field.page_number,
                "x": field.x,
                "y": field.y,
                "width": field.width,
                "height": field.height,
                "field_type": getattr(field, "field_type", "SIGNATURE"),
                "role": getattr(field, "role", None),
            },
            message="Field added",
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/{template_id}/fields", response_model=ApiResponse[list])
async def list_template_fields(
    template_id: UUID,
    db: AsyncSession = Depends(get_db),
    api_key: ApiKey = Depends(get_validated_api_key),
):
    """List signature fields on a template."""
    sig_service = SignatureFieldService(
        sig_repo=SignatureFieldRepository(db),
        file_repo=FileRepository(db),
    )
    try:
        fields = await sig_service.list_fields(
            file_id=template_id,
            user_id=api_key.owner_id,
        )
        items = [
            {
                "id": str(f.id),
                "page_number": f.page_number,
                "x": f.x,
                "y": f.y,
                "width": f.width,
                "height": f.height,
                "field_type": getattr(f, "field_type", "SIGNATURE"),
                "role": getattr(f, "role", None),
            }
            for f in fields
        ]
        return ApiResponse.success(data=items)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found or access denied",
        )
