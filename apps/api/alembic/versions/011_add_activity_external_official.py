"""Add external official volunteering fields to activities

Revision ID: 011_add_external_official
Revises: 010_add_user_auth_source
Create Date: 2026-07-14
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "011_add_external_official"
down_revision: Union[str, None] = "010_add_user_auth_source"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "activities",
        sa.Column("external_beneficiary", sa.String(255), nullable=True),
    )
    op.add_column(
        "activities",
        sa.Column("external_supervisor", sa.String(255), nullable=True),
    )
    op.add_column(
        "activities",
        sa.Column("external_supervisor_email", sa.String(255), nullable=True),
    )
    op.add_column(
        "activities",
        sa.Column("external_assigned_hours", sa.Integer, nullable=True),
    )


def downgrade() -> None:
    op.drop_column("activities", "external_assigned_hours")
    op.drop_column("activities", "external_supervisor_email")
    op.drop_column("activities", "external_supervisor")
    op.drop_column("activities", "external_beneficiary")
