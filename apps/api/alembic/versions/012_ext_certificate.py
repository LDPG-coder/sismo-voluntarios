"""Add external official volunteering certificate (PDF) to activities

Revision ID: 012_ext_certificate
Revises: 011_add_external_official
Create Date: 2026-07-14
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "012_ext_certificate"
down_revision: Union[str, None] = "011_add_external_official"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "activities",
        sa.Column("external_certificate", sa.Text, nullable=True),
    )


def downgrade() -> None:
    op.drop_column("activities", "external_certificate")
