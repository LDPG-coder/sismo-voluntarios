"""Add ceded_by to activity_members for the pending transfer accept flow.

A cupo transfer now creates a ``pending_transfer`` membership for the receiver
that only becomes ``active`` once they accept it (or is removed on reject,
restoring the sender to ``active``). ``ceded_by`` records who initiated it.

Revision ID: 023_add_ceded_by
Revises: 022_add_activity_demo
Create Date: 2026-07-17
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "023_add_ceded_by"
down_revision: Union[str, None] = "022_add_activity_demo"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "activity_members",
        sa.Column(
            "ceded_by",
            sa.dialects.postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
    )
    op.create_foreign_key(
        "fk_activity_member_ceded_by",
        "activity_members",
        "users",
        ["ceded_by"],
        ["id"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_activity_member_ceded_by", "activity_members", type_="foreign_key"
    )
    op.drop_column("activity_members", "ceded_by")
