"""allow multiple signing requests per file (template reuse)

Templates can be used multiple times: remove unique constraint on
signing_requests.file_id so one template file can have many signing requests.

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-02-02

"""
from typing import Sequence, Union

from alembic import op


revision: str = "b2c3d4e5f6a7"
down_revision: Union[str, None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop UNIQUE on file_id so the same template can be used for multiple signing requests.
    # Use raw SQL so we only drop if the constraint exists (idempotent).
    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conname = 'signing_requests_file_id_key'
                AND conrelid = 'signing_requests'::regclass
            ) THEN
                ALTER TABLE signing_requests DROP CONSTRAINT signing_requests_file_id_key;
            END IF;
        END $$;
    """)


def downgrade() -> None:
    # Restore unique: only if there are no duplicate file_ids (otherwise migration fails).
    op.create_unique_constraint(
        "signing_requests_file_id_key",
        "signing_requests",
        ["file_id"],
    )
