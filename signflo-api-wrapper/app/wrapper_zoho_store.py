"""Persist Zoho API drafts in the wrapper DB until POST .../send (wrapper-only)."""
from __future__ import annotations

from typing import Optional, Sequence
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import WrapperZohoRequest


async def create_draft(session: AsyncSession, *, file_id: str, requests_json: str) -> str:
    wrapper_id = str(uuid4())
    session.add(
        WrapperZohoRequest(
            wrapper_id=wrapper_id,
            file_id=file_id,
            requests_json=requests_json,
        )
    )
    await session.flush()
    return wrapper_id


async def get_by_wrapper_id(session: AsyncSession, wrapper_id: str) -> Optional[WrapperZohoRequest]:
    result = await session.execute(select(WrapperZohoRequest).where(WrapperZohoRequest.wrapper_id == wrapper_id))
    return result.scalar_one_or_none()


async def list_unsent_drafts(session: AsyncSession) -> Sequence[WrapperZohoRequest]:
    result = await session.execute(
        select(WrapperZohoRequest).where(WrapperZohoRequest.backend_signing_request_id.is_(None))
    )
    return result.scalars().all()


async def delete_row(session: AsyncSession, row: WrapperZohoRequest) -> None:
    await session.delete(row)
    await session.flush()
