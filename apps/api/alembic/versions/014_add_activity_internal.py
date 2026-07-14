"""Add internal volunteering flag to activities

Voluntariado interno: tareas rapidas publicadas por coordinadores/becarios de
AVAA que suman horas al programa. Excluyente con el voluntariado externo oficial.

Revision ID: 014_add_internal
Revises: 013_incubator
Create Date: 2026-07-14
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "014_add_internal"
down_revision: Union[str, None] = "013_incubator"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "activities",
        sa.Column(
            "is_internal",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )


def downgrade() -> None:
    op.drop_column("activities", "is_internal")
