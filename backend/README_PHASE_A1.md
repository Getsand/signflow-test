# SignFlow Backend - Phase A1

## Production-Ready FastAPI Skeleton

This is a complete, production-ready FastAPI backend skeleton implementing best practices for structured logging, middleware, exception handling, and testing.

## Architecture

### Layered Architecture
```
┌─────────────────────────────────────┐
│  FastAPI Application (main.py)     │
│  - Middleware Stack                 │
│  - Exception Handlers               │
│  - Route Definitions                │
└────────────┬────────────────────────┘
             │
┌────────────▼────────────────────────┐
│  Service Layer (base_service.py)   │
│  - Business Logic                   │
│  - Validation                       │
│  - Orchestration                    │
└────────────┬────────────────────────┘
             │
┌────────────▼────────────────────────┐
│  Repository Layer (base_repo.py)   │
│  - Data Access                      │
│  - CRUD Operations                  │
│  - Query Building                   │
└────────────┬────────────────────────┘
             │
┌────────────▼────────────────────────┐
│  Database (SQLAlchemy 2.0)         │
│  - PostgreSQL                       │
│  - Async Operations                 │
│  - Migrations (Alembic)             │
└─────────────────────────────────────┘
```

### Request Flow
```
HTTP Request
    ↓
RequestIDMiddleware → Generate/Extract request_id
    ↓
CORSSecurityMiddleware → Add security headers
    ↓
CORSMiddleware → Handle CORS
    ↓
Route Handler → Process request
    ↓
Service Layer → Business logic
    ↓
Repository Layer → Database operations
    ↓
Response → Include request_id header
```

## Core Components

### 1. Structured Logging (`core/logging.py`)

**Features:**
- Request ID propagation through context variables
- Structured key=value log format
- Automatic exception logging
- Configurable log levels

**Usage:**
```python
from app.core.logging import get_logger

logger = get_logger(__name__)
logger.info("User created", extra={"user_id": 123})
```

**Output:**
```
timestamp=2026-01-05 12:00:00 level=INFO logger=app.users message="User created" request_id=abc-123 user_id=123
```

### 2. Middleware (`core/middleware.py`)

#### RequestIDMiddleware
- Generates unique UUID for each request
- Extracts existing X-Request-ID header if present
- Sets request_id in context for logging
- Adds request_id to response headers
- Tracks request duration

#### CORSSecurityMiddleware
- Adds security headers to all responses
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- X-XSS-Protection: 1; mode=block

### 3. Exception Handling (`shared/exceptions.py`)

**Exception Hierarchy:**
```
SignFlowException (base)
├── NotFoundError (404)
├── ValidationError (422)
├── ConflictError (409)
├── DatabaseError (500)
├── UnauthorizedError (401)
└── ForbiddenError (403)
```

**Usage:**
```python
from app.shared.exceptions import NotFoundError

raise NotFoundError(
    message="User not found",
    details={"user_id": 123}
)
```

**Response:**
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "User not found",
    "details": {"user_id": 123}
  }
}
```

### 4. Repository Pattern (`shared/base_repo.py`)

**Generic CRUD Operations:**
- `get_by_id(id)` - Retrieve by primary key
- `get_by_id_or_fail(id)` - Retrieve or raise NotFoundError
- `get_all(skip, limit)` - List with pagination
- `create(**kwargs)` - Create new record
- `update_by_id(id, **kwargs)` - Update existing
- `delete_by_id(id)` - Delete record
- `exists(id)` - Check existence
- `count()` - Count records

**Usage:**
```python
from app.models.user import User
from app.shared.base_repo import BaseRepository

repo = BaseRepository(User, session)
user = await repo.create(email="test@example.com")
users = await repo.get_all(skip=0, limit=10)
```

### 5. Service Pattern (`shared/base_service.py`)

**Business Logic Layer:**
- Wraps repository operations
- Adds business logic and validation
- Handles orchestration between multiple repositories
- Includes logging

**Usage:**
```python
from app.shared.base_service import BaseService

class UserService(BaseService):
    async def create_user(self, email: str):
        # Add business logic
        if not self.validate_email(email):
            raise ValidationError("Invalid email")
        
        # Use repository
        return await self.repository.create(email=email)
```

### 6. Testing Infrastructure (`tests/`)

**Fixtures:**
- `db_session` - In-memory SQLite database
- `client` - HTTP client with dependency overrides
- `sample_user_data` - Test data fixtures

**Test Categories:**
- Unit tests for repositories
- Integration tests for services
- API tests for endpoints
- Middleware tests

**Run Tests:**
```bash
make test                  # Run all tests
make test-cov             # Run with coverage
docker-compose exec backend pytest -v
```

## Configuration (`core/config.py`)

**Pydantic v2 Settings:**
- Environment variable loading
- Type validation
- Default values
- Computed properties for connection URLs

**Environment Variables:**
```bash
# Database
POSTGRES_USER=signflow
POSTGRES_PASSWORD=signflow_dev_password
POSTGRES_DB=signflow_db
POSTGRES_HOST=postgres
POSTGRES_PORT=5432

