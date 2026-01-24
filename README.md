# SignFlow - Enterprise Document Signature Management System

> A modern, full-stack SaaS platform for digital document signing and workflow management, inspired by Zoho Sign.

[![FastAPI](https://img.shields.io/badge/FastAPI-0.109.0-009688?logo=fastapi)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-19.2.3-61DAFB?logo=react)](https://reactjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-336791?logo=postgresql)](https://www.postgresql.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript)](https://www.typescriptlang.org/)

SignFlow is a production-ready document signature management system that enables users to upload PDFs, place signature fields, manage signing workflows, and track document status. Built with modern technologies and best practices for scalability and maintainability.

## ✨ Features

- **User Authentication**: Secure JWT-based authentication with email/password
- **Document Management**: Upload, view, and manage PDF documents
- **Signature Field Placement**: Interactive PDF viewer with drag-and-drop signature field placement
- **Signing Workflows**: Create and manage signing requests with status tracking
- **Presigned URLs**: Secure MinIO integration for document storage
- **Real-time Status**: Track document status (UPLOADING, COMPLETED, LOCKED, FAILED)
- **Responsive UI**: Modern React frontend with Zoho Sign-inspired design
- **API Documentation**: Auto-generated OpenAPI/Swagger documentation

## 🛠️ Tech Stack

### Backend
- **Python 3.11** - Modern Python with async support
- **FastAPI 0.109** - High-performance async web framework
- **SQLAlchemy 2.0** - Async ORM with type hints
- **PostgreSQL 15** - Production-ready relational database
- **Alembic** - Database migration management
- **Redis 7** - Caching and session management
- **MinIO** - S3-compatible object storage
- **Pydantic v2** - Data validation and settings management
- **JWT** - Secure token-based authentication

### Frontend
- **React 19.2** - Latest React with hooks
- **TypeScript 5.9** - Type-safe JavaScript
- **Vite 7.2** - Fast build tool and dev server
- **Tailwind CSS 4.1** - Utility-first CSS framework
- **React Router 7** - Client-side routing
- **React-PDF 10.3** - PDF.js-based PDF rendering
- **Axios** - HTTP client for API calls

## 📁 Project Structure

```
signflow/
├── backend/                    # FastAPI backend
│   ├── app/
│   │   ├── core/               # Core configuration
│   │   │   ├── config.py       # Settings (Pydantic)
│   │   │   ├── db.py           # Database connection
│   │   │   ├── security.py     # JWT & password hashing
│   │   │   └── storage.py      # MinIO integration
│   │   ├── modules/            # Feature modules
│   │   │   ├── auth/           # Authentication
│   │   │   ├── files/          # File management
│   │   │   ├── signatures/     # Signature fields
│   │   │   └── signing_requests/ # Signing workflows
│   │   ├── models.py           # SQLAlchemy models
│   │   └── main.py             # FastAPI app
│   ├── alembic/                # Database migrations
│   ├── requirements.txt        # Python dependencies
│   └── Dockerfile              # Backend container
├── frontend/                    # React frontend
│   ├── src/
│   │   ├── components/        # Reusable components
│   │   ├── pages/              # Page components
│   │   ├── lib/                # API clients
│   │   └── utils/              # Utilities
│   ├── package.json
│   └── vite.config.ts
├── docker-compose.yml           # Multi-container setup
├── Makefile                     # Development commands
└── README.md                    # This file
```

## 🚀 Quick Start

### Prerequisites

- Docker & Docker Compose
- Make (optional, but recommended)
- Git

### Installation

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd signflow
   ```

2. **Start all services:**
   ```bash
   make up
   # or
   docker-compose up -d
   ```

3. **Run database migrations:**
   ```bash
   make migrate
   # or
   docker-compose exec backend alembic upgrade head
   ```

4. **Start frontend development server:**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

5. **Access the application:**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:8000
   - API Docs: http://localhost:8000/docs
   - MinIO Console: http://localhost:9001 (admin/admin)

### First User Setup

1. Navigate to http://localhost:5173
2. Click "Sign Up" to create your account
3. Login with your credentials
4. Upload a PDF document to get started

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


