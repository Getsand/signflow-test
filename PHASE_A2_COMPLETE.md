# ✅ PHASE A2 — Database & Alembic Foundation Complete

## Overview
Database foundation with SQLAlchemy 2.0 async, Alembic migrations, and User model with UUID primary key.

## Deliverables ✅

### 1. Alembic Configuration
- ✅ `alembic.ini` - Alembic configuration file
- ✅ `alembic/env.py` - **Async SQLAlchemy 2.0 environment**
  - Configured for async engine
  - Reads database URL from settings
  - Proper target_metadata setup
  - Imports all models for migration detection

### 2. Auth Module with User Model
- ✅ `backend/app/modules/auth/models.py` - **User model with UUID**
  - UUID primary key (PostgreSQL native)
  - Email authentication support
  - Google OAuth support (google_sub)
  - Password hash storage
  - Verification status tracking
  - Timezone-aware timestamps

### 3. Initial Migration
- ✅ `alembic/versions/001_initial_users_table.py` - **Users table migration**
  - Creates users table with all fields
  - Proper indexes on email and google_sub
  - Constraints and defaults
  - Upgrade and downgrade functions

## Technical Details

### User Model Schema

```python
class User(Base):
    __tablename__ = "users"
    
    # UUID primary key (PostgreSQL native)
    id: UUID (primary key, auto-generated)
    
    # Authentication
    email: str (unique, indexed, required)
    password_hash: str (nullable - for email/password auth)
    google_sub: str (nullable, unique, indexed - for Google OAuth)
    
    # Profile
    name: str (nullable)
    
    # Status
    is_verified: bool (default: false)
    
    # Timestamps
    created_at: datetime (timezone-aware, auto-generated)
```

### Database Schema (SQL)

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    password_hash VARCHAR(255),
    google_sub VARCHAR(255),
    is_verified BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX ix_users_email ON users (email);
CREATE UNIQUE INDEX ix_users_google_sub ON users (google_sub);
```

## Key Features

### 1. UUID Primary Keys
- PostgreSQL native UUID type
- Auto-generated with uuid.uuid4()
- Better for distributed systems
- No sequential ID enumeration

### 2. Dual Authentication Support
- **Email/Password**: email + password_hash fields
- **Google OAuth**: google_sub field for Google user ID
- Both can coexist (user can link accounts)

### 3. SQLAlchemy 2.0 Style
```python
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID

# Proper type hints
id: Mapped[uuid.UUID] = mapped_column(
    UUID(as_uuid=True),
    primary_key=True,
    default=uuid.uuid4
)

# Nullable fields
name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
```

### 4. Alembic Async Configuration
```python
# env.py uses async engine
async def run_async_migrations() -> None:
    connectable = async_engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
        future=True,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
```

### 5. Timezone-Aware Timestamps
```python
created_at: Mapped[datetime] = mapped_column(
    DateTime(timezone=True),  # Stores timezone info
    server_default=func.now(),  # Database-generated
    nullable=False
)
```

## Project Structure

```
signflow/backend/
├── app/
│   ├── modules/                    # ⭐ New: Business modules
│   │   ├── __init__.py
│   │   └── auth/                   # ⭐ Auth module
│   │       ├── __init__.py
│   │       └── models.py           # ⭐ User model (UUID-based)
│   ├── core/
│   │   ├── config.py
│   │   ├── db.py
│   │   ├── logging.py
│   │   └── middleware.py
│   ├── shared/
│   │   ├── exceptions.py
│   │   ├── base_repo.py
│   │   └── base_service.py
│   ├── tests/
│   │   ├── conftest.py             # Updated fixtures
│   │   ├── test_health.py
│   │   └── test_base_repo.py       # Updated for UUID
│   └── main.py
├── alembic/
│   ├── versions/
│   │   └── 001_initial_users_table.py  # ⭐ UUID users table
│   ├── env.py                      # Updated imports
│   └── script.py.mako
├── alembic.ini
├── requirements.txt
└── Dockerfile
```

## Migration Commands

### Create Migration (Auto-generate)
```bash
make revision m="description"
# or
docker-compose exec backend alembic revision --autogenerate -m "description"
```

### Apply Migrations
```bash
make migrate
# or
docker-compose exec backend alembic upgrade head
```

### Rollback Migration
```bash
docker-compose exec backend alembic downgrade -1
```

### View Migration History
```bash
docker-compose exec backend alembic history
```

### Check Current Version
```bash
docker-compose exec backend alembic current
```

## Testing

All tests updated for UUID-based User model:

```python
import uuid
from app.modules.auth import User

# Create user with UUID
user = await repo.create(email="test@example.com", name="Test")
assert isinstance(user.id, uuid.UUID)

# Query by UUID
user = await repo.get_by_id(some_uuid)

# Non-existent user
user = await repo.get_by_id(uuid.uuid4())  # Returns None
```

### Run Tests
```bash
make test
# or
docker-compose exec backend pytest -v
```

## Usage Examples

### Create User (Email/Password)
```python
from app.modules.auth import User
from app.shared.base_repo import BaseRepository

