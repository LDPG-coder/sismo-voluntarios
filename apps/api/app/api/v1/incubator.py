"""Incubadora de Proyectos Comunitarios — endpoints.

Flujo: propuesta (evaluating) -> aprobación por quórum (collecting) ->
ejecución (executing) -> rendición (accountability) -> finalizado (finished).
Las evaluaciones son estructuradas y su retroalimentación es privada para el
creador. Los aportes reducen automáticamente lo pendiente del presupuesto.
"""

from __future__ import annotations

from math import ceil
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.core.errors import ApiError, ErrorCode
from app.core.logging import get_logger
from app.db.base import get_db
from app.db.constants import MVP_TENANT_ID
from app.db.enums import (
    BudgetLineStatus,
    BudgetRating,
    ContributionType,
    ProjectStatus,
    TimelineEventType,
    UserStatus,
)
from app.db.models import (
    IncubatorAccountability,
    IncubatorAttachment,
    IncubatorBudgetLine,
    IncubatorContribution,
    IncubatorEvaluation,
    IncubatorProject,
    IncubatorTimelineEvent,
    IncubatorUpdate,
    MediaAsset,
    MediaOwnerType,
    User,
)
from app.storage.service import (
    MediaError,
    decode_data_url,
    save_media,
)
from app.pipeline.dependencies import require_admin_session, require_session

router = APIRouter(prefix="/incubator", tags=["incubator"])
_log = get_logger("app.api.v1.incubator")

# 10% de los becarios activos deben haber evaluado para alcanzar quórum.
APPROVAL_QUORUM = 0.10
_MAX_IMAGE_LEN = 4 * 1024 * 1024
_MAX_DOC_LEN = 8 * 1024 * 1024
_MAX_LIST_ITEMS = 60


# -- Request bodies -------------------------------------------------------


class _BudgetLineBody(BaseModel):
    concept: str = Field(..., min_length=1, max_length=255)
    quantity: int = Field(..., ge=1, le=100000)
    unit_cost: float = Field(..., ge=0, le=1_000_000_000)


class _AttachmentBody(BaseModel):
    kind: str = Field(..., pattern="^(image|document)$")
    filename: str | None = Field(None, max_length=255)
    content_type: str | None = Field(None, max_length=100)
    data: str  # data:<mime>;base64,...
    size: int | None = Field(None, ge=0, le=32 * 1024 * 1024)


