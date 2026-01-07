"""merge heads

Revision ID: 347fc98e8043
Revises: 001, 46e232bccb8a
Create Date: 2026-01-06 09:56:13.033040

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '347fc98e8043'
down_revision: Union[str, None] = ('001', '46e232bccb8a')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass

