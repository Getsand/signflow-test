"""add file upload status and bucket

Revision ID: eee0b4a2bdf7
Revises: c7825a31fe81
Create Date: 2026-01-07
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "eee0b4a2bdf7"
down_revision = "c7825a31fe81"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1️⃣ Create ENUM type explicitly
    file_status_enum = postgresql.ENUM(
        "UPLOADING",
        "COMPLETED",
        "FAILED",
        name="filestatus",
    )
    file_status_enum.create(op.get_bind(), checkfirst=True)

    # 2️⃣ Add new columns
    op.add_column(
        "file_objects",
        sa.Column("bucket", sa.String(length=255), nullable=False),
    )
    op.add_column(
        "file_objects",
        sa.Column(
            "status",
            sa.Enum(
                "UPLOADING",
                "COMPLETED",
                "FAILED",
                name="filestatus",
            ),
            nullable=False,
            server_default="UPLOADING",
        ),
    )

    # 3️⃣ Allow size to be nullable
    op.alter_column(
        "file_objects",
        "size",
        existing_type=sa.Integer(),
        nullable=True,
    )


def downgrade() -> None:
    # Reverse operations safely
    op.alter_column(
        "file_objects",
        "size",
        existing_type=sa.Integer(),
        nullable=False,
    )

    op.drop_column("file_objects", "status")
    op.drop_column("file_objects", "bucket")

    # Drop ENUM type
    file_status_enum = postgresql.ENUM(
        "UPLOADING",
        "COMPLETED",
        "FAILED",
        name="filestatus",
    )
    file_status_enum.drop(op.get_bind(), checkfirst=True)
