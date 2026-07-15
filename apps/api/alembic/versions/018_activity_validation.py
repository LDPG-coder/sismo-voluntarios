"""Add external-activity validation flow fields to activities

Introduce el flujo de validacion de actividades externas: el becario completa
los datos y los envia a revision (status=pending_validation); un administrador
los valida (status=validated) y se registran fecha y responsable. Tambien se
agrega el campo de datos relevantes libres.

Revision ID: 018_activity_validation
Revises: 017_media_assets
Create Date: 2026-07-15
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "018_activity_validation"
down_revision: str | None = "017_media_assets"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "activities",
        sa.Column("external_relevant_data", sa.Text(), nullable=True),
    )
    op.add_column(
        "activities",
        sa.Column("validated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "activities",
        sa.Column(
            "validated_by",
            sa.dialects.postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
    )
    op.create_foreign_key(
        "fk_activities_validated_by_users",
        "activities",
        "users",
        ["validated_by"],
        ["id"],
    )
    op.create_index("ix_activities_validated_by", "activities", ["validated_by"])
    op.add_column(
        "activities",
        sa.Column("validation_notes", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("activities", "validation_notes")
    op.drop_index("ix_activities_validated_by", table_name="activities")
    op.drop_constraint("fk_activities_validated_by_users", "activities", type_="foreignkey")
    op.drop_column("activities", "validated_by")
    op.drop_column("activities", "validated_at")
    op.drop_column("activities", "external_relevant_data")
