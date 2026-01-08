# Alembic Import Architecture Fix

## Problem

Alembic migrations were failing because importing models triggered `get_settings()` which required runtime environment variables (REDIS_URL, MINIO, etc.).

**Root Cause:**
```
alembic/env.py
  → imports app.modules.auth.models
    → imports app.core.db  ❌
      → calls get_settings()  ❌
        → FAILS: requires runtime env vars
```

## Solution

Separated `Base` (metadata) from `app.core.db` (runtime config) by creating `app.core.base` with **zero side effects**.

**New Import Chain:**
```
alembic/env.py
  → imports app.core.base  ✅ (no side effects)
  → imports app.modules.auth.models
    → imports app.core.base  ✅ (no side effects)
```

## Files Changed

### 1. Created: `app/core/base.py`
**Purpose:** Contains ONLY `Base` class with metadata. No runtime side effects.
```python
from sqlalchemy import MetaData
from sqlalchemy.orm import DeclarativeBase

class Base(DeclarativeBase):
    metadata = MetaData(naming_convention={...})
```

### 2. Updated: `app/core/db.py`
**Change:** Import `Base` from `app.core.base` instead of defining it locally.
```diff
+ from app.core.base import Base

- class Base(DeclarativeBase):
-     ...
```

### 3. Updated: `alembic/env.py`
**Change:** Import `Base` from `app.core.base` (not `app.core.db`)
```diff
+ from app.core.base import Base

- # from app.core.db import Base  ❌ triggers get_settings()
```

### 4. Updated: `app/modules/auth/models.py`
**Change:** Import `Base` from `app.core.base`
```diff
- from app.core.db import Base
+ from app.core.base import Base
```

### 5. Updated: `app/modules/files/models.py`
**Change:** Import `Base` from `app.core.base`
```diff
- from app.core.db import Base
+ from app.core.base import Base
```

### 6. Updated: `app/shared/base_repo.py`
**Change:** Import `Base` from `app.core.base`
```diff
- from app.core.db import Base
+ from app.core.base import Base
```

### 7. Updated: `app/shared/base_service.py`
**Change:** Import `Base` from `app.core.base`
```diff
- from app.core.db import Base
+ from app.core.base import Base
```

### 8. Updated: `app/tests/conftest.py`
**Change:** Import `Base` from `app.core.base`, keep `get_db` from `app.core.db`
```diff
- from app.core.db import Base, get_db
+ from app.core.base import Base
+ from app.core.db import get_db
```

## Architecture Summary

```
┌─────────────────────────────────────────┐
│  app/core/base.py                       │
│  - Base class ONLY                      │
│  - NO imports of config/settings        │
│  - NO side effects                      │
│  - Safe for Alembic                     │
└────────────┬────────────────────────────┘
             │
             ├─────────────────────────────┐
             │                             │
┌────────────▼────────────┐   ┌────────────▼────────────┐
│  alembic/env.py         │   │  app/core/db.py         │
│  - Imports Base         │   │  - Imports Base         │
│  - Imports models       │   │  - Calls get_settings() │
│  - NO runtime deps      │   │  - Creates engine       │
└─────────────────────────┘   │  - Runtime only         │
                              └─────────────────────────┘
```

## Verification

### All Base imports are now from app.core.base:
```bash
$ grep -r "from app.core.base import Base" backend/
backend/app/tests/conftest.py:11:from app.core.base import Base
backend/app/shared/base_service.py:8:from app.core.base import Base
backend/app/shared/base_repo.py:9:from app.core.base import Base
backend/alembic/env.py:11:from app.core.base import Base
backend/app/modules/files/models.py:12:from app.core.base import Base
backend/app/modules/auth/models.py:13:from app.core.base import Base
backend/app/core/db.py:14:from app.core.base import Base
```

### No Base imports from app.core.db:
```bash
$ grep -r "from app.core.db import Base" backend/
# (empty - no matches) ✅
```

## Key Principles

1. **Separation of Concerns**
   - `app.core.base` = Metadata only (static)
   - `app.core.db` = Runtime configuration (dynamic)

2. **Zero Side Effects**
   - Importing `app.core.base` has NO side effects
   - No function calls at module level
   - No config/settings dependencies

3. **Alembic Independence**
   - Alembic NEVER imports `app.core.db`
   - Alembic only imports `app.core.base`
   - Models import `app.core.base`

4. **Runtime Unchanged**
   - Application runtime still works identically
   - `app.core.db` can call `get_settings()` freely
   - No behavioral changes

## Testing

```bash
# Test Alembic (should work without runtime env vars)
cd backend
unset REDIS_HOST REDIS_PORT MINIO_ENDPOINT
export DATABASE_URL="postgresql://..."
alembic upgrade head  # Should work ✅

# Test runtime (should work as before)
export REDIS_HOST=redis
export MINIO_ENDPOINT=minio:9000
python -m app.main  # Should work ✅

# Run tests
pytest  # Should work ✅
```

## Diff Summary

**Files Modified:** 8
- `app/core/base.py` - Created (new file with Base)
- `app/core/db.py` - Import Base from app.core.base
- `alembic/env.py` - Import Base from app.core.base
- `app/modules/auth/models.py` - Import Base from app.core.base
- `app/modules/files/models.py` - Import Base from app.core.base
- `app/shared/base_repo.py` - Import Base from app.core.base
- `app/shared/base_service.py` - Import Base from app.core.base
- `app/tests/conftest.py` - Import Base from app.core.base

**Lines Changed:** ~8 lines (one import per file)

**Complexity:** Minimal - simple import changes

**Risk:** Low - no logic changes, only import refactoring

---

✅ **Architecture is now clean and correct.**

