# SignFlow - Document Signature Management System

## Milestone A - Backend Foundation

FastAPI backend with PostgreSQL, Redis, and MinIO integration.

### Stack

- **Python**: 3.11
- **Framework**: FastAPI
- **Database**: PostgreSQL 15
- **ORM**: SQLAlchemy 2.0 (async)
- **Migrations**: Alembic
- **Cache**: Redis 7
- **Storage**: MinIO
- **Validation**: Pydantic v2

### Project Structure

```
signflow/
├── backend/
│   ├── app/
│   │   ├── core/           # Core configuration and database
│   │   │   ├── config.py   # Pydantic settings
│   │   │   └── db.py       # SQLAlchemy 2.0 setup
│   │   ├── models/         # Database models
│   │   │   └── user.py     # User model
│   │   └── main.py         # FastAPI application
│   ├── alembic/            # Database migrations
│   │   ├── versions/       # Migration files
│   │   └── env.py          # Alembic environment
│   ├── requirements.txt    # Python dependencies
│   ├── Dockerfile          # Backend container
│   └── alembic.ini         # Alembic configuration
├── docker-compose.yml      # Multi-container orchestration
└── Makefile               # Development commands
```

### Quick Start

1. **Start all services:**
   ```bash
   make up
   ```

2. **Run initial migration:**
   ```bash
   make migrate
   ```

3. **View logs:**
   ```bash
   make logs
   ```

4. **Access the API:**
   - Backend API: http://localhost:8000
   - API Documentation: http://localhost:8000/docs
   - Health Check: http://localhost:8000/health

5. **Access services:**
   - MinIO Console: http://localhost:9001 (admin/admin)
   - PostgreSQL: localhost:5432 (signflow/signflow_dev_password)
   - Redis: localhost:6379

### Available Commands

```bash
make help          # Show all available commands
make build         # Build all containers
make up            # Start all services
make down          # Stop all services
make logs          # View all logs
make logs-backend  # View backend logs only
make migrate       # Run database migrations
make revision m="message"  # Create new migration
make shell         # Open backend shell
make shell-db      # Open PostgreSQL shell
make clean         # Remove all containers and volumes
make restart       # Restart all services
```

### Development Workflow

1. **Create a new migration:**
   ```bash
   make revision m="add new field"
   ```

2. **Apply migrations:**
   ```bash
   make migrate
   ```

3. **Access database:**
   ```bash
   make shell-db
   ```

4. **View backend logs:**
   ```bash
   make logs-backend
   ```

### Health Check

Test the health endpoint:
```bash
curl http://localhost:8000/health
```

Expected response:
```json
{
  "status": "healthy",
  "app_name": "SignFlow",
  "environment": "development",
  "version": "0.1.0"
}
```

### Database Models

#### User Model
- `id`: Primary key
- `email`: Unique email address (indexed)
- `full_name`: Optional full name
- `is_active`: Account status
- `is_superuser`: Admin flag
- `created_at`: Creation timestamp
- `updated_at`: Last update timestamp

### Configuration

All configuration is managed through environment variables. Key settings:

- **Database**: PostgreSQL connection parameters
- **Redis**: Cache connection settings
- **MinIO**: Object storage credentials
- **App**: General application settings

See `backend/app/core/config.py` for all available options.

### Architecture Notes

- **Async/Await**: Full async support with SQLAlchemy 2.0
- **Type Safety**: Pydantic v2 for settings and validation
- **Migrations**: Alembic with async engine support
- **Health Checks**: Docker health checks for all services
- **Dependencies**: Service dependencies managed in docker-compose

### Next Steps

- Milestone B: Authentication & Authorization
- Milestone C: Document Management
- Milestone D: Signature Workflows
- Milestone E: Frontend Integration

---

**Status**: Milestone A Complete ✅

