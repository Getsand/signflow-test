"""increase_signing_request_fields_value_size

Revision ID: 5953343e8671
Revises: a85fed51dcc9
Create Date: 2026-01-28 19:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "5953343e8671"
down_revision: Union[str, None] = "a85fed51dcc9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Change value column from VARCHAR(1024) to TEXT to support base64-encoded signature images."""
    # Change value column from VARCHAR(1024) to TEXT
    # TEXT has no length limit, suitable for base64-encoded PNG images
    op.alter_column(
        "signing_request_fields",
        "value",
        existing_type=sa.String(length=1024),
        type_=sa.Text(),
        existing_nullable=True,
    )


def downgrade() -> None:
    """Revert value column back to VARCHAR(1024)."""
    # Note: This may truncate data if any values exceed 1024 characters
    op.alter_column(
        "signing_request_fields",
        "value",
        existing_type=sa.Text(),
        type_=sa.String(length=1024),
        existing_nullable=True,
    )
