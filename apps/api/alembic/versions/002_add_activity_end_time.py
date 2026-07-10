"""Add end_time and estimated_duration_min to activities

Revision ID: 002_add_activity_end_time
Revises: 001_initial
Create Date: 2025-07-09
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "002_add_activity_end_time"
down_revision: Union[str, None] = "001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("activities", sa.Column("end_time", sa.DateTime(timezone=True), nullable=True))
    op.add_column("activities", sa.Column("estimated_duration_min", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("activities", "estimated_duration_min")
    op.drop_column("activities", "end_time")
