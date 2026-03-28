"""Map wrapper-owned request IDs to SignFlo backend signing-request IDs."""
from __future__ import annotations

from typing import Optional, Tuple

from sqlalchemy.ext.asyncio import AsyncSession

from app import wrapper_zoho_store
from app.models import WrapperZohoRequest

from api.zoho.auth import ZohoAPIError


async def resolve_backend_signing_request_id(
    session: AsyncSession,
    request_id: str,
    *,
    allow_draft: bool = False,
) -> Tuple[Optional[str], Optional[WrapperZohoRequest]]:
    """
    If request_id is a wrapper draft row:
      - allow_draft True  -> (None, row)
      - allow_draft False -> ZohoAPIError (must send first)
    If mapped to a backend signing request -> (backend_uuid, row)
    If unknown to wrapper -> treat as legacy backend id (request_id, None)
    """
    row = await wrapper_zoho_store.get_by_wrapper_id(session, request_id)
    if row is None:
        return request_id, None
    if row.backend_signing_request_id:
        return row.backend_signing_request_id, row
    if allow_draft:
        return None, row
    raise ZohoAPIError(
        code=400,
        message=(
            "Request is still in draft. Upload and metadata were saved; "
            "call POST /api/v1/requests/{request_id}/send to add signing fields and notify signers."
        ),
        status_code=400,
    )
