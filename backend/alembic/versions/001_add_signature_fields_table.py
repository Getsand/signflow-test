"""add signature_fields table

Revision ID: 001_signature_fields
Revises: eee0b4a2bdf7
Create Date: 2026-01-09 13:40:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '001_signature_fields'
down_revision: Union[str, None] = 'eee0b4a2bdf7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    Create signature_fields table.
    
    This table stores metadata about signature placeholders on documents.
    It does NOT store actual signatures - just the coordinates and assignment info.
    """
    # Create enum type for signature field status
    signature_status_enum = postgresql.ENUM(
        'PENDING', 
        'SIGNED', 
        name='signaturefieldstatus',
        create_type=False
    )
    signature_status_enum.create(op.get_bind(), checkfirst=True)

    # Create signature_fields table
    op.create_table(
        'signature_fields',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column('file_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('page_number', sa.Integer(), nullable=False),
        sa.Column('x', sa.Float(), nullable=False),
        sa.Column('y', sa.Float(), nullable=False),
        sa.Column('width', sa.Float(), nullable=False),
        sa.Column('height', sa.Float(), nullable=False),
        sa.Column('assigned_to', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            'status',
            signature_status_enum,
            nullable=False,
            server_default='PENDING'
        ),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('now()'),
            nullable=False
        ),
    )

    # Create indexes
    op.create_index(
        'ix_signature_fields_file_id',
        'signature_fields',
        ['file_id']
    )
    op.create_index(
        'ix_signature_fields_assigned_to',
        'signature_fields',
        ['assigned_to']
    )

    # Create foreign keys
    op.create_foreign_key(
        'fk_signature_fields_file_id',
        'signature_fields', 'file_objects',
        ['file_id'], ['id'],
        ondelete='CASCADE'
    )
    op.create_foreign_key(
        'fk_signature_fields_assigned_to',
        'signature_fields', 'users',
        ['assigned_to'], ['id'],
        ondelete='CASCADE'
    )


def downgrade() -> None:
    """
    Drop signature_fields table and enum type.
    """
    op.drop_table('signature_fields')
    
    # Drop enum type
    signature_status_enum = postgresql.ENUM(
        'PENDING',
        'SIGNED',
        name='signaturefieldstatus'
    )
    signature_status_enum.drop(op.get_bind(), checkfirst=True)

