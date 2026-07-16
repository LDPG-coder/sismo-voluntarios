"""Add realized_hours to activities

Revision ID: 020_add_realized_hours
Revises: 019_add_activity_private
Create Date: 2026-07-16
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "020_add_realized_hours"
down_revision: Union[str, None] = "019_add_activity_private"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "activities",
        sa.Column("realized_hours", sa.Float(), nullable=True),
    )
    # Backfill: derivar de (end_time - date_time), o estimated_duration_min,
    # o external_assigned_hours, en ese orden de prioridad.
    op.execute(
        sa.text(
            """
            UPDATE activities SET realized_hours = (
                CASE
                    WHEN end_time IS NOT NULL AND date_time IS NOT NULL
                        THEN ROUND(GREATEST(0, EXTRACT(EPOCH FROM (end_time - date_time)) / 3600.0), 2)
                    WHEN estimated_duration_min IS NOT NULL
                        THEN ROUND(estimated_duration_min / 60.0, 2)
                    WHEN external_assigned_hours IS NOT NULL
                        THEN ROUND(external_assigned_hours, 2)
                    ELSE NULL
                END
            );
            """
        )
    )


def downgrade() -> None:
    op.drop_column("activities", "realized_hours")
