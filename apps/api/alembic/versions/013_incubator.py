"""Incubadora de Proyectos Comunitarios — tablas iniciales.

Revision ID: 013_incubator
Revises: 012_ext_certificate
Create Date: 2026-07-14
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "013_incubator"
down_revision: Union[str, None] = "012_ext_certificate"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TENANT_DEFAULT = "00000000-0000-0000-0000-000000000001"

FK_BUDGET_CONTRIBUTION = "fk_incubator_budget_lines_contribution"


def upgrade() -> None:
    op.create_table(
        "incubator_projects",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        sa.Column("tenant_id", sa.UUID(as_uuid=True), nullable=False, server_default=TENANT_DEFAULT),
        sa.Column("creator_id", sa.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("category", sa.String(100), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("objetivos", sa.JSON, nullable=True),
        sa.Column("problematica", sa.Text, nullable=True),
        sa.Column("impacto_esperado", sa.Text, nullable=True),
        sa.Column("plan_ejecucion", sa.Text, nullable=True),
        sa.Column("cronograma", sa.JSON, nullable=True),
        sa.Column("recursos_necesarios", sa.JSON, nullable=True),
        sa.Column("is_anonymous", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("status", sa.String(20), nullable=False, server_default="evaluating"),
        sa.Column("evaluation_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("evaluation_percentage", sa.Float, nullable=False, server_default="0.0"),
        sa.Column("evaluation_threshold_met", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("evaluation_target", sa.Integer, nullable=False, server_default="1"),
        sa.Index("ix_incubator_projects_creator_id", "creator_id"),
        sa.Index("ix_incubator_projects_category", "category"),
        sa.Index("ix_incubator_projects_status", "status"),
        sa.Index("ix_incubator_projects_tenant_id", "tenant_id"),
    )

    op.create_table(
        "incubator_updates",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        sa.Column("tenant_id", sa.UUID(as_uuid=True), nullable=False, server_default=TENANT_DEFAULT),
        sa.Column("project_id", sa.UUID(as_uuid=True), sa.ForeignKey("incubator_projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("author_id", sa.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("body", sa.Text, nullable=False),
        sa.Index("ix_incubator_updates_project_id", "project_id"),
        sa.Index("ix_incubator_updates_author_id", "author_id"),
        sa.Index("ix_incubator_updates_tenant_id", "tenant_id"),
    )

    op.create_table(
        "incubator_attachments",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        sa.Column("tenant_id", sa.UUID(as_uuid=True), nullable=False, server_default=TENANT_DEFAULT),
        sa.Column("project_id", sa.UUID(as_uuid=True), sa.ForeignKey("incubator_projects.id", ondelete="CASCADE"), nullable=True),
        sa.Column("update_id", sa.UUID(as_uuid=True), sa.ForeignKey("incubator_updates.id", ondelete="CASCADE"), nullable=True),
        sa.Column("kind", sa.String(20), nullable=False),
        sa.Column("filename", sa.String(255), nullable=True),
        sa.Column("content_type", sa.String(100), nullable=True),
        sa.Column("data", sa.Text, nullable=False),
        sa.Column("size", sa.Integer, nullable=True),
        sa.Index("ix_incubator_attachments_project_id", "project_id"),
        sa.Index("ix_incubator_attachments_update_id", "update_id"),
        sa.Index("ix_incubator_attachments_tenant_id", "tenant_id"),
    )

    op.create_table(
        "incubator_budget_lines",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        sa.Column("tenant_id", sa.UUID(as_uuid=True), nullable=False, server_default=TENANT_DEFAULT),
        sa.Column("project_id", sa.UUID(as_uuid=True), sa.ForeignKey("incubator_projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("concept", sa.String(255), nullable=False),
        sa.Column("quantity", sa.Integer, nullable=False, server_default="1"),
        sa.Column("unit_cost", sa.Float, nullable=False, server_default="0.0"),
        sa.Column("line_total", sa.Float, nullable=False, server_default="0.0"),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("order_index", sa.Integer, nullable=False, server_default="0"),
        sa.Column("covered_by_contribution_id", sa.UUID(as_uuid=True), nullable=True),
        sa.UniqueConstraint("project_id", "order_index", name="uq_budget_line_order"),
        sa.Index("ix_incubator_budget_lines_project_id", "project_id"),
        sa.Index("ix_incubator_budget_lines_covered_by_contribution_id", "covered_by_contribution_id"),
        sa.Index("ix_incubator_budget_lines_tenant_id", "tenant_id"),
    )

    op.create_table(
        "incubator_contributions",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        sa.Column("tenant_id", sa.UUID(as_uuid=True), nullable=False, server_default=TENANT_DEFAULT),
        sa.Column("project_id", sa.UUID(as_uuid=True), sa.ForeignKey("incubator_projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("contributor_id", sa.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("type", sa.String(20), nullable=False),
        sa.Column("amount", sa.Float, nullable=True),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("budget_line_id", sa.UUID(as_uuid=True), sa.ForeignKey("incubator_budget_lines.id", ondelete="SET NULL"), nullable=True),
        sa.Column("is_anonymous", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("status", sa.String(20), nullable=False, server_default="confirmed"),
        sa.Index("ix_incubator_contributions_project_id", "project_id"),
        sa.Index("ix_incubator_contributions_contributor_id", "contributor_id"),
        sa.Index("ix_incubator_contributions_budget_line_id", "budget_line_id"),
        sa.Index("ix_incubator_contributions_tenant_id", "tenant_id"),
    )

    # Break the budget_lines <-> contributions cycle: add the reverse FK now
    # that both tables exist.
    op.create_foreign_key(
        FK_BUDGET_CONTRIBUTION,
        "incubator_budget_lines",
        "incubator_contributions",
        ["covered_by_contribution_id"],
        ["id"],
        ondelete="SET NULL",
    )

    op.create_table(
        "incubator_evaluations",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        sa.Column("tenant_id", sa.UUID(as_uuid=True), nullable=False, server_default=TENANT_DEFAULT),
        sa.Column("project_id", sa.UUID(as_uuid=True), sa.ForeignKey("incubator_projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("evaluator_id", sa.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("impact_score", sa.Integer, nullable=False),
        sa.Column("planning_score", sa.Integer, nullable=False),
        sa.Column("budget_rating", sa.String(20), nullable=False),
        sa.Column("resources_collab_possible", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("resources_notes", sa.Text, nullable=True),
        sa.Column("viability_score", sa.Integer, nullable=False),
        sa.Column("trust_score", sa.Integer, nullable=False),
        sa.Column("recommendation", sa.Text, nullable=True),
        sa.UniqueConstraint("project_id", "evaluator_id", name="uq_project_evaluator"),
        sa.Index("ix_incubator_evaluations_project_id", "project_id"),
        sa.Index("ix_incubator_evaluations_evaluator_id", "evaluator_id"),
        sa.Index("ix_incubator_evaluations_tenant_id", "tenant_id"),
    )

    op.create_table(
        "incubator_timeline_events",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        sa.Column("tenant_id", sa.UUID(as_uuid=True), nullable=False, server_default=TENANT_DEFAULT),
        sa.Column("project_id", sa.UUID(as_uuid=True), sa.ForeignKey("incubator_projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("type", sa.String(30), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("meta", sa.JSON, nullable=True),
        sa.Index("ix_incubator_timeline_events_project_id", "project_id"),
        sa.Index("ix_incubator_timeline_events_tenant_id", "tenant_id"),
    )

    op.create_table(
        "incubator_accountability",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        sa.Column("tenant_id", sa.UUID(as_uuid=True), nullable=False, server_default=TENANT_DEFAULT),
        sa.Column("project_id", sa.UUID(as_uuid=True), sa.ForeignKey("incubator_projects.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("author_id", sa.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("body", sa.Text, nullable=False),
        sa.Column("presupuesto_final", sa.JSON, nullable=True),
        sa.Column("explicacion_cambios", sa.Text, nullable=True),
        sa.Column("impacto_generado", sa.Text, nullable=True),
        sa.Index("ix_incubator_accountability_project_id", "project_id"),
        sa.Index("ix_incubator_accountability_author_id", "author_id"),
        sa.Index("ix_incubator_accountability_tenant_id", "tenant_id"),
    )


def downgrade() -> None:
    op.drop_constraint(FK_BUDGET_CONTRIBUTION, "incubator_budget_lines", type_="foreignkey")
    op.drop_table("incubator_accountability")
    op.drop_table("incubator_evaluations")
    op.drop_table("incubator_timeline_events")
    op.drop_table("incubator_contributions")
    op.drop_table("incubator_budget_lines")
    op.drop_table("incubator_attachments")
    op.drop_table("incubator_updates")
    op.drop_table("incubator_projects")
