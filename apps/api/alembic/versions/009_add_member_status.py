"""Add membership status (active/ceded) for activity transfers

Revision ID: 009_add_member_status
Revises: 008_backfill_google_photo_url
Create Date: 2025-01-06
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "009_add_member_status"
down_revision: Union[str, None] = "008_backfill_google_photo_url"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "activity_members",
        sa.Column("status", sa.String(20), nullable=False, server_default="active"),
    )
    op.add_column(
        "activity_members",
        sa.Column("ceded_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("activity_members", "ceded_at")
    op.drop_column("activity_members", "status")