repo = BaseRepository(User, session)
user = await repo.create(
    email="user@example.com",
    name="John Doe",
    password_hash="$2b$12$...",  # Already hashed
    is_verified=False
)
```

### Create User (Google OAuth)
```python
user = await repo.create(
    email="user@example.com",
    name="Jane Doe",
    google_sub="google-user-id-123",
    is_verified=True  # Google users auto-verified
)
```

### Query Users
```python
# By UUID
user = await repo.get_by_id(user_uuid)

# By email (need custom repository method)
from sqlalchemy import select

stmt = select(User).where(User.email == "user@example.com")
result = await session.execute(stmt)
user = result.scalar_one_or_none()
```

## What's NOT Included (As Specified)

❌ Login/Register endpoints  
❌ Authentication routes  
❌ Password hashing logic  
❌ JWT tokens  
❌ Refresh tokens  
❌ Services/repositories for auth  
❌ Seed data  

This is **pure database foundation** - auth logic comes in future phases.

## Database Verification

### Connect to Database
```bash
make shell-db
```

### Check Table Structure
```sql
\d users

-- Should show:
-- id (uuid, primary key)
-- email (varchar, unique)
-- name (varchar, nullable)
-- password_hash (varchar, nullable)
-- google_sub (varchar, unique, nullable)
-- is_verified (boolean, default false)
-- created_at (timestamp with time zone)
```

### Check Indexes
```sql
\di

-- Should show:
-- ix_users_email (UNIQUE)
-- ix_users_google_sub (UNIQUE)
```

## Changes from Phase A1

### Removed
- ❌ `app/models/user.py` - Old integer-based User model
- ❌ `app/models/__init__.py` - Old models directory
- ❌ Old migration with integer IDs

### Added
- ✅ `app/modules/` - New module structure
- ✅ `app/modules/auth/` - Auth module
- ✅ UUID-based User model
- ✅ Updated migration with UUID

### Updated
- ✅ `alembic/env.py` - Imports from modules.auth
- ✅ `app/tests/conftest.py` - Updated fixtures for new User
- ✅ `app/tests/test_base_repo.py` - UUID-aware tests

## Alembic Configuration Highlights

### env.py Features
```python
# Async migration support
async def run_async_migrations() -> None:
    connectable = async_engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
        future=True,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

# Proper model imports
from app.modules.auth import User  # Ensures User is in metadata

# Target metadata
target_metadata = Base.metadata  # All models registered here
```

### alembic.ini
- Configured for PostgreSQL
- Database URL read from environment via settings
- Proper logging configuration

## Best Practices Implemented

✅ **UUID Primary Keys** - Better for distributed systems  
✅ **Timezone-Aware Timestamps** - Proper datetime handling  
✅ **Nullable Auth Fields** - Support multiple auth methods  
✅ **Unique Constraints** - Email and google_sub uniqueness  
✅ **Indexes** - Fast lookups on email and google_sub  
✅ **SQLAlchemy 2.0 Style** - Modern declarative syntax  
✅ **Async Migrations** - Proper async/await throughout  
✅ **Type Hints** - Full type safety with Mapped[]  

## Verification Steps

### 1. Start Services
```bash
cd signflow
make up
```

### 2. Run Migration
```bash
make migrate
```

Expected output:
```
INFO  [alembic.runtime.migration] Running upgrade  -> 001, Initial users table
```

### 3. Verify Table
```bash
make shell-db
\d users
```

### 4. Run Tests
```bash
make test
```

All tests should pass with UUID-based User model.

### 5. Check Migration Status
```bash
docker-compose exec backend alembic current
```

Should show: `001 (head)`

## Next Steps

**Phase B** will add:
- Password hashing (bcrypt/argon2)
- JWT token generation/validation
- Login/Register endpoints
- Refresh token logic
- Email verification
- OAuth integration

**Phase C** onwards:
- User profile management
- Role-based access control
- Additional business modules

## Migration Strategy

### Development
- Use `alembic revision --autogenerate` for schema changes
- Review and edit generated migrations
- Test migrations with upgrade/downgrade

### Production
- Never use autogenerate in production
- Review all migrations before deployment
- Test rollback procedures
- Backup database before migrations

## Common Issues & Solutions

### Issue: UUID not working with SQLite (tests)
**Solution**: Tests use SQLite which may not fully support UUID. For production, PostgreSQL handles UUIDs natively.

### Issue: Migration not detecting changes
**Solution**: Ensure models are imported in `alembic/env.py` and registered with `Base.metadata`.

### Issue: Timezone issues
**Solution**: Use `DateTime(timezone=True)` and `func.now()` for server-side timestamps.

---

**Implementation Date**: January 5, 2026  
**Status**: ✅ Phase A2 Complete - Database Foundation Ready  
**Next Phase**: Authentication Logic (Login, Register, JWT)

