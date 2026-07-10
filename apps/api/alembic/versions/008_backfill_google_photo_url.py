"""Backfill google_photo_url from existing photo_url

Revision ID: 008_backfill_google_photo_url
Revises: 007_add_google_photo_url
Create Date: 2026-07-10
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "008_backfill_google_photo_url"
down_revision: Union[str, None] = "007_add_google_photo_url"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Users who already have a remote (Google) photo keep it as their default.
    op.execute(
        sa.text(
            "UPDATE users SET google_photo_url = photo_url "
            "WHERE google_photo_url IS NULL AND photo_url IS NOT NULL "
            "AND photo_url NOT LIKE 'data:%'"
        )
    )


def downgrade() -> None:
    op.execute(sa.text("UPDATE users SET google_photo_url = NULL"))
