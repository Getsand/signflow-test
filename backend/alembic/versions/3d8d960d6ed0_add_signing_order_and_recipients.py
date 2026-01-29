"""add_signing_order_and_recipients

Revision ID: 3d8d960d6ed0
Revises: af6913334392
Create Date: 2026-01-26 17:45:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '3d8d960d6ed0'
down_revision: Union[str, None] = 'af6913334392'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create ENUM type for signing order (if not exists)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE signingorder AS ENUM ('SEQUENTIAL', 'PARALLEL');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """)
    
    # Add signing_order column to signing_requests table
    op.add_column(
        'signing_requests',
        sa.Column('signing_order', postgresql.ENUM('SEQUENTIAL', 'PARALLEL', name='signingorder'), nullable=False, server_default='SEQUENTIAL')
    )
    
    # Create ENUM type for recipient status (if not exists)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE recipientstatus AS ENUM ('PENDING', 'SIGNED');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """)
    
    # Create signing_request_recipients table
    # Use existing enum type (already created above)
    recipient_status_enum = postgresql.ENUM('PENDING', 'SIGNED', name='recipientstatus', create_type=False)
    op.create_table(
        'signing_request_recipients',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('signing_request_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('role', sa.String(50), nullable=False),
        sa.Column('email', sa.String(255), nullable=False),
        sa.Column('order_index', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('status', recipient_status_enum, nullable=False, server_default='PENDING'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['signing_request_id'], ['signing_requests.id'], ondelete='CASCADE'),
    )
    
    # Create indexes
    op.create_index('ix_signing_request_recipients_signing_request_id', 'signing_request_recipients', ['signing_request_id'])


def downgrade() -> None:
    # Drop indexes
    op.drop_index('ix_signing_request_recipients_signing_request_id', table_name='signing_request_recipients')
    
    # Drop table
    op.drop_table('signing_request_recipients')
    
    # Drop ENUM types
    op.execute("DROP TYPE recipientstatus")
    
    # Remove signing_order column
    op.drop_column('signing_requests', 'signing_order')
    
    # Drop ENUM type
    op.execute("DROP TYPE signingorder")
