"""Initial users table

Revision ID: 001
Revises: 
Create Date: 2026-01-05 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '001'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create users table with UUID primary key"""
    op.create_table(
        'users',
        sa.Column(
            'id',
            postgresql.UUID(as_uuid=True),
            nullable=False,
            primary_key=True
        ),
        sa.Column(
            'email',
            sa.String(length=255),
            nullable=False
        ),
        sa.Column(
            'name',
            sa.String(length=255),
            nullable=True
        ),
        sa.Column(
            'password_hash',
            sa.String(length=255),
            nullable=True
        ),
        sa.Column(
            'google_sub',
            sa.String(length=255),
            nullable=True
        ),
        sa.Column(
            'is_verified',
            sa.Boolean(),
            nullable=False,
            server_default='false'
        ),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text('now()')
        ),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_users'))
    )
    
    # Create indexes
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)
    op.create_index(op.f('ix_users_google_sub'), 'users', ['google_sub'], unique=True)


def downgrade() -> None:
    """Drop users table"""
    op.drop_index(op.f('ix_users_google_sub'), table_name='users')
    op.drop_index(op.f('ix_users_email'), table_name='users')
    op.drop_table('users')


