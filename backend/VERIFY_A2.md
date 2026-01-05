# Phase A2 Verification Checklist

Run these commands to verify Phase A2 implementation.

## 1. Check Project Structure

```bash
# Verify auth module exists
ls -la app/modules/auth/

# Should show:
# - __init__.py
# - models.py
```

## 2. Start Services

```bash
cd signflow
make up

# Wait for all services to be healthy
docker-compose ps
```

## 3. Run Migration

```bash
make migrate

# Expected output:
# INFO  [alembic.runtime.migration] Running upgrade  -> 001, Initial users table
```

## 4. Check Migration Status

```bash
docker-compose exec backend alembic current

# Should show:
# 001 (head)
```

## 5. Verify Database Schema

```bash
make shell-db

# In PostgreSQL shell:
\d users

# Expected output:
# Column         | Type                        | Nullable | Default
# id             | uuid                        | not null |
# email          | character varying(255)      | not null |
# name           | character varying(255)      |          |
# password_hash  | character varying(255)      |          |
# google_sub     | character varying(255)      |          |
# is_verified    | boolean                     | not null | false
# created_at     | timestamp with time zone    | not null | now()
```

## 6. Check Indexes

```bash
# In PostgreSQL shell:
\di

# Should show:
# ix_users_email (UNIQUE)
# ix_users_google_sub (UNIQUE)
# pk_users (PRIMARY KEY)
```

## 7. Run Tests

```bash
make test

# All tests should pass, including:
# - test_create_user (with UUID)
# - test_get_by_id
# - test_get_by_id_not_found (with UUID)
# - test_update_by_id
# - test_delete_by_id
# - test_exists (with UUID)
# - test_count
```

## 8. Test User Creation (Python)

```bash
docker-compose exec backend python

# In Python shell:
>>> import asyncio
>>> from app.core.db import AsyncSessionLocal
>>> from app.modules.auth import User
>>> from app.shared.base_repo import BaseRepository
>>> 
>>> async def test():
...     async with AsyncSessionLocal() as session:
...         repo = BaseRepository(User, session)
...         user = await repo.create(
...             email="test@example.com",
...             name="Test User",
...             is_verified=False
...         )
...         await session.commit()
...         print(f"Created user: {user.id} - {user.email}")
...         return user
>>> 
>>> user = asyncio.run(test())
# Should print: Created user: <UUID> - test@example.com
```

## 9. Verify User Model Fields

```bash
docker-compose exec backend python

>>> from app.modules.auth import User
>>> import inspect
>>> 
>>> # Check model has all required fields
>>> fields = [attr for attr in dir(User) if not attr.startswith('_')]
>>> required = ['id', 'email', 'name', 'password_hash', 'google_sub', 'is_verified', 'created_at']
>>> for field in required:
...     assert field in fields, f"Missing field: {field}"
...     print(f"✓ {field}")
```

## 10. Check Alembic Configuration

```bash
# Check env.py imports User from modules.auth
grep "from app.modules.auth import User" backend/alembic/env.py

# Should return:
# from app.modules.auth import User  # noqa: F401
```

## 11. Verify UUID Type

```bash
docker-compose exec backend python

>>> import uuid
>>> from app.modules.auth import User
>>> 
>>> # Check id field is UUID
>>> from sqlalchemy import inspect as sa_inspect
>>> mapper = sa_inspect(User)
>>> id_col = mapper.columns['id']
>>> print(f"ID type: {id_col.type}")
>>> # Should show: UUID()
```

## 12. Test Migration Rollback

```bash
# Rollback migration
docker-compose exec backend alembic downgrade -1

# Check current version (should be empty)
docker-compose exec backend alembic current

# Re-apply migration
docker-compose exec backend alembic upgrade head

# Verify it worked
docker-compose exec backend alembic current
# Should show: 001 (head)
```

## 13. Check Logs

```bash
make logs-backend

# Should show no errors
# Look for:
# - "Starting SignFlow API..."
# - "INFO  [alembic.runtime.migration] Running upgrade"
```

## 14. API Health Check

```bash
curl http://localhost:8000/health

# Should return:
# {
#   "status": "healthy",
#   "app_name": "SignFlow",
#   "environment": "development",
#   "version": "0.1.0",
#   "request_id": "..."
# }
```

## Expected Results Summary

✅ Auth module created at `app/modules/auth/`  
✅ User model with UUID primary key  
✅ Migration 001 applied successfully  
✅ Users table created with all fields  
✅ Indexes created on email and google_sub  
✅ All tests passing  
✅ Alembic configured for async migrations  
✅ No linting errors  

## If Any Checks Fail

### Services not starting
```bash
make down
make clean
make build
make up
```

### Migration fails
```bash
# Check database is accessible
make shell-db
\l

# Check backend logs
make logs-backend

# Try fresh start
make down
make up
make migrate
```

### Tests fail
```bash
# Check specific test
docker-compose exec backend pytest app/tests/test_base_repo.py::test_create_user -v

# Check imports
docker-compose exec backend python -c "from app.modules.auth import User; print(User)"
```

---

**All checks passing?** ✅ Phase A2 is complete!