# Application
APP_NAME=SignFlow
APP_ENV=development
DEBUG=true
```

## Database (`core/db.py`)

**SQLAlchemy 2.0 Async:**
- Async engine and sessions
- Connection pooling
- Dependency injection for routes
- Base model with naming conventions

**Usage:**
```python
from app.core.db import get_db
from sqlalchemy.ext.asyncio import AsyncSession

@app.get("/users")
async def get_users(db: AsyncSession = Depends(get_db)):
    # Use db session
    pass
```

## API Endpoints

### GET /health
Health check with request tracking.

**Response:**
```json
{
  "status": "healthy",
  "app_name": "SignFlow",
  "environment": "development",
  "version": "0.1.0",
  "request_id": "abc-123-def-456"
}
```

**Headers:**
- `X-Request-ID`: Unique request identifier

### GET /
Root endpoint with API info.

### GET /docs
Interactive OpenAPI documentation (Swagger UI).

### GET /redoc
Alternative API documentation (ReDoc).

## Development Workflow

### 1. Add New Feature

```bash
# 1. Create model
touch app/models/my_model.py

# 2. Create migration
make revision m="add my_model table"

# 3. Run migration
make migrate

# 4. Create repository (optional, can use BaseRepository)
touch app/repositories/my_repo.py

# 5. Create service (optional, can use BaseService)
touch app/services/my_service.py

# 6. Add routes
# Edit app/main.py or create app/routers/my_router.py

# 7. Write tests
touch app/tests/test_my_feature.py

# 8. Run tests
make test
```

### 2. View Logs

```bash
# All services
make logs

# Backend only
make logs-backend

# Follow logs
docker-compose logs -f backend
```

### 3. Database Operations

```bash
# Access PostgreSQL
make shell-db

# Create migration
make revision m="description"

# Apply migrations
make migrate

# Rollback migration
docker-compose exec backend alembic downgrade -1
```

### 4. Debugging

```bash
# Backend shell
make shell

# Python REPL
docker-compose exec backend python

# Run specific test
docker-compose exec backend pytest app/tests/test_health.py -v

# Check linting
docker-compose exec backend flake8 app/
```

## Best Practices

### 1. Error Handling
```python
# Use custom exceptions
from app.shared.exceptions import NotFoundError

async def get_user(user_id: int):
    user = await repo.get_by_id(user_id)
    if not user:
        raise NotFoundError(f"User {user_id} not found")
    return user
```

### 2. Logging
```python
# Use structured logging
from app.core.logging import get_logger

logger = get_logger(__name__)

# Good
logger.info("User created", extra={"user_id": user.id})

# Avoid
logger.info(f"User {user.id} created")  # Less structured
```

### 3. Repository Pattern
```python
# Keep repositories focused on data access
class UserRepository(BaseRepository[User]):
    async def get_by_email(self, email: str) -> Optional[User]:
        stmt = select(User).where(User.email == email)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()
```

### 4. Service Pattern
```python
# Put business logic in services
class UserService(BaseService[User, UserRepository]):
    async def register_user(self, email: str, name: str) -> User:
        # Business logic
        if await self.repository.get_by_email(email):
            raise ConflictError("Email already exists")
        
        # Data access
        return await self.repository.create(
            email=email,
            full_name=name,
            is_active=True
        )
```

## Security Considerations

1. **Environment Variables**: Never commit `.env` files
2. **SQL Injection**: Use SQLAlchemy parameterized queries
3. **CORS**: Configure properly for production
4. **Headers**: Security headers added via middleware
5. **Validation**: Use Pydantic for input validation
6. **Logging**: Don't log sensitive data

## Performance Tips

1. **Connection Pooling**: Pre-configured in db.py
2. **Async Operations**: Use async/await throughout
3. **Pagination**: Always paginate list endpoints
4. **Indexes**: Add database indexes on frequently queried fields
5. **Caching**: Redis available for caching layer

## Monitoring

### Health Check
```bash
# Basic health
curl http://localhost:8000/health

# With headers
curl -v http://localhost:8000/health
```

### Structured Logs
All logs include:
- Timestamp
- Log level
- Logger name
- Message
- Request ID (when available)
- Additional context

### Metrics (Future)
Consider adding:
- Prometheus metrics
- Request duration tracking
- Error rate monitoring
- Database query performance

## What's NOT Included

❌ Authentication/Authorization  
❌ Business logic modules  
❌ Real data processing  
❌ Frontend integration  
❌ Production deployment configs  

This is a **skeleton** - add business logic as needed.

## Next Steps

1. **Add Authentication** - JWT, sessions, OAuth
2. **User Management** - Registration, profile, roles
3. **Business Modules** - Documents, signatures, workflows
4. **API Versioning** - /api/v1/...
5. **Rate Limiting** - Prevent abuse
6. **Caching Layer** - Use Redis
7. **Background Tasks** - Celery or similar
8. **Monitoring** - Prometheus, Grafana
9. **CI/CD** - GitHub Actions, tests on push
10. **Production Deploy** - Kubernetes, Docker Swarm

---

**Phase A1 Complete** ✅  
**Ready for Business Logic** 🚀

