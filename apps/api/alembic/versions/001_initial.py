"""Initial schema: users, activities, activity_members, oauth tables

Revision ID: 001_initial
Revises:
Create Date: 2025-01-01
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, ENUM

revision: str = "001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Enums via raw SQL
    op.execute("CREATE TYPE user_role AS ENUM ('volunteer', 'admin')")
    op.execute("CREATE TYPE user_status AS ENUM ('pending', 'active', 'suspended')")
    op.execute("CREATE TYPE activity_status AS ENUM ('active', 'cancelled')")

    # Users
    op.create_table(
        "users",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("tenant_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("email", sa.String(255), unique=True, nullable=False),
        sa.Column("google_subject", sa.String(64), unique=True, nullable=True),
        sa.Column("name", sa.String(255), nullable=True),
        sa.Column("role", sa.String(20), nullable=False, server_default="volunteer"),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("referral_code", sa.String(20), unique=True, nullable=False),
        sa.Column("referred_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_users_email", "users", ["email"])
    op.create_index("ix_users_referral_code", "users", ["referral_code"])

    # Activities
    op.create_table(
        "activities",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("tenant_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("zone", sa.String(100), nullable=False),
        sa.Column("raw_address", sa.Text, nullable=False),
        sa.Column("date_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("max_participants", sa.Integer, nullable=True),
        sa.Column("requirements", sa.Text, nullable=True),
        sa.Column("creator_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="active"),
    )
    op.create_index("ix_activities_zone", "activities", ["zone"])
    op.create_index("ix_activities_date_time", "activities", ["date_time"])
    op.create_index("ix_activities_creator_id", "activities", ["creator_id"])

    # Activity members
    op.create_table(
        "activity_members",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("activity_id", UUID(as_uuid=True), sa.ForeignKey("activities.id"), nullable=False),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("attended", sa.Boolean, nullable=True),
    )
    op.create_index("ix_activity_members_activity_id", "activity_members", ["activity_id"])
    op.create_index("ix_activity_members_user_id", "activity_members", ["user_id"])
    op.create_unique_constraint("uq_activity_member", "activity_members", ["activity_id", "user_id"])

    # OAuth state tables
    op.create_table(
        "oauth_states",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("state", sa.String(255), unique=True, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("return_to", sa.Text, nullable=True),
        sa.Column("consumed", sa.Boolean, nullable=False, server_default=sa.text("false")),
    )
    op.create_index("ix_oauth_states_state", "oauth_states", ["state"])

    op.create_table(
        "oauth_exchange_codes",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("code", sa.String(255), unique=True, nullable=False),
        sa.Column("user_id", sa.String(36), nullable=False),
        sa.Column("role", sa.String(20), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("consumed", sa.Boolean, nullable=False, server_default=sa.text("false")),
    )
    op.create_index("ix_oauth_exchange_codes_code", "oauth_exchange_codes", ["code"])


def downgrade() -> None:
    op.drop_table("oauth_exchange_codes")
    op.drop_table("oauth_states")
    op.drop_table("activity_members")
    op.drop_table("activities")
    op.drop_table("users")
    op.execute("DROP TYPE IF EXISTS activity_status")
    op.execute("DROP TYPE IF EXISTS user_status")
    op.execute("DROP TYPE IF EXISTS user_role")
