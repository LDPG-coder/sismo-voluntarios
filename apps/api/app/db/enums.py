from enum import StrEnum


class UserRole(StrEnum):
    volunteer = "volunteer"
    admin = "admin"


class UserStatus(StrEnum):
    pending = "pending"
    active = "active"
    suspended = "suspended"


class ActivityStatus(StrEnum):
    active = "active"
    cancelled = "cancelled"
    archived = "archived"
    # Voluntariado externo oficial: una vez el becario completa la evidencia y
    # la envia a revision, queda en espera de validacion por un administrador.
    pending_validation = "pending_validation"
    # Validada por un administrador: queda registrada la fecha y el responsable.
    validated = "validated"


class ProjectStatus(StrEnum):
    """Etapas de la Incubadora de Proyectos Comunitarios.

    El estado `approved` es transitorio: al aprobarse un proyecto pasa
    directamente a `collecting` (recepción de recursos). La rendición de
    cuentas (`accountability`) es obligatoria antes de `finished`.
    """

    evaluating = "evaluating"
    collecting = "collecting"
    executing = "executing"
    accountability = "accountability"
    finished = "finished"


class BudgetLineStatus(StrEnum):
    pending = "pending"
    covered_money = "covered_money"
    covered_in_kind = "covered_in_kind"


class BudgetRating(StrEnum):
    adequate = "adequate"
    optimizable = "optimizable"
    insufficient = "insufficient"
    excessive = "excessive"


class ContributionType(StrEnum):
    money = "money"
    in_kind = "in_kind"
    loan = "loan"
    tools = "tools"
    materials = "materials"
    transport = "transport"
    other = "other"


class TimelineEventType(StrEnum):
    created = "created"
    evaluation_started = "evaluation_started"
    approved = "approved"
    first_donation = "first_donation"
    in_kind_received = "in_kind_received"
    execution_started = "execution_started"
    update_published = "update_published"
    accountability_published = "accountability_published"
    finished = "finished"
