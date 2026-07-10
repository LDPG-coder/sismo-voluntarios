"""Add phone to users

Revision ID: 006_add_user_phone
Revises: 005_add_user_photo
Create Date: 2026-07-10
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "006_add_user_phone"
down_revision: Union[str, None] = "005_add_user_photo"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("phone", sa.String(50), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "phone")
