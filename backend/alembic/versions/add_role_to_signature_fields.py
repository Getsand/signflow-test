"""add role to signature_fields

Revision ID: a1b2c3d4e5f6
Revises: f1e2d3c4b5a6
Create Date: 2026-02-01

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "f1e2d3c4b5a6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "signature_fields",
        sa.Column("role", sa.String(length=50), nullable=True),
    )
    op.create_index("ix_signature_fields_role", "signature_fields", ["role"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_signature_fields_role", table_name="signature_fields")
    op.drop_column("signature_fields", "role")
