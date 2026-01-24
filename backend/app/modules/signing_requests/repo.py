"""
SigningRequest Repository - Database operations
"""

from typing import List, Optional
from uuid import UUID

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.modules.signing_requests.models import SigningRequest, SigningRequestStatus


class SigningRequestRepository:
    """Database operations for signing requests"""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(
        self,
        *,
        file_id: UUID,
        owner_id: UUID,
        title: Optional[str] = None,
    ) -> SigningRequest:
        """Create a new signing request"""
        signing_request = SigningRequest(
            file_id=file_id,
            owner_id=owner_id,
            title=title,
            status=SigningRequestStatus.DRAFT,
        )
        
        self.session.add(signing_request)
        await self.session.flush()
        await self.session.refresh(signing_request)
        
        return signing_request

    async def get_by_id(
        self,
        *,
        signing_request_id: UUID,
        owner_id: UUID,
    ) -> Optional[SigningRequest]:
        """Get signing request by ID with ownership check"""
        stmt = (
            select(SigningRequest)
            .options(joinedload(SigningRequest.file))
            .where(
                SigningRequest.id == signing_request_id,
                SigningRequest.owner_id == owner_id,
            )
        )
        
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_by_owner(
        self,
        *,
        owner_id: UUID,
    ) -> List[SigningRequest]:
        """List all signing requests for a user"""
        stmt = (
            select(SigningRequest)
            .options(joinedload(SigningRequest.file))
            .where(SigningRequest.owner_id == owner_id)
            .order_by(SigningRequest.created_at.desc())
        )
        
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def get_stats(self, *, owner_id: UUID) -> dict:
        """Get signing request statistics for a user"""
        stmt = (
            select(
                func.count(SigningRequest.id).label("total"),
                func.count(SigningRequest.id).filter(
                    SigningRequest.status == SigningRequestStatus.DRAFT
                ).label("draft"),
                func.count(SigningRequest.id).filter(
                    SigningRequest.status == SigningRequestStatus.SENT
                ).label("sent"),
                func.count(SigningRequest.id).filter(
                    SigningRequest.status == SigningRequestStatus.IN_PROGRESS
                ).label("in_progress"),
                func.count(SigningRequest.id).filter(
                    SigningRequest.status == SigningRequestStatus.COMPLETED
                ).label("completed"),
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
        """Update signing request status"""
        stmt = (
            select(SigningRequest)
            .where(SigningRequest.id == signing_request_id)
        )
        
        result = await self.session.execute(stmt)
        signing_request = result.scalar_one_or_none()
        
        if signing_request:
            signing_request.status = status
            await self.session.flush()

    async def get_by_file_id(
        self,
        *,
        file_id: UUID,
    ) -> Optional[SigningRequest]:
        """Get signing request by file ID"""
        stmt = (
            select(SigningRequest)
            .where(SigningRequest.file_id == file_id)
        )
        
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()
