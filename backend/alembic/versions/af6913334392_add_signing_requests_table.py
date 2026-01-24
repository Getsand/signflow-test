"""add_signing_requests_table

Revision ID: af6913334392
Revises: 001_signature_fields
Create Date: 2026-01-13 14:18:52.003195

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'af6913334392'
down_revision: Union[str, None] = '001_signature_fields'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create ENUM type for signing request status
    op.execute("CREATE TYPE signingrequeststatus AS ENUM ('DRAFT', 'SENT', 'IN_PROGRESS', 'COMPLETED')")
    
    # Create signing_requests table
    op.execute("""
        CREATE TABLE signing_requests (
            id UUID PRIMARY KEY,
            file_id UUID NOT NULL UNIQUE REFERENCES file_objects(id) ON DELETE CASCADE,
            owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            status signingrequeststatus NOT NULL DEFAULT 'DRAFT',
            title VARCHAR(255),
            created_at TIMESTAMP NOT NULL,
            updated_at TIMESTAMP NOT NULL,
            sent_at TIMESTAMP,
            completed_at TIMESTAMP
        )
    """)
    
    # Create indexes
    op.create_index('ix_signing_requests_file_id', 'signing_requests', ['file_id'])
    op.create_index('ix_signing_requests_owner_id', 'signing_requests', ['owner_id'])
    op.create_index('ix_signing_requests_status', 'signing_requests', ['status'])


def downgrade() -> None:
    # Drop indexes
    op.drop_index('ix_signing_requests_status', table_name='signing_requests')
    op.drop_index('ix_signing_requests_owner_id', table_name='signing_requests')
    op.drop_index('ix_signing_requests_file_id', table_name='signing_requests')
    
    # Drop table
    op.drop_table('signing_requests')
    
    # Drop ENUM type
    op.execute("DROP TYPE signingrequeststatus")


