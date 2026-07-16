"""Add cedula, gender and whatsapp to users

Revision ID: 021_add_user_profile_fields
Revises: 020_add_realized_hours
Create Date: 2026-07-16
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "021_add_user_profile_fields"
down_revision: Union[str, None] = "020_add_realized_hours"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("cedula", sa.String(20), nullable=True))
    op.create_index("ix_users_cedula", "users", ["cedula"], unique=True)
    op.add_column("users", sa.Column("gender", sa.String(20), nullable=True))
    op.add_column("users", sa.Column("whatsapp", sa.String(50), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "whatsapp")
    op.drop_column("users", "gender")
    op.drop_index("ix_users_cedula", table_name="users")
    op.drop_column("users", "cedula")
