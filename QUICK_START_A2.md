# Quick Start - Phase A2 (Database & Alembic)

## What's New in Phase A2

✅ **UUID Primary Keys** - Better for distributed systems  
✅ **Dual Auth Support** - Email/password + Google OAuth  
✅ **Proper Module Structure** - `app/modules/auth/`  
✅ **Timezone-Aware Timestamps** - Proper datetime handling  
✅ **Updated Tests** - UUID-aware test fixtures  

## Setup & Migration

```bash
cd signflow

# Start services
make up

# Run the new migration
make migrate

# Verify migration
docker-compose exec backend alembic current
# Should show: 001 (head)
```

## Verify Database Schema

```bash
# Connect to PostgreSQL
make shell-db

# Check users table
\d users

# Check indexes
\di
```

Expected schema:
```sql
users:
  - id (uuid, primary key)
  - email (varchar 255, unique, indexed)
  - name (varchar 255, nullable)
  - password_hash (varchar 255, nullable)
  - google_sub (varchar 255, unique, indexed, nullable)
  - is_verified (boolean, default false)
  - created_at (timestamp with timezone)
```

## Run Tests

```bash
make test
```

All tests updated for UUID-based User model.

## User Model Structure

```python
from app.modules.auth import User

# User fields:
- id: UUID (auto-generated)
- email: str (required, unique)
- name: str (optional)
- password_hash: str (optional - for email/password auth)
- google_sub: str (optional, unique - for Google OAuth)
- is_verified: bool (default: false)
- created_at: datetime (auto, timezone-aware)
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
    password_hash="$2b$12$...",  # Pre-hashed
    is_verified=False
)

# User has UUID primary key
print(user.id)  # UUID('...')
```

### Create User (Google OAuth)
```python
user = await repo.create(
    email="user@gmail.com",
    name="Jane Doe",
    google_sub="google-user-123",
    is_verified=True  # Auto-verify Google users
)
```

### Query by UUID
```python
import uuid

user_id = uuid.UUID('...')
user = await repo.get_by_id(user_id)
```

## Migration Commands

```bash
# Create new migration (autogenerate)
make revision m="add new field"

# Apply migrations
make migrate

# Rollback one migration
docker-compose exec backend alembic downgrade -1

# Check current version
docker-compose exec backend alembic current

# View history
docker-compose exec backend alembic history
```

## Project Structure Changes

```
app/
├── modules/              # ⭐ NEW: Business modules
│   └── auth/            # ⭐ NEW: Auth module
│       ├── __init__.py
│       └── models.py    # ⭐ User model (UUID)
├── core/                # (unchanged)
├── shared/              # (unchanged)
└── tests/               # Updated for UUID

alembic/
└── versions/
    └── 001_initial_users_table.py  # ⭐ NEW: UUID-based
```

## What Was Removed

- ❌ `app/models/user.py` - Old integer-based User
- ❌ Old migration with integer IDs

## What's NOT Included Yet

- ❌ Login/Register endpoints
- ❌ Password hashing logic
- ❌ JWT tokens
- ❌ Auth routes/services

These come in **Phase B** (Authentication Logic).

## Testing

Tests are updated for UUID:

```python
import uuid
from app.modules.auth import User

# Create test user
user = await repo.create(email="test@example.com")
assert isinstance(user.id, uuid.UUID)

# Test with random UUID
non_existent = await repo.get_by_id(uuid.uuid4())
assert non_existent is None
```

## Troubleshooting

### Migration Fails
```bash
# Check if services are running
docker-compose ps

# Check backend logs
make logs-backend

# Try fresh migration
make down
make up
make migrate
```

### Tests Fail
```bash
# Run with verbose output
docker-compose exec backend pytest -v

# Run specific test
docker-compose exec backend pytest app/tests/test_base_repo.py -v
```

### Can't Connect to Database
```bash
# Check PostgreSQL is healthy
docker-compose ps postgres

# Restart services
make restart
```

## Key Differences from Phase A1

| Feature | Phase A1 | Phase A2 |
|---------|----------|----------|
| User ID | Integer | UUID |
| Location | `app/models/` | `app/modules/auth/` |
| Auth Support | None | Email + Google OAuth ready |
| Timestamps | Basic | Timezone-aware |
| google_sub | No | Yes (unique, indexed) |
| password_hash | No | Yes (nullable) |

## Next Steps

After Phase A2, you can:

1. **Phase B**: Add authentication logic
   - Password hashing (bcrypt)
   - JWT tokens
   - Login/Register endpoints

2. **Phase C**: User management
   - Profile endpoints
   - Email verification
   - Password reset

3. **Business Logic**: Build on this foundation
   - Documents module
   - Signatures module
   - Workflows module

---

🎉 **Phase A2 Complete** - Database foundation ready for auth!

