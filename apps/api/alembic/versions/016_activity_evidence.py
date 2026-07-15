"""Comprobantes fotograficos de actividades (activity_evidence)

Revision ID: 016_activity_evidence
Revises: 015_sep_code_challenge
Create Date: 2026-07-15
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "016_activity_evidence"
down_revision: Union[str, None] = "015_sep_code_challenge"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TENANT_DEFAULT = "00000000-0000-0000-0000-000000000001"


def upgrade() -> None:
    op.create_table(
        "activity_evidence",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        sa.Column("tenant_id", sa.UUID(as_uuid=True), nullable=False, server_default=TENANT_DEFAULT),
        sa.Column("activity_id", sa.UUID(as_uuid=True), sa.ForeignKey("activities.id", ondelete="CASCADE"), nullable=False),
        sa.Column("uploaded_by", sa.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("image_url", sa.Text, nullable=False),
        sa.Index("ix_activity_evidence_activity_id", "activity_id"),
        sa.Index("ix_activity_evidence_uploaded_by", "uploaded_by"),
        sa.Index("ix_activity_evidence_tenant_id", "tenant_id"),
    )


def downgrade() -> None:
    op.drop_table("activity_evidence")
