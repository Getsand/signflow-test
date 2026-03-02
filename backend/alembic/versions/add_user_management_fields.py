"""add user management fields (invited_by_id, is_active, role)

Revision ID: d5e6f7a8b9c0
Revises: c4d5e6f7a8b9
Create Date: 2026-02-21

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "d5e6f7a8b9c0"
down_revision: Union[str, None] = "c4d5e6f7a8b9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("invited_by_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
    )
    op.add_column(
        "users",
        sa.Column("role", sa.String(64), server_default="member", nullable=False),
    )
    op.create_foreign_key(
        "fk_users_invited_by_id",
        "users",
        "users",
        ["invited_by_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_users_invited_by_id", "users", ["invited_by_id"])


def downgrade() -> None:
    op.drop_index("ix_users_invited_by_id", table_name="users")
    op.drop_constraint("fk_users_invited_by_id", "users", type_="foreignkey")
    op.drop_column("users", "role")
    op.drop_column("users", "is_active")
    op.drop_column("users", "invited_by_id")
