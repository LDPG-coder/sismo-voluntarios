"""Add is_demo + demo_until to activities (publicaciones de ejemplo)

Revision ID: 022_add_activity_demo
Revises: 021_add_user_profile_fields
Create Date: 2026-07-17
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "022_add_activity_demo"
down_revision: Union[str, None] = "021_add_user_profile_fields"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "activities",
        sa.Column("is_demo", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.add_column(
        "activities",
        sa.Column("demo_until", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("activities", "demo_until")
    op.drop_column("activities", "is_demo")
