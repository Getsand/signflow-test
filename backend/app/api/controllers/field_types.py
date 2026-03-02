"""Public API: field types (Zoho Sign style). Retrieve supported signature field types."""

from fastapi import APIRouter, Depends

from app.api.deps import get_validated_api_key
from app.api.models import ApiKey
from app.api.schemas import ApiResponse

router = APIRouter(prefix="/field-types", tags=["field-types"])

# Supported field types (matches signatures module and Zoho-style)
FIELD_TYPES = [
    {"id": "SIGNATURE", "name": "Signature", "description": "Full signature"},
    {"id": "INITIAL", "name": "Initial", "description": "Initials"},
    {"id": "DATE", "name": "Date", "description": "Date field"},
    {"id": "TEXT", "name": "Text", "description": "Free text"},
    {"id": "EMAIL", "name": "Email", "description": "Email address"},
    {"id": "FULLNAME", "name": "Full Name", "description": "Full name"},
    {"id": "COMPANY", "name": "Company", "description": "Company name"},
]


@router.get("", response_model=ApiResponse[list])
async def get_field_types(
    api_key: ApiKey = Depends(get_validated_api_key),
):
    """Retrieve field types. Zoho Sign style."""
    return ApiResponse.success(data=FIELD_TYPES)
