"""
Run Alembic migrations using DATABASE_URL from .env.
Usage: From repo root: python -m scripts.run_migration
       Or from backend:  python scripts/run_migration.py
"""
import os
import subprocess
import sys

# Load .env from backend directory or parent
try:
    from dotenv import load_dotenv
    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    load_dotenv(os.path.join(backend_dir, ".env"))
    load_dotenv(os.path.join(backend_dir, "..", ".env"))
except ImportError:
    pass

if not os.environ.get("DATABASE_URL"):
    print("DATABASE_URL is not set. Set it in .env or environment, then run: alembic upgrade head", file=sys.stderr)
    sys.exit(1)

os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
result = subprocess.run([sys.executable, "-m", "alembic", "upgrade", "head"])
sys.exit(result.returncode)
