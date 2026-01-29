"""add_signing_request_fields_table

Revision ID: a85fed51dcc9
Revises: 2334a9693a34
Create Date: 2026-01-28 14:29:32.197629

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "a85fed51dcc9"
down_revision: Union[str, None] = "2334a9693a34"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create signing_request_fields table and status enum."""
    # Create enum type for signing request field status
    field_status_enum = postgresql.ENUM(
        "PENDING",
        "SIGNED",
        name="signingrequestfieldstatus",
        create_type=False,
    )
    field_status_enum.create(op.get_bind(), checkfirst=True)

    # Create signing_request_fields table
    op.create_table(
        "signing_request_fields",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            nullable=False,
        ),
        sa.Column(
            "signing_request_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column(
            "template_field_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column(
            "recipient_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column("role", sa.String(length=50), nullable=False),
        sa.Column("field_type", sa.String(length=50), nullable=False),
        sa.Column("page", sa.Integer(), nullable=False),
        sa.Column("x", sa.Float(), nullable=False),
        sa.Column("y", sa.Float(), nullable=False),
        sa.Column("width", sa.Float(), nullable=False),
        sa.Column("height", sa.Float(), nullable=False),
        sa.Column("value", sa.String(length=1024), nullable=True),
        sa.Column(
            "status",
            field_status_enum,
            nullable=False,
            server_default="PENDING",
        ),
        sa.Column("signed_at", sa.DateTime(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )

    # Indexes
    op.create_index(
        "ix_signing_request_fields_signing_request_id",
        "signing_request_fields",
        ["signing_request_id"],
    )
    op.create_index(
        "ix_signing_request_fields_recipient_id",
        "signing_request_fields",
        ["recipient_id"],
    )
    op.create_index(
        "ix_signing_request_fields_status",
        "signing_request_fields",
        ["status"],
    )

    # Foreign keys
    op.create_foreign_key(
        "fk_signing_request_fields_signing_request_id",
        "signing_request_fields",
        "signing_requests",
        ["signing_request_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_foreign_key(
        "fk_signing_request_fields_template_field_id",
        "signing_request_fields",
        "signature_fields",
        ["template_field_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_foreign_key(
        "fk_signing_request_fields_recipient_id",
        "signing_request_fields",
        "signing_request_recipients",
        ["recipient_id"],
        ["id"],
        ondelete="CASCADE",
    )


def downgrade() -> None:
    """Drop signing_request_fields table and status enum."""
    # Drop table first (will also drop FKs)
    op.drop_table("signing_request_fields")

    # Drop enum type
    field_status_enum = postgresql.ENUM(
        "PENDING",
        "SIGNED",
        name="signingrequestfieldstatus",
    )
    field_status_enum.drop(op.get_bind(), checkfirst=True)


