"""Almacenamiento de multimedia fuera de la base de datos (refs en media_assets)

Revision ID: 017_media_assets
Revises: 016_activity_evidence
Create Date: 2026-07-15
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "017_media_assets"
down_revision: Union[str, None] = "016_activity_evidence"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TENANT_DEFAULT = "00000000-0000-0000-0000-000000000001"


def upgrade() -> None:
    op.create_table(
        "media_assets",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        sa.Column("tenant_id", sa.UUID(as_uuid=True), nullable=False, server_default=TENANT_DEFAULT),
        sa.Column("owner_type", sa.String(40), nullable=False),
        sa.Column("owner_id", sa.UUID(as_uuid=True), nullable=False),
        sa.Column("kind", sa.String(20), nullable=False),
        sa.Column("filename", sa.String(255), nullable=True),
        sa.Column("content_type", sa.String(100), nullable=True),
        sa.Column("byte_size", sa.Integer, nullable=True),
        sa.Column("backend", sa.String(20), nullable=False, server_default="local"),
        sa.Column("reference", sa.Text, nullable=False),
        sa.Column("created_by", sa.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Index("ix_media_assets_owner", "owner_type", "owner_id"),
        sa.Index("ix_media_assets_tenant_id", "tenant_id"),
    )

    # Referencias en las entidades que antes guardaban base64 inline.
    op.add_column(
        "users",
        sa.Column("photo_asset_id", sa.UUID(as_uuid=True), sa.ForeignKey("media_assets.id"), nullable=True),
    )
    op.create_index("ix_users_photo_asset_id", "users", ["photo_asset_id"])

    op.add_column(
        "activities",
        sa.Column("certificate_asset_id", sa.UUID(as_uuid=True), sa.ForeignKey("media_assets.id"), nullable=True),
    )
    op.create_index("ix_activities_certificate_asset_id", "activities", ["certificate_asset_id"])

    op.add_column(
        "activity_evidence",
        sa.Column("media_asset_id", sa.UUID(as_uuid=True), sa.ForeignKey("media_assets.id"), nullable=True),
    )
    op.create_index("ix_activity_evidence_media_asset_id", "activity_evidence", ["media_asset_id"])
    # La URL deja de ser obligatoria: ahora es la referencia pública (o el
    # data:URL legacy hasta migrar los datos existentes).
    op.alter_column("activity_evidence", "image_url", existing_type=sa.Text, nullable=True)

    op.add_column(
        "incubator_attachments",
        sa.Column("media_asset_id", sa.UUID(as_uuid=True), sa.ForeignKey("media_assets.id"), nullable=True),
    )
    op.create_index("ix_incubator_attachments_media_asset_id", "incubator_attachments", ["media_asset_id"])
    # El binario legacy (data:URL) deja de ser obligatorio.
    op.alter_column("incubator_attachments", "data", existing_type=sa.Text, nullable=True)


def downgrade() -> None:
    op.alter_column("incubator_attachments", "data", existing_type=sa.Text, nullable=False)
    op.drop_index("ix_incubator_attachments_media_asset_id", table_name="incubator_attachments")
    op.drop_column("incubator_attachments", "media_asset_id")

    op.alter_column("activity_evidence", "image_url", existing_type=sa.Text, nullable=False)
    op.drop_index("ix_activity_evidence_media_asset_id", table_name="activity_evidence")
    op.drop_column("activity_evidence", "media_asset_id")

    op.drop_index("ix_activities_certificate_asset_id", table_name="activities")
    op.drop_column("activities", "certificate_asset_id")

    op.drop_index("ix_users_photo_asset_id", table_name="users")
    op.drop_column("users", "photo_asset_id")

    op.drop_table("media_assets")
