"""Incubadora de Proyectos Comunitarios — modelos de datos.

Un proyecto (`IncubatorProject`) pasa por etapas (ver `ProjectStatus`):
evaluación comunitaria -> recolección de recursos -> ejecución -> rendición
de cuentas -> finalizado. Cada proyecto tiene presupuesto desglosado
(`IncubatorBudgetLine`), evaluaciones estructuradas (`IncubatorEvaluation`),
aportes de la comunidad (`IncubatorContribution`), una cronología automática
(`IncubatorTimelineEvent`), avances (`IncubatorUpdate`) y una rendición
(`IncubatorAccountability`). Los archivos se guardan inline en base64
(`IncubatorAttachment`), coherente con el resto del repo.
"""

from __future__ import annotations

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from app.db.models._base import Base, IdMixin, TenantMixin, TimestampMixin


class IncubatorProject(Base, IdMixin, TimestampMixin, TenantMixin):
    __tablename__ = "incubator_projects"

    creator_id = Column(ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    category = Column(String(100), nullable=False, index=True)
    description = Column(Text, nullable=True)  # Markdown
    objetivos = Column(JSON, nullable=True)  # list[str]
    problematica = Column(Text, nullable=True)  # Markdown
    impacto_esperado = Column(Text, nullable=True)  # Markdown
    plan_ejecucion = Column(Text, nullable=True)  # Markdown
    cronograma = Column(JSON, nullable=True)  # list[{"label": str, "date": str}]
    recursos_necesarios = Column(JSON, nullable=True)  # list[str]
    is_anonymous = Column(Boolean, nullable=False, default=False)

    status = Column(String(20), nullable=False, default="evaluating", index=True)

    # Denormalizados para la tarjeta de resumen y el quórum de aprobación.
    evaluation_count = Column(Integer, nullable=False, default=0)
    evaluation_percentage = Column(Float, nullable=False, default=0.0)
    evaluation_threshold_met = Column(Boolean, nullable=False, default=False)
    evaluation_target = Column(Integer, nullable=False, default=1)

    creator = relationship("User", foreign_keys=[creator_id])

    @property
    def is_active(self) -> bool:
        return self.status in ("collecting", "executing", "accountability", "finished")


class IncubatorAttachment(Base, IdMixin, TimestampMixin, TenantMixin):
    __tablename__ = "incubator_attachments"

    project_id = Column(ForeignKey("incubator_projects.id", ondelete="CASCADE"), nullable=True, index=True)
    update_id = Column(ForeignKey("incubator_updates.id", ondelete="CASCADE"), nullable=True, index=True)
    kind = Column(String(20), nullable=False)  # image | document
    filename = Column(String(255), nullable=True)
    content_type = Column(String(100), nullable=True)
    data = Column(Text, nullable=False)  # data:<mime>;base64,<...>
    size = Column(Integer, nullable=True)


class IncubatorBudgetLine(Base, IdMixin, TimestampMixin, TenantMixin):
    __tablename__ = "incubator_budget_lines"
    __table_args__ = (UniqueConstraint("project_id", "order_index", name="uq_budget_line_order"),)

    project_id = Column(ForeignKey("incubator_projects.id", ondelete="CASCADE"), nullable=False, index=True)
    concept = Column(String(255), nullable=False)
    quantity = Column(Integer, nullable=False, default=1)
    unit_cost = Column(Float, nullable=False, default=0.0)
    line_total = Column(Float, nullable=False, default=0.0)
    status = Column(String(20), nullable=False, default="pending")
    order_index = Column(Integer, nullable=False, default=0)
    covered_by_contribution_id = Column(
        ForeignKey("incubator_contributions.id", ondelete="SET NULL"), nullable=True, index=True
    )


class IncubatorEvaluation(Base, IdMixin, TimestampMixin, TenantMixin):
    __tablename__ = "incubator_evaluations"
    __table_args__ = (UniqueConstraint("project_id", "evaluator_id", name="uq_project_evaluator"),)

    project_id = Column(ForeignKey("incubator_projects.id", ondelete="CASCADE"), nullable=False, index=True)
    evaluator_id = Column(ForeignKey("users.id"), nullable=False, index=True)

    impact_score = Column(Integer, nullable=False)  # 1-5
    planning_score = Column(Integer, nullable=False)  # 1-5
    budget_rating = Column(String(20), nullable=False)  # BudgetRating
    resources_collab_possible = Column(Boolean, nullable=False, default=False)
    resources_notes = Column(Text, nullable=True)
    viability_score = Column(Integer, nullable=False)  # 1-5
    trust_score = Column(Integer, nullable=False)  # 1-5

    # Visible SOLO para el creador del proyecto (retroalimentación privada).
    recommendation = Column(Text, nullable=True)


class IncubatorContribution(Base, IdMixin, TimestampMixin, TenantMixin):
    __tablename__ = "incubator_contributions"

    project_id = Column(ForeignKey("incubator_projects.id", ondelete="CASCADE"), nullable=False, index=True)
    contributor_id = Column(ForeignKey("users.id"), nullable=False, index=True)
    type = Column(String(20), nullable=False)  # ContributionType
    amount = Column(Float, nullable=True)  # solo para dinero
    description = Column(Text, nullable=True)
    budget_line_id = Column(
        ForeignKey("incubator_budget_lines.id", ondelete="SET NULL"), nullable=True, index=True
    )
    is_anonymous = Column(Boolean, nullable=False, default=False)
    status = Column(String(20), nullable=False, default="confirmed")


class IncubatorTimelineEvent(Base, IdMixin, TimestampMixin, TenantMixin):
    __tablename__ = "incubator_timeline_events"

    project_id = Column(ForeignKey("incubator_projects.id", ondelete="CASCADE"), nullable=False, index=True)
    type = Column(String(30), nullable=False)  # TimelineEventType
    title = Column(String(255), nullable=False)
    meta = Column(JSON, nullable=True)


class IncubatorUpdate(Base, IdMixin, TimestampMixin, TenantMixin):
    __tablename__ = "incubator_updates"

    project_id = Column(ForeignKey("incubator_projects.id", ondelete="CASCADE"), nullable=False, index=True)
    author_id = Column(ForeignKey("users.id"), nullable=False, index=True)
    body = Column(Text, nullable=False)  # Markdown


class IncubatorAccountability(Base, IdMixin, TimestampMixin, TenantMixin):
    __tablename__ = "incubator_accountability"

    project_id = Column(ForeignKey("incubator_projects.id", ondelete="CASCADE"), nullable=False, index=True, unique=True)
    author_id = Column(ForeignKey("users.id"), nullable=False, index=True)
    body = Column(Text, nullable=False)  # Markdown
    presupuesto_final = Column(JSON, nullable=True)  # list de líneas finales
    explicacion_cambios = Column(Text, nullable=True)
    impacto_generado = Column(Text, nullable=True)  # Markdown


__all__ = [
    "IncubatorProject",
    "IncubatorAttachment",
    "IncubatorBudgetLine",
    "IncubatorEvaluation",
    "IncubatorContribution",
    "IncubatorTimelineEvent",
    "IncubatorUpdate",
    "IncubatorAccountability",
]
