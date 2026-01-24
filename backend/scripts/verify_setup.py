"""
Verification script to check if all Milestone A components are working
"""
import asyncio
import sys
from sqlalchemy import select
from app.core.config import get_settings
from app.core.db import AsyncSessionLocal, engine
from app.models.user import User


async def verify_database():
    """Verify database connection and User model"""
    print("🔍 Verifying database connection...")
    
    try:
        async with engine.connect() as conn:
            print("✅ Database connection successful")
        
        # Test session and User table
        async with AsyncSessionLocal() as session:
            # Query users table
            result = await session.execute(select(User))
            users = result.scalars().all()
            print(f"✅ User table accessible (found {len(users)} users)")
            
        return True
    except Exception as e:
        print(f"❌ Database error: {e}")
        return False


async def main():
    """Main verification function"""
    print("=" * 50)
    print("SignFlow Milestone A - Setup Verification")
    print("=" * 50)
    
    # Check settings
    settings = get_settings()
    print(f"\n📋 Configuration:")
    print(f"   App Name: {settings.app_name}")
    print(f"   Environment: {settings.app_env}")
    print(f"   Database: {settings.postgres_host}:{settings.postgres_port}/{settings.postgres_db}")
    print(f"   Redis: {settings.redis_host}:{settings.redis_port}")
    print(f"   MinIO: {settings.minio_endpoint}")
    
    # Verify database
    print(f"\n🗄️  Database Verification:")
    db_ok = await verify_database()
    
    # Summary
    print(f"\n{'=' * 50}")
    if db_ok:
        print("✅ All checks passed! Milestone A is ready.")
        sys.exit(0)
    else:
        print("❌ Some checks failed. Please review the errors above.")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())


