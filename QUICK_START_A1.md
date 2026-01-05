# Quick Start - Phase A1

## Setup (First Time)

```bash
cd signflow

# Copy environment template to .env
cp backend/ENV_TEMPLATE.txt backend/.env

# Start all services
make up

# Run database migrations
make migrate

# Run tests to verify
make test
```

## Verify Installation

```bash
# 1. Check all services are healthy
docker-compose ps

# 2. Test health endpoint
curl http://localhost:8000/health

# 3. Check request ID in response
curl -v http://localhost:8000/health 2>&1 | grep X-Request-ID

# 4. View structured logs
make logs-backend

# 5. Access API documentation
# Open: http://localhost:8000/docs
```

## Common Commands

```bash
make up              # Start services
make down            # Stop services
make logs-backend    # View backend logs
make migrate         # Run migrations
make test            # Run tests
make shell           # Backend shell
make shell-db        # Database shell
make restart-backend # Restart backend
```

## What's Included

✅ **Structured Logging** - Request ID tracking  
✅ **Middleware** - Request tracking & security headers  
✅ **Exception Handling** - Consistent error responses  
✅ **Base Patterns** - Repository & Service layers  
✅ **Testing** - Pytest with async support  
✅ **Health Check** - GET /health with request tracking  

## Test Request ID Tracking

```bash
# Make a request and see the request_id
curl -v http://localhost:8000/health 2>&1 | grep -E "(X-Request-ID|request_id)"

# View logs with request_id
make logs-backend
```

## Example: Using Base Repository

```python
from app.models.user import User
from app.shared.base_repo import BaseRepository
from app.core.db import get_db

# In a route or service
async def create_user(db: AsyncSession):
    repo = BaseRepository(User, db)
    user = await repo.create(
        email="test@example.com",
        full_name="Test User"
    )
    return user
```

## Example: Structured Logging

```python
from app.core.logging import get_logger

logger = get_logger(__name__)

# Logs will include request_id automatically
logger.info("Processing request")
logger.error("Something went wrong", exc_info=True)
```

## Example: Custom Exception

```python
from app.shared.exceptions import NotFoundError

# Raise exception
raise NotFoundError(
    message="User not found",
    details={"user_id": 123}
)

# Automatically converted to proper HTTP response
```

## Access Points

- **API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs
- **Health**: http://localhost:8000/health
- **MinIO Console**: http://localhost:9001 (minioadmin/minioadmin)
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379

## Troubleshooting

### Services won't start
```bash
make down
make clean
make build
make up
```

### Migrations fail
```bash
# Check database is healthy
docker-compose ps

# Try again
make migrate
```

### Tests fail
```bash
# Ensure backend is running
docker-compose ps backend

# Run with verbose output
docker-compose exec backend pytest -v
```

## Next: Add Business Logic

Phase A1 provides the foundation. To add new features:

1. **Create Model** in `app/models/`
2. **Create Repository** extending `BaseRepository`
3. **Create Service** extending `BaseService`
4. **Add Routes** in `app/main.py` or new router
5. **Write Tests** in `app/tests/`
6. **Create Migration** with `make revision m="description"`
7. **Apply Migration** with `make migrate`

---

🎉 **Phase A1 Complete** - Ready for business logic!

