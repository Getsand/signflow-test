"""add field_type to signature_fields

Revision ID: add_field_type_to_signature_fields
Revises: a85fed51dcc9
Create Date: 2026-01-28 20:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f1e2d3c4b5a6'
down_revision: Union[str, None] = '5953343e8671'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add field_type column to signature_fields table
    op.add_column(
        'signature_fields',
        sa.Column('field_type', sa.String(length=50), nullable=False, server_default='SIGNATURE')
    )


def downgrade() -> None:
    # Remove field_type column
    op.drop_column('signature_fields', 'field_type')
