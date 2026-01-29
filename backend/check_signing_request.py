"""Check last signing request status"""
import asyncio
from sqlalchemy import select, desc
from app.core.db import get_db
from app.modules.signing_requests.models import SigningRequest
from app.modules.signing_requests.repo import SigningRequestRepository


async def check_last_signing_request():
    async for db in get_db():
        repo = SigningRequestRepository(db)
        
        # Get the most recent signing request
        stmt = select(SigningRequest).order_by(desc(SigningRequest.created_at)).limit(1)
        result = await db.execute(stmt)
        sr = result.scalar_one_or_none()
        
        if not sr:
            print("No signing requests found.")
            return
        
        print("=" * 60)
        print("LAST SIGNING REQUEST STATUS")
        print("=" * 60)
        print(f"ID: {sr.id}")
        print(f"Status: {sr.status.value}")
        print(f"Title: {sr.title}")
        print(f"Created At: {sr.created_at}")
        print(f"Sent At: {sr.sent_at or 'Not sent yet'}")
        print(f"Completed At: {sr.completed_at or 'Not completed'}")
        print()
        
        # Get recipients
        recipients = await repo.get_recipients(signing_request_id=sr.id)
        print(f"Recipients: {len(recipients)}")
        print("-" * 60)
        
        for r in recipients:
            token_preview = r.signing_token[:20] + "..." if r.signing_token else "None"
            print(f"  Role: {r.role}")
            print(f"  Email: {r.email}")
            print(f"  Status: {r.status.value}")
            print(f"  Signing Token: {token_preview}")
            print(f"  Sent At: {r.sent_at or 'Not sent'}")
            print()
        
        print("=" * 60)
        break


if __name__ == "__main__":
    asyncio.run(check_last_signing_request())
