"""Remove external official volunteering columns from activities

Revision ID: 024_remove_external_official
Revises: 023_add_ceded_by
Create Date: 2026-07-18
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "024_remove_external_official"
down_revision: Union[str, None] = "023_add_ceded_by"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop indexes first
    op.drop_index("ix_activities_certificate_asset_id", table_name="activities")
    op.drop_index("ix_activities_validated_by", table_name="activities")

    # Drop foreign key constraints
    op.drop_constraint(
        "fk_activities_validated_by_users", "activities", type_="foreignkey"
    )
    op.drop_constraint(
        "fk_activities_certificate_asset_id_media_assets",
        "activities",
        type_="foreignkey",
    )

    # Drop columns
    op.drop_column("activities", "external_beneficiary")
    op.drop_column("activities", "external_supervisor")
    op.drop_column("activities", "external_supervisor_email")
    op.drop_column("activities", "external_assigned_hours")
    op.drop_column("activities", "external_certificate")
    op.drop_column("activities", "external_relevant_data")
    op.drop_column("activities", "certificate_asset_id")
    op.drop_column("activities", "validated_at")
    op.drop_column("activities", "validated_by")
    op.drop_column("activities", "validation_notes")


def downgrade() -> None:
    op.add_column(
        "activities",
        sa.Column("validation_notes", sa.Text(), nullable=True),
    )
    op.add_column(
        "activities",
        sa.Column("validated_by", sa.dialects.postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        "activities",
        sa.Column("validated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "activities",
        sa.Column("certificate_asset_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        "activities",
        sa.Column("external_relevant_data", sa.Text(), nullable=True),
    )
    op.add_column(
        "activities",
        sa.Column("external_certificate", sa.Text(), nullable=True),
    )
    op.add_column(
        "activities",
        sa.Column("external_assigned_hours", sa.Float(), nullable=True),
    )
    op.add_column(
        "activities",
        sa.Column("external_supervisor_email", sa.String(255), nullable=True),
    )
    op.add_column(
        "activities",
        sa.Column("external_supervisor", sa.String(255), nullable=True),
    )
    op.add_column(
        "activities",
        sa.Column("external_beneficiary", sa.String(255), nullable=True),
    )

    # Re-create foreign keys
    op.create_foreign_key(
        "fk_activities_certificate_asset_id_media_assets",
        "activities",
        "media_assets",
        ["certificate_asset_id"],
        ["id"],
    )
    op.create_foreign_key(
        "fk_activities_validated_by_users",
        "activities",
        "users",
        ["validated_by"],
        ["id"],
    )

    # Re-create indexes
    op.create_index(
        "ix_activities_validated_by", "activities", ["validated_by"]
    )
    op.create_index(
        "ix_activities_certificate_asset_id",
        "activities",
        ["certificate_asset_id"],
    )
