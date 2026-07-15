"""Actividades privadas (registro de actividades ya realizadas)

Marca las actividades registradas cuando su fecha ya paso: son privadas del
becario que las crea, no aparecen en el listado publico, no aceptan
participantes y solo sirven para validar horas externas.

Revision ID: 019_add_activity_private
Revises: 018_activity_validation
Create Date: 2026-07-15
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "019_add_activity_private"
down_revision: Union[str, None] = "018_activity_validation"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "activities",
        sa.Column(
            "is_private",
            sa.Boolean(),
            nullable=False,
            server_default="false",
        ),
    )


def downgrade() -> None:
    op.drop_column("activities", "is_private")
