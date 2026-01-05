"""
Tests for base repository pattern
"""
import uuid
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.auth import User
from app.shared.base_repo import BaseRepository
from app.shared.exceptions import NotFoundError


@pytest.mark.asyncio
async def test_create_user(db_session: AsyncSession, sample_user_data):
    """Test creating a user through repository"""
    repo = BaseRepository(User, db_session)
    
    user = await repo.create(**sample_user_data)
    
    assert user.id is not None
    assert isinstance(user.id, uuid.UUID)
    assert user.email == sample_user_data["email"]
    assert user.name == sample_user_data["name"]


@pytest.mark.asyncio
async def test_get_by_id(db_session: AsyncSession, sample_user_data):
    """Test retrieving user by ID"""
    repo = BaseRepository(User, db_session)
    
    # Create user
    created_user = await repo.create(**sample_user_data)
    await db_session.commit()
    
    # Retrieve user
    retrieved_user = await repo.get_by_id(created_user.id)
    
    assert retrieved_user is not None
    assert retrieved_user.id == created_user.id
    assert retrieved_user.email == created_user.email


@pytest.mark.asyncio
async def test_get_by_id_not_found(db_session: AsyncSession):
    """Test retrieving non-existent user returns None"""
    repo = BaseRepository(User, db_session)
    
    # Use a random UUID that doesn't exist
    user = await repo.get_by_id(uuid.uuid4())
    
    assert user is None


@pytest.mark.asyncio
async def test_get_by_id_or_fail_raises(db_session: AsyncSession):
    """Test get_by_id_or_fail raises NotFoundError"""
    repo = BaseRepository(User, db_session)
    
    with pytest.raises(NotFoundError):
        await repo.get_by_id_or_fail(uuid.uuid4())


@pytest.mark.asyncio
async def test_get_all(db_session: AsyncSession):
    """Test retrieving all users"""
    repo = BaseRepository(User, db_session)
    
    # Create multiple users
    await repo.create(email="user1@example.com", name="User 1")
    await repo.create(email="user2@example.com", name="User 2")
    await db_session.commit()
    
    # Retrieve all
    users = await repo.get_all()
    
    assert len(users) == 2


@pytest.mark.asyncio
async def test_update_by_id(db_session: AsyncSession, sample_user_data):
    """Test updating a user"""
    repo = BaseRepository(User, db_session)
    
    # Create user
    user = await repo.create(**sample_user_data)
    await db_session.commit()
    
    # Update user
    updated_user = await repo.update_by_id(
        user.id,
        name="Updated Name"
    )
    
    assert updated_user.name == "Updated Name"


@pytest.mark.asyncio
async def test_delete_by_id(db_session: AsyncSession, sample_user_data):
    """Test deleting a user"""
    repo = BaseRepository(User, db_session)
    
    # Create user
    user = await repo.create(**sample_user_data)
    await db_session.commit()
    
    # Delete user
    result = await repo.delete_by_id(user.id)
    await db_session.commit()
    
    assert result is True
    
    # Verify deletion
    deleted_user = await repo.get_by_id(user.id)
    assert deleted_user is None


@pytest.mark.asyncio
async def test_exists(db_session: AsyncSession, sample_user_data):
    """Test checking if user exists"""
    repo = BaseRepository(User, db_session)
    
    # Create user
    user = await repo.create(**sample_user_data)
    await db_session.commit()
    
    # Check existence
    assert await repo.exists(user.id) is True
    assert await repo.exists(uuid.uuid4()) is False


@pytest.mark.asyncio
async def test_count(db_session: AsyncSession):
    """Test counting users"""
    repo = BaseRepository(User, db_session)
    
    # Create users
    await repo.create(email="user1@example.com", name="User 1")
    await repo.create(email="user2@example.com", name="User 2")
    await db_session.commit()
    
    # Count
    count = await repo.count()
    
    assert count == 2

