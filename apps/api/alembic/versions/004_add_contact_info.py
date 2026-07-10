"""Add contact_info to activities

Revision ID: 004_add_contact_info
Revises: 003_add_notifications
Create Date: 2025-07-09
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "004_add_contact_info"
down_revision: Union[str, None] = "003_add_notifications"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("activities", sa.Column("contact_info", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("activities", "contact_info")
