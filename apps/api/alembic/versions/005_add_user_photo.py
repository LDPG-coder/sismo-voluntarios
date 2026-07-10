"""Add photo_url to users

Revision ID: 005_add_user_photo
Revises: 004_add_contact_info
Create Date: 2025-01-05
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "005_add_user_photo"
down_revision: Union[str, None] = "004_add_contact_info"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("photo_url", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "photo_url")
