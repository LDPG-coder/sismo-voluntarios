"""Add google_photo_url to users

Revision ID: 007_add_google_photo_url
Revises: 006_add_user_phone
Create Date: 2026-07-10
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "007_add_google_photo_url"
down_revision: Union[str, None] = "006_add_user_phone"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("google_photo_url", sa.Text, nullable=True))


def downgrade() -> None:
    op.drop_column("users", "google_photo_url")
