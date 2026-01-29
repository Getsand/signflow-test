"""
SigningRequest Repository - Database operations
"""

from typing import List, Optional
from uuid import UUID
from datetime import datetime

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.modules.signing_requests.models import (
    SigningRequest,
    SigningRequestStatus,
    SigningOrder,
    SigningRequestRecipient,
    RecipientStatus,
    SigningRequestField,
)


class SigningRequestRepository:
    """Database operations for signing requests and related entities."""

    def __init__(self, session: AsyncSession):
        self.session = session

    # ------------------------------------------------------------------
    # SigningRequest CRUD
    # ------------------------------------------------------------------
    async def create(
        self,
        *,
        file_id: UUID,
        owner_id: UUID,
        title: Optional[str] = None,
        signing_order: SigningOrder = SigningOrder.SEQUENTIAL,
    ) -> SigningRequest:
        """Create a new signing request."""
        signing_request = SigningRequest(
            file_id=file_id,
            owner_id=owner_id,
            title=title,
            status=SigningRequestStatus.DRAFT,
            signing_order=signing_order,
        )

        self.session.add(signing_request)
        await self.session.flush()
        await self.session.refresh(signing_request)

        return signing_request

    async def delete(
        self,
        *,
        signing_request_id: UUID,
        owner_id: UUID,
    ) -> bool:
        """
        Delete a signing request.
        
        Only the owner can delete.
        CASCADE delete will automatically remove recipients and fields.
        
        Returns True if deleted, False if not found.
        """
        stmt = (
            select(SigningRequest)
            .where(
                SigningRequest.id == signing_request_id,
                SigningRequest.owner_id == owner_id,
            )
        )
        result = await self.session.execute(stmt)
        signing_request = result.scalar_one_or_none()
        
        if not signing_request:
            return False
        
        await self.session.delete(signing_request)
        return True

    async def get_by_id(
        self,
        *,
        signing_request_id: UUID,
        owner_id: UUID,
    ) -> Optional[SigningRequest]:
        """Get signing request by ID with ownership check."""
        stmt = (
            select(SigningRequest)
            .options(
                joinedload(SigningRequest.file),
                joinedload(SigningRequest.recipients),
                joinedload(SigningRequest.fields),
            )
            .where(
                SigningRequest.id == signing_request_id,
                SigningRequest.owner_id == owner_id,
            )
        )

        result = await self.session.execute(stmt)
        return result.unique().scalar_one_or_none()

    async def get_by_file_id(
        self,
        *,
        file_id: UUID,
    ) -> Optional[SigningRequest]:
        """Get signing request by file ID."""
        stmt = select(SigningRequest).where(SigningRequest.file_id == file_id)

        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_by_owner(
        self,
        *,
        owner_id: UUID,
    ) -> List[SigningRequest]:
        """List all signing requests for a user."""
        stmt = (
            select(SigningRequest)
            .options(
                joinedload(SigningRequest.file),
                joinedload(SigningRequest.recipients),
            )
            .where(SigningRequest.owner_id == owner_id)
            .order_by(SigningRequest.created_at.desc())
        )

        result = await self.session.execute(stmt)
        return list(result.unique().scalars().all())

    async def get_stats(self, *, owner_id: UUID) -> dict:
        """Get signing request statistics for a user."""
        stmt = (
            select(
                func.count(SigningRequest.id).label("total"),
                func.count(SigningRequest.id)
                .filter(SigningRequest.status == SigningRequestStatus.DRAFT)
                .label("draft"),
                func.count(SigningRequest.id)
                .filter(SigningRequest.status == SigningRequestStatus.SENT)
                .label("sent"),
                func.count(SigningRequest.id)
                .filter(SigningRequest.status == SigningRequestStatus.IN_PROGRESS)
                .label("in_progress"),
                func.count(SigningRequest.id)
                .filter(SigningRequest.status == SigningRequestStatus.COMPLETED)
                .label("completed"),
            )
            .where(SigningRequest.owner_id == owner_id)
        )

        result = await self.session.execute(stmt)
        row = result.one()

        return {
            "total": row.total or 0,
            "draft": row.draft or 0,
            "sent": row.sent or 0,
            "in_progress": row.in_progress or 0,
            "completed": row.completed or 0,
        }

    async def update_status(
        self,
        *,
        signing_request_id: UUID,
        status: SigningRequestStatus,
    ) -> None:
        """Update signing request status."""
        stmt = select(SigningRequest).where(SigningRequest.id == signing_request_id)

        result = await self.session.execute(stmt)
        signing_request = result.scalar_one_or_none()

        if signing_request:
            signing_request.status = status
            await self.session.flush()

    # ------------------------------------------------------------------
    # Recipients
    # ------------------------------------------------------------------
    async def create_recipients(
        self,
        *,
        signing_request_id: UUID,
        recipients: List[dict],
    ) -> List[SigningRequestRecipient]:
        """Create recipients for a signing request."""
        recipient_objects: List[SigningRequestRecipient] = []
        for recipient_data in recipients:
            recipient = SigningRequestRecipient(
                signing_request_id=signing_request_id,
                role=recipient_data["role"],
                email=recipient_data["email"],
                order_index=recipient_data["order_index"],
                status=RecipientStatus.PENDING,
            )
            recipient_objects.append(recipient)
            self.session.add(recipient)

        await self.session.flush()
        return recipient_objects

    async def get_recipients(
        self,
        *,
        signing_request_id: UUID,
    ) -> List[SigningRequestRecipient]:
        """Get all recipients for a signing request."""
        stmt = (
            select(SigningRequestRecipient)
            .where(SigningRequestRecipient.signing_request_id == signing_request_id)
            .order_by(SigningRequestRecipient.order_index)
        )

        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def update_recipient_token_and_sent_at(
        self,
        *,
        recipient_id: UUID,
        signing_token: str,
        sent_at: Optional[datetime],
    ) -> None:
        """Update recipient with signing token and sent_at timestamp."""
        stmt = select(SigningRequestRecipient).where(
            SigningRequestRecipient.id == recipient_id
        )

        result = await self.session.execute(stmt)
        recipient = result.scalar_one_or_none()

        if recipient:
            recipient.signing_token = signing_token
            recipient.sent_at = sent_at
            await self.session.flush()

    # ------------------------------------------------------------------
    # Signing request fields
    # ------------------------------------------------------------------
    async def create_fields_bulk(
        self,
        *,
        fields: List[SigningRequestField],
    ) -> None:
        """Bulk insert signing request fields in a single transaction."""
        self.session.add_all(fields)
        await self.session.flush()

    async def list_fields_for_request(
        self,
        *,
        signing_request_id: UUID,
    ) -> List[SigningRequestField]:
        """List all fields for a signing request."""
        stmt = (
            select(SigningRequestField)
            .where(SigningRequestField.signing_request_id == signing_request_id)
            .order_by(SigningRequestField.page, SigningRequestField.created_at)
        )

        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def list_fields_for_recipient(
        self,
        *,
        recipient_id: UUID,
    ) -> List[SigningRequestField]:
        """List all fields assigned to a recipient."""
        stmt = (
            select(SigningRequestField)
            .where(SigningRequestField.recipient_id == recipient_id)
            .order_by(SigningRequestField.page, SigningRequestField.created_at)
        )

        result = await self.session.execute(stmt)
        return list(result.scalars().all())