class _CreateProjectBody(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    category: str = Field(..., min_length=1, max_length=100)
    description: str | None = Field(None, max_length=20000)
    objetivos: list[str] | None = Field(None, max_length=60)
    problematica: str | None = Field(None, max_length=20000)
    impacto_esperado: str | None = Field(None, max_length=20000)
    plan_ejecucion: str | None = Field(None, max_length=20000)
    cronograma: list[dict] | None = Field(None, max_length=120)
    recursos_necesarios: list[str] | None = Field(None, max_length=60)
    is_anonymous: bool = False
    budget: list[_BudgetLineBody] | None = Field(None, max_length=200)
    images: list[_AttachmentBody] | None = Field(None, max_length=30)
    documents: list[_AttachmentBody] | None = Field(None, max_length=30)


class _UpdateProjectBody(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=255)
    category: str | None = Field(None, min_length=1, max_length=100)
    description: str | None = Field(None, max_length=20000)
    objetivos: list[str] | None = Field(None, max_length=60)
    problematica: str | None = Field(None, max_length=20000)
    impacto_esperado: str | None = Field(None, max_length=20000)
    plan_ejecucion: str | None = Field(None, max_length=20000)
    cronograma: list[dict] | None = Field(None, max_length=120)
    recursos_necesarios: list[str] | None = Field(None, max_length=60)
    is_anonymous: bool | None = None
    budget: list[_BudgetLineBody] | None = Field(None, max_length=200)
    images: list[_AttachmentBody] | None = Field(None, max_length=30)
    documents: list[_AttachmentBody] | None = Field(None, max_length=30)


class _EvaluateBody(BaseModel):
    impact_score: int = Field(..., ge=1, le=5)
    planning_score: int = Field(..., ge=1, le=5)
    budget_rating: str
    resources_collab_possible: bool = False
    resources_notes: str | None = Field(None, max_length=4000)
    viability_score: int = Field(..., ge=1, le=5)
    trust_score: int = Field(..., ge=1, le=5)
    recommendation: str | None = Field(None, max_length=4000)


class _ContributionBody(BaseModel):
    type: str
    amount: float | None = Field(None, ge=0, le=1_000_000_000)
    description: str | None = Field(None, max_length=2000)
    budget_line_id: str | None = None
    is_anonymous: bool = False


class _UpdateBody(BaseModel):
    body: str = Field(..., min_length=1, max_length=20000)
    images: list[_AttachmentBody] | None = Field(None, max_length=30)


class _AccountabilityBody(BaseModel):
    body: str = Field(..., min_length=1, max_length=20000)
    presupuesto_final: list[_BudgetLineBody] | None = Field(None, max_length=200)
    explicacion_cambios: str | None = Field(None, max_length=8000)
    impacto_generado: str | None = Field(None, max_length=20000)


# -- Helpers --------------------------------------------------------------


def _add_timeline(db: Session, project: IncubatorProject, etype: TimelineEventType, title: str, meta: dict | None = None) -> None:
    ev = IncubatorTimelineEvent(
        project_id=project.id, type=etype.value, title=title, meta=meta
    )
    ev.tenant_id = MVP_TENANT_ID
    db.add(ev)


def _serialize_attachment(a: IncubatorAttachment) -> dict:
    # `url` es la referencia pública derivada del asset (o el data:URL legacy
    # mientras no se migre). El binario nunca viaja en `data`.
    url = None
    if a.media_asset_id is not None:
        from app.core.config import get_settings

        url = f"{get_settings().media_public_base_url}/{a.media_asset_id}"
    else:
        url = a.data
    return {
        "id": str(a.id),
        "kind": a.kind,
        "filename": a.filename,
        "content_type": a.content_type,
        "url": url,
        "data": a.data if a.media_asset_id is None else None,
        "size": a.size,
    }


def _serialize_creator(p: IncubatorProject, db: Session) -> dict:
    if p.is_anonymous:
        return {"id": None, "name": "Anónimo", "photo_url": None, "is_anonymous": True}
    u = db.get(User, p.creator_id)
    if not u:
        return {"id": None, "name": "Desconocido", "photo_url": None, "is_anonymous": False}
    return {"id": str(u.id), "name": u.name, "photo_url": u.photo_url, "is_anonymous": False}


def _serialize_budget_line(line: IncubatorBudgetLine) -> dict:
    return {
        "id": str(line.id),
        "concept": line.concept,
        "quantity": line.quantity,
        "unit_cost": line.unit_cost,
        "line_total": line.line_total,
        "status": line.status,
        "order_index": line.order_index,
        "covered_by_contribution_id": str(line.covered_by_contribution_id)
        if line.covered_by_contribution_id
        else None,
    }


def _compute_budget_totals(lines: list[IncubatorBudgetLine], contributions: list[IncubatorContribution]) -> dict:
    total = sum(float(line.line_total) for line in lines)
    covered_lines = sum(float(line.line_total) for line in lines if line.status != BudgetLineStatus.pending.value)
    general_money = sum(float(c.amount or 0) for c in contributions if c.type == ContributionType.money.value and c.budget_line_id is None)
    covered = covered_lines + general_money
    remaining = max(0.0, total - covered)
    return {
        "total": round(total, 2),
        "covered": round(covered, 2),
        "remaining": round(remaining, 2),
        "progress": round(min(100.0, (covered / total * 100) if total > 0 else 0.0), 1),
    }


def _serialize_evaluation(ev: IncubatorEvaluation, db: Session, include_private: bool) -> dict:
    evaluator = db.get(User, ev.evaluator_id)
    data = {
        "id": str(ev.id),
        "evaluator": {
            "id": str(ev.evaluator_id),
            "name": evaluator.name if evaluator else "Desconocido",
            "photo_url": evaluator.photo_url if evaluator else None,
        },
        "impact_score": ev.impact_score,
        "planning_score": ev.planning_score,
        "budget_rating": ev.budget_rating,
        "resources_collab_possible": ev.resources_collab_possible,
        "resources_notes": ev.resources_notes,
        "viability_score": ev.viability_score,
        "trust_score": ev.trust_score,
        "created_at": ev.created_at.isoformat() if ev.created_at else None,
    }
    if include_private:
        data["recommendation"] = ev.recommendation
    return data


def _active_user_count(db: Session) -> int:
    return (
        db.execute(
            select(func.count()).select_from(User).where(User.status == UserStatus.active.value)
        ).scalar()
        or 0
    )


def _recompute_evaluation(db: Session, project: IncubatorProject) -> None:
    count = (
        db.execute(
            select(func.count()).select_from(IncubatorEvaluation).where(IncubatorEvaluation.project_id == project.id)
        ).scalar()
        or 0
    )
    target = max(1, project.evaluation_target)
    percentage = min(100.0, (count / target) * 100.0) if target else 0.0
    project.evaluation_count = count
    project.evaluation_percentage = round(percentage, 1)
    project.evaluation_threshold_met = count >= target


def _validate_attachment(att: _AttachmentBody) -> None:
    if not att.data or ";" not in att.data:
        raise ApiError(ErrorCode.validation_invalid_format, "archivo inválido")
    limit = _MAX_IMAGE_LEN if att.kind == "image" else _MAX_DOC_LEN
    if len(att.data) > limit:
        raise ApiError(
            ErrorCode.validation_invalid_format,
            "el archivo es demasiado grande"
            if att.kind == "document"
            else "la imagen es demasiado grande",
        )


def _create_attachments(db: Session, items: list[_AttachmentBody] | None, *, project_id: UUID | None = None, update_id: UUID | None = None) -> list[IncubatorAttachment]:
    created: list[IncubatorAttachment] = []
    for att in items or []:
        _validate_attachment(att)
        try:
            mime, raw = decode_data_url(att.data)
        except MediaError as e:
            raise ApiError(ErrorCode.validation_invalid_format, str(e))
        owner_id = project_id or update_id
        asset = save_media(
            db,
            owner_type=MediaOwnerType.INCUBATOR_ATTACHMENT,
            owner_id=owner_id,
            kind=att.kind,
            content_type=mime,
            data=raw,
            filename=att.filename,
        )
        db.flush()
        a = IncubatorAttachment(
            project_id=project_id,
            update_id=update_id,
            kind=att.kind,
            filename=att.filename,
            content_type=mime,
            data=None,
            size=asset.byte_size,
            media_asset_id=asset.id,
        )
        a.tenant_id = MVP_TENANT_ID
        db.add(a)
        created.append(a)
    return created


def _create_budget_lines(db: Session, items: list[_BudgetLineBody], project_id: UUID) -> list[IncubatorBudgetLine]:
    lines: list[IncubatorBudgetLine] = []
    for i, item in enumerate(items):
        line_total = float(item.quantity) * float(item.unit_cost)
        line = IncubatorBudgetLine(
            project_id=project_id,
            concept=item.concept.strip(),
            quantity=item.quantity,
            unit_cost=float(item.unit_cost),
            line_total=round(line_total, 2),
            status=BudgetLineStatus.pending.value,
            order_index=i,
        )
        line.tenant_id = MVP_TENANT_ID
        db.add(line)
        lines.append(line)
    return lines


def _serialize_project(p: IncubatorProject, db: Session, user: User) -> dict:
    is_creator = str(p.creator_id) == str(user.id)

    lines = (
        db.execute(
            select(IncubatorBudgetLine)
            .where(IncubatorBudgetLine.project_id == p.id)
            .order_by(IncubatorBudgetLine.order_index)
        ).scalars().all()
    )
    contributions = (
        db.execute(
            select(IncubatorContribution).where(IncubatorContribution.project_id == p.id)
        ).scalars().all()
    )
    totals = _compute_budget_totals(list(lines), list(contributions))

    evaluations = (
        db.execute(
            select(IncubatorEvaluation)
            .where(IncubatorEvaluation.project_id == p.id)
            .order_by(IncubatorEvaluation.created_at)
        ).scalars().all()
    )
    eval_list = [_serialize_evaluation(ev, db, include_private=is_creator) for ev in evaluations]
    budget_rating_counts: dict[str, int] = {}
    if eval_list:
        for ev in eval_list:
            budget_rating_counts[ev["budget_rating"]] = budget_rating_counts.get(ev["budget_rating"], 0) + 1

    timeline = (
        db.execute(
            select(IncubatorTimelineEvent)
            .where(IncubatorTimelineEvent.project_id == p.id)
            .order_by(IncubatorTimelineEvent.created_at)
        ).scalars().all()
    )
    attachments = (
        db.execute(
            select(IncubatorAttachment).where(IncubatorAttachment.project_id == p.id)
        ).scalars().all()
    )
    updates = (
        db.execute(
            select(IncubatorUpdate)
            .where(IncubatorUpdate.project_id == p.id)
            .order_by(IncubatorUpdate.created_at.desc())
        ).scalars().all()
    )
    accountability = db.execute(
        select(IncubatorAccountability).where(IncubatorAccountability.project_id == p.id)
    ).scalars().first()

    images = [a for a in attachments if a.kind == "image"]
    documents = [a for a in attachments if a.kind == "document"]

    update_list = []
    for u in updates:
        u_atts = (
            db.execute(select(IncubatorAttachment).where(IncubatorAttachment.update_id == u.id))
            .scalars().all()
        )
        author = db.get(User, u.author_id)
        update_list.append(
            {
                "id": str(u.id),
                "body": u.body,
                "author": {"id": str(u.author_id), "name": author.name if author else "Desconocido", "photo_url": author.photo_url if author else None},
                "attachments": [_serialize_attachment(a) for a in u_atts],
                "created_at": u.created_at.isoformat() if u.created_at else None,
            }
        )

    contrib_list = []
    for c in contributions:
        contributor = db.get(User, c.contributor_id)
        contrib_list.append(
            {
                "id": str(c.id),
                "type": c.type,
                "amount": c.amount,
                "description": c.description,
                "budget_line_id": str(c.budget_line_id) if c.budget_line_id else None,
                "is_anonymous": c.is_anonymous,
                "contributor": {"id": str(c.contributor_id), "name": "Anónimo" if c.is_anonymous else (contributor.name if contributor else "Desconocido")},
                "created_at": c.created_at.isoformat() if c.created_at else None,
            }
        )

    has_evaluated = any(str(ev.evaluator_id) == str(user.id) for ev in evaluations)

    return {
        "id": str(p.id),
        "title": p.title,
        "category": p.category,
        "description": p.description,
        "objetivos": p.objetivos or [],
        "problematica": p.problematica,
        "impacto_esperado": p.impacto_esperado,
        "plan_ejecucion": p.plan_ejecucion,
        "cronograma": p.cronograma or [],
        "recursos_necesarios": p.recursos_necesarios or [],
        "is_anonymous": p.is_anonymous,
        "status": p.status,
        "creator": _serialize_creator(p, db),
        "is_creator": is_creator,
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "updated_at": p.updated_at.isoformat() if p.updated_at else None,
        "budget": {
            "lines": [_serialize_budget_line(line) for line in lines],
            "totals": totals,
        },
        "evaluation": {
            "count": p.evaluation_count,
            "percentage": p.evaluation_percentage,
            "threshold_met": p.evaluation_threshold_met,
            "target": p.evaluation_target,
            "averages": {
                "impact": round(sum(e["impact_score"] for e in eval_list) / len(eval_list), 2) if eval_list else None,
                "planning": round(sum(e["planning_score"] for e in eval_list) / len(eval_list), 2) if eval_list else None,
                "viability": round(sum(e["viability_score"] for e in eval_list) / len(eval_list), 2) if eval_list else None,
                "trust": round(sum(e["trust_score"] for e in eval_list) / len(eval_list), 2) if eval_list else None,
            },
            "budget_rating_counts": budget_rating_counts,
            "items": eval_list,
        },
        "timeline": [
            {
                "id": str(t.id),
                "type": t.type,
                "title": t.title,
                "meta": t.meta,
                "created_at": t.created_at.isoformat() if t.created_at else None,
            }
            for t in timeline
        ],
        "images": [_serialize_attachment(a) for a in images],
        "documents": [_serialize_attachment(a) for a in documents],
        "updates": update_list,
        "contributions": contrib_list,
        "accountability": (
            {
                "id": str(accountability.id),
                "body": accountability.body,
                "presupuesto_final": accountability.presupuesto_final or [],
                "explicacion_cambios": accountability.explicacion_cambios,
                "impacto_generado": accountability.impacto_generado,
                "created_at": accountability.created_at.isoformat() if accountability.created_at else None,
            }
            if accountability
            else None
        ),
        "permissions": {
            "can_evaluate": (not has_evaluated) and p.status == ProjectStatus.evaluating.value,
            "can_contribute": p.status in (ProjectStatus.collecting.value, ProjectStatus.executing.value),
            "can_publish_update": is_creator and p.status in (ProjectStatus.collecting.value, ProjectStatus.executing.value, ProjectStatus.accountability.value),
            "can_publish_accountability": is_creator and p.status in (ProjectStatus.collecting.value, ProjectStatus.executing.value, ProjectStatus.accountability.value),
            "can_start_execution": is_creator and p.status == ProjectStatus.collecting.value,
            "can_finish": is_creator and accountability is not None and p.status != ProjectStatus.finished.value,
        },
    }


def _serialize_project_summary(p: IncubatorProject, db: Session) -> dict:
    cover = db.execute(
        select(IncubatorAttachment)
        .where(IncubatorAttachment.project_id == p.id, IncubatorAttachment.kind == "image")
        .order_by(IncubatorAttachment.created_at)
    ).scalars().first()
    return {
        "id": str(p.id),
        "title": p.title,
        "category": p.category,
        "status": p.status,
        "is_anonymous": p.is_anonymous,
        "creator": _serialize_creator(p, db),
        "evaluation_percentage": p.evaluation_percentage,
        "evaluation_count": p.evaluation_count,
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "cover_image": _serialize_attachment(cover) if cover else None,
    }


# -- Endpoints ------------------------------------------------------------


@router.get("/projects")
def list_projects(
    user: Annotated[User, Depends(require_session)],
    db: Annotated[Session, Depends(get_db)],
    tab: str = Query("evaluating", description="evaluating | active"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> dict:
    if tab == "active":
        q = select(IncubatorProject).where(
            IncubatorProject.status.in_(
                [
                    ProjectStatus.collecting.value,
                    ProjectStatus.executing.value,
                    ProjectStatus.accountability.value,
                    ProjectStatus.finished.value,
                ]
            )
        )
    else:
        q = select(IncubatorProject).where(IncubatorProject.status == ProjectStatus.evaluating.value)

    total = db.execute(select(func.count()).select_from(q.subquery())).scalar() or 0
    offset = (page - 1) * page_size
    rows = (
        db.execute(q.order_by(IncubatorProject.created_at.desc()).offset(offset).limit(page_size))
        .scalars().all()
    )
    return {
        "tab": tab,
        "total": total,
        "page": page,
        "page_size": page_size,
        "projects": [_serialize_project_summary(p, db) for p in rows],
    }


@router.post("/projects")
def create_project(
    body: _CreateProjectBody,
    user: Annotated[User, Depends(require_session)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    title = body.title.strip()
    if not title:
        raise ApiError(ErrorCode.validation_missing_field, "title is required")
    category = body.category.strip()
    if not category:
        raise ApiError(ErrorCode.validation_missing_field, "category is required")

    if body.cronograma is not None:
        for item in body.cronograma:
            if not isinstance(item, dict) or not item.get("label") or not item.get("date"):
                raise ApiError(ErrorCode.validation_invalid_format, "cronograma inválido")

    target = max(1, ceil(_active_user_count(db) * APPROVAL_QUORUM))

    p = IncubatorProject(
        creator_id=user.id,
        title=title,
        category=category,
        description=body.description,
        objetivos=body.objetivos or [],
        problematica=body.problematica,
        impacto_esperado=body.impacto_esperado,
        plan_ejecucion=body.plan_ejecucion,
        cronograma=body.cronograma or [],
        recursos_necesarios=body.recursos_necesarios or [],
        is_anonymous=body.is_anonymous,
        status=ProjectStatus.evaluating.value,
        evaluation_target=target,
    )
    p.tenant_id = MVP_TENANT_ID
    db.add(p)
    db.flush()

    if body.budget:
        if len(body.budget) > _MAX_LIST_ITEMS:
            raise ApiError(ErrorCode.validation_invalid_format, "presupuesto demasiado grande")
        _create_budget_lines(db, body.budget, p.id)
    _create_attachments(db, body.images, project_id=p.id)
    _create_attachments(db, body.documents, project_id=p.id)

    _add_timeline(db, p, TimelineEventType.created, "Proyecto creado")
    _add_timeline(db, p, TimelineEventType.evaluation_started, "Comenzó la evaluación comunitaria")

    db.commit()
    db.refresh(p)
    _log.info("incubator.project.created", project_id=str(p.id), creator_id=str(user.id))
    return _serialize_project(p, db, user)


@router.get("/projects/{project_id}")
def get_project(
    project_id: str,
    user: Annotated[User, Depends(require_session)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    p = db.get(IncubatorProject, UUID(project_id))
    if not p:
        raise ApiError(ErrorCode.project_not_found, "proyecto no encontrado")
    return _serialize_project(p, db, user)


@router.put("/projects/{project_id}")
def update_project(
    project_id: str,
    body: _UpdateProjectBody,
    user: Annotated[User, Depends(require_session)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    p = db.get(IncubatorProject, UUID(project_id))
    if not p:
        raise ApiError(ErrorCode.project_not_found, "proyecto no encontrado")
    if str(p.creator_id) != str(user.id):
        raise ApiError(ErrorCode.project_not_creator, "solo el creador puede editar")
    if p.status != ProjectStatus.evaluating.value:
        raise ApiError(ErrorCode.project_not_evaluating, "solo se puede editar durante la evaluación")

    if body.title is not None:
        t = body.title.strip()
        if not t:
            raise ApiError(ErrorCode.validation_missing_field, "title is required")
        p.title = t
    if body.category is not None:
        c = body.category.strip()
        if not c:
            raise ApiError(ErrorCode.validation_missing_field, "category is required")
        p.category = c
    for field in ("description", "objetivos", "problematica", "impacto_esperado", "plan_ejecucion", "cronograma", "recursos_necesarios"):
        val = getattr(body, field)
        if val is not None:
            if field == "cronograma":
                for item in val:
                    if not isinstance(item, dict) or not item.get("label") or not item.get("date"):
                        raise ApiError(ErrorCode.validation_invalid_format, "cronograma inválido")
            setattr(p, field, val)
    if body.is_anonymous is not None:
        p.is_anonymous = body.is_anonymous

    if body.budget is not None:
        if len(body.budget) > _MAX_LIST_ITEMS:
            raise ApiError(ErrorCode.validation_invalid_format, "presupuesto demasiado grande")
        db.execute(delete(IncubatorBudgetLine).where(IncubatorBudgetLine.project_id == p.id))
        db.flush()
        _create_budget_lines(db, body.budget, p.id)

    _create_attachments(db, body.images, project_id=p.id)
    _create_attachments(db, body.documents, project_id=p.id)

    db.commit()
    db.refresh(p)
    return _serialize_project(p, db, user)


@router.post("/projects/{project_id}/evaluate")
def evaluate_project(
    project_id: str,
    body: _EvaluateBody,
    user: Annotated[User, Depends(require_session)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    p = db.get(IncubatorProject, UUID(project_id))
    if not p:
        raise ApiError(ErrorCode.project_not_found, "proyecto no encontrado")
    if str(p.creator_id) == str(user.id):
        raise ApiError(ErrorCode.project_not_creator, "no puedes evaluar tu propia propuesta")
    if p.status != ProjectStatus.evaluating.value:
        raise ApiError(ErrorCode.evaluation_closed, "la evaluación está cerrada")

    try:
        budget_rating = BudgetRating(body.budget_rating)
    except ValueError:
        raise ApiError(ErrorCode.validation_invalid_format, "budget_rating inválido") from None

    existing = db.execute(
        select(IncubatorEvaluation).where(
            IncubatorEvaluation.project_id == p.id, IncubatorEvaluation.evaluator_id == user.id
        )
    ).scalars().first()
    if existing:
        raise ApiError(ErrorCode.evaluation_already_submitted, "ya evaluaste este proyecto")

    ev = IncubatorEvaluation(
        project_id=p.id,
        evaluator_id=user.id,
        impact_score=body.impact_score,
        planning_score=body.planning_score,
        budget_rating=budget_rating.value,
        resources_collab_possible=body.resources_collab_possible,
        resources_notes=body.resources_notes,
        viability_score=body.viability_score,
        trust_score=body.trust_score,
        recommendation=body.recommendation,
    )
    ev.tenant_id = MVP_TENANT_ID
    db.add(ev)
    db.flush()
    _recompute_evaluation(db, p)
    db.commit()
    db.refresh(p)
    _log.info("incubator.project.evaluated", project_id=str(p.id), evaluator_id=str(user.id))
    return _serialize_project(p, db, user)


@router.get("/projects/{project_id}/evaluations")
def list_evaluations(
    project_id: str,
    user: Annotated[User, Depends(require_session)],
    db: Annotated[Session, Depends(get_db)],
) -> list[dict]:
    p = db.get(IncubatorProject, UUID(project_id))
    if not p:
        raise ApiError(ErrorCode.project_not_found, "proyecto no encontrado")
    is_creator = str(p.creator_id) == str(user.id)
    evals = (
        db.execute(
            select(IncubatorEvaluation)
            .where(IncubatorEvaluation.project_id == p.id)
            .order_by(IncubatorEvaluation.created_at)
        ).scalars().all()
    )
    return [_serialize_evaluation(ev, db, include_private=is_creator) for ev in evals]


@router.post("/projects/{project_id}/approve")
def approve_project(
    project_id: str,
    user: Annotated[User, Depends(require_admin_session)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    p = db.get(IncubatorProject, UUID(project_id))
    if not p:
        raise ApiError(ErrorCode.project_not_found, "proyecto no encontrado")
    if p.status != ProjectStatus.evaluating.value:
        raise ApiError(ErrorCode.project_not_evaluating, "el proyecto no está en evaluación")
    if not p.evaluation_threshold_met:
        raise ApiError(ErrorCode.project_not_approved, "aún no se alcanza el cuórum de evaluación")
    p.status = ProjectStatus.collecting.value
    _add_timeline(db, p, TimelineEventType.approved, "Proyecto aprobado por administración")
    db.commit()
    db.refresh(p)
    return _serialize_project(p, db, user)


@router.post("/projects/{project_id}/contributions")
def contribute(
    project_id: str,
    body: _ContributionBody,
    user: Annotated[User, Depends(require_session)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    p = db.get(IncubatorProject, UUID(project_id))
    if not p:
        raise ApiError(ErrorCode.project_not_found, "proyecto no encontrado")
    if p.status not in (ProjectStatus.collecting.value, ProjectStatus.executing.value):
        raise ApiError(ErrorCode.project_not_approved, "el proyecto no está recibiendo recursos")

    try:
        ctype = ContributionType(body.type)
    except ValueError:
        raise ApiError(ErrorCode.validation_invalid_format, "type de aporte inválido") from None

    if ctype == ContributionType.money:
        if body.amount is None or body.amount <= 0:
            raise ApiError(ErrorCode.contribution_invalid, "los aportes económicos requieren monto")
    else:
        if not body.description and not body.budget_line_id:
            raise ApiError(ErrorCode.contribution_invalid, "especifica el recurso aportado")

    line = None
    if body.budget_line_id:
        line = db.get(IncubatorBudgetLine, UUID(body.budget_line_id))
        if not line or str(line.project_id) != str(p.id):
            raise ApiError(ErrorCode.budget_line_not_found, "línea de presupuesto no encontrada")
        if line.status != BudgetLineStatus.pending.value:
            raise ApiError(ErrorCode.contribution_invalid, "esa línea ya está cubierta")

    c = IncubatorContribution(
        project_id=p.id,
        contributor_id=user.id,
        type=ctype.value,
        amount=body.amount if ctype == ContributionType.money else None,
        description=body.description,
        budget_line_id=line.id if line else None,
        is_anonymous=body.is_anonymous,
        status="confirmed",
    )
    c.tenant_id = MVP_TENANT_ID
    db.add(c)
    db.flush()

    if line:
        line.covered_by_contribution_id = c.id
        line.status = (
            BudgetLineStatus.covered_money.value
            if ctype == ContributionType.money
            else BudgetLineStatus.covered_in_kind.value
        )

    # Cronología: primer aporte económico / primer aporte en especie.
    existing = db.execute(
        select(func.count()).select_from(IncubatorContribution).where(IncubatorContribution.project_id == p.id)
    ).scalar() or 0
    if ctype == ContributionType.money and existing <= 1:
        _add_timeline(db, p, TimelineEventType.first_donation, "Primera donación recibida")
    elif ctype != ContributionType.money and existing <= 1:
        _add_timeline(db, p, TimelineEventType.in_kind_received, "Recursos en especie recibidos")

    db.commit()
    db.refresh(p)
    _log.info("incubator.project.contribution", project_id=str(p.id), contributor_id=str(user.id), type=ctype.value)
    return _serialize_project(p, db, user)


@router.post("/projects/{project_id}/start-execution")
def start_execution(
    project_id: str,
    user: Annotated[User, Depends(require_session)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    p = db.get(IncubatorProject, UUID(project_id))
    if not p:
        raise ApiError(ErrorCode.project_not_found, "proyecto no encontrado")
    if str(p.creator_id) != str(user.id):
        raise ApiError(ErrorCode.project_not_creator, "solo el creador puede iniciar la ejecución")
    if p.status != ProjectStatus.collecting.value:
        raise ApiError(ErrorCode.project_not_approved, "el proyecto debe estar en recolección de recursos")
    p.status = ProjectStatus.executing.value
    _add_timeline(db, p, TimelineEventType.execution_started, "Inicio de ejecución")
    db.commit()
    db.refresh(p)
    return _serialize_project(p, db, user)


@router.post("/projects/{project_id}/updates")
def publish_update(
    project_id: str,
    body: _UpdateBody,
    user: Annotated[User, Depends(require_session)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    p = db.get(IncubatorProject, UUID(project_id))
    if not p:
        raise ApiError(ErrorCode.project_not_found, "proyecto no encontrado")
    if str(p.creator_id) != str(user.id):
        raise ApiError(ErrorCode.project_not_creator, "solo el creador puede publicar avances")
    if p.status not in (ProjectStatus.collecting.value, ProjectStatus.executing.value, ProjectStatus.accountability.value):
        raise ApiError(ErrorCode.project_not_approved, "no se pueden publicar avances en esta etapa")

    u = IncubatorUpdate(project_id=p.id, author_id=user.id, body=body.body.strip())
    u.tenant_id = MVP_TENANT_ID
    db.add(u)
    db.flush()
    _create_attachments(db, body.images, update_id=u.id)
    _add_timeline(db, p, TimelineEventType.update_published, "Publicación de avances")
    db.commit()
    db.refresh(p)
    return _serialize_project(p, db, user)


@router.post("/projects/{project_id}/accountability")
def publish_accountability(
    project_id: str,
    body: _AccountabilityBody,
    user: Annotated[User, Depends(require_session)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    p = db.get(IncubatorProject, UUID(project_id))
    if not p:
        raise ApiError(ErrorCode.project_not_found, "proyecto no encontrado")
    if str(p.creator_id) != str(user.id):
        raise ApiError(ErrorCode.project_not_creator, "solo el creador puede rendir cuentas")
    if p.status not in (ProjectStatus.collecting.value, ProjectStatus.executing.value, ProjectStatus.accountability.value):
        raise ApiError(ErrorCode.project_not_approved, "no se puede rendir cuentas en esta etapa")

    existing = db.execute(
        select(IncubatorAccountability).where(IncubatorAccountability.project_id == p.id)
    ).scalars().first()
    if existing:
        existing.body = body.body.strip()
        existing.presupuesto_final = [line.model_dump() for line in (body.presupuesto_final or [])]
        existing.explicacion_cambios = body.explicacion_cambios
        existing.impacto_generado = body.impacto_generado
        acc = existing
    else:
        acc = IncubatorAccountability(
            project_id=p.id,
            author_id=user.id,
            body=body.body.strip(),
            presupuesto_final=[line.model_dump() for line in (body.presupuesto_final or [])],
            explicacion_cambios=body.explicacion_cambios,
            impacto_generado=body.impacto_generado,
        )
        acc.tenant_id = MVP_TENANT_ID
        db.add(acc)

    p.status = ProjectStatus.accountability.value
    _add_timeline(db, p, TimelineEventType.accountability_published, "Rendición de cuentas publicada")
    db.commit()
    db.refresh(p)
    return _serialize_project(p, db, user)


@router.post("/projects/{project_id}/finish")
def finish_project(
    project_id: str,
    user: Annotated[User, Depends(require_session)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    p = db.get(IncubatorProject, UUID(project_id))
    if not p:
        raise ApiError(ErrorCode.project_not_found, "proyecto no encontrado")
    if str(p.creator_id) != str(user.id):
        raise ApiError(ErrorCode.project_not_creator, "solo el creador puede finalizar")
    accountability = db.execute(
        select(IncubatorAccountability).where(IncubatorAccountability.project_id == p.id)
    ).scalars().first()
    if not accountability:
        raise ApiError(ErrorCode.accountability_required, "debes publicar la rendición de cuentas antes de finalizar")
    p.status = ProjectStatus.finished.value
    _add_timeline(db, p, TimelineEventType.finished, "Proyecto finalizado")
    db.commit()
    db.refresh(p)
    return _serialize_project(p, db, user)
