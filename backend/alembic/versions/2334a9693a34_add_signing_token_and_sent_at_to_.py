"""add_signing_token_and_sent_at_to_recipients

Revision ID: 2334a9693a34
Revises: 3d8d960d6ed0
Create Date: 2026-01-27 08:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '2334a9693a34'
down_revision: Union[str, None] = '3d8d960d6ed0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add signing_token column (nullable initially, will be populated when sending)
    op.add_column(
        'signing_request_recipients',
        sa.Column('signing_token', sa.String(64), nullable=True, unique=True, index=True)
    )
    
    # Add sent_at column
    op.add_column(
        'signing_request_recipients',
        sa.Column('sent_at', sa.DateTime(), nullable=True)
    )


def downgrade() -> None:
    # Drop columns
    op.drop_column('signing_request_recipients', 'sent_at')
    op.drop_column('signing_request_recipients', 'signing_token')
