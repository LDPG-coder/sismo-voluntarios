"""Add auth_source and sep_user_id to users

Revision ID: 010_add_user_auth_source
Revises: 009_add_member_status
Create Date: 2026-07-13
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "010_add_user_auth_source"
down_revision: Union[str, None] = "009_add_member_status"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("auth_source", sa.String(20), nullable=False, server_default="google"),
    )
    op.add_column(
        "users",
        sa.Column("sep_user_id", sa.String(255), nullable=True),
    )
    op.create_index("ix_users_sep_user_id", "users", ["sep_user_id"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_users_sep_user_id", table_name="users")
    op.drop_column("users", "sep_user_id")
    op.drop_column("users", "auth_source")
