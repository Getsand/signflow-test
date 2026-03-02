"""
Model registry for Alembic metadata discovery.

DO NOT import this file anywhere except Alembic.
"""
from app.modules.auth.models import User  # noqa
from app.modules.files.models import FileObject  # noqa
# API models imported in alembic/env.py so Alembic can run even if app.api is not on path