"""Integration tests for the Incubadora de Proyectos Comunitarios feature.

Run inside the `test-api` container (Postgres + Redis available). Mirrors the
auth/CSRF helpers used across the suite (see tests/factories.py).
"""

from factories import auth_cookies, auth_headers, make_user

EVAL_PAYLOAD = {
    "impact_score": 5,
    "planning_score": 4,
    "viability_score": 5,
    "trust_score": 4,
    "budget_rating": "adequate",
    "resources_collab_possible": True,
    "recommendation": "Buen proyecto",
}


def _create_project(client, user, **overrides):
    body = {
        "title": "Huerta comunitaria",
        "category": "Medio ambiente",
        "description": "Propuesta de prueba",
        "problematica": "Escasez de alimentos",
        "impacto_esperado": "Mas frutas y verduras",
        "plan_ejecucion": "Paso a paso",
        "objetivos": ["Sembrar", "Cosechar"],
        "recursos_necesarios": ["Tierra", "Agua"],
        "cronograma": [{"label": "Siembra", "date": "2030-03-01"}],
        "budget": [{"concept": "Semillas", "quantity": 10, "unit_cost": 5}],
        "is_anonymous": False,
    }
    body.update(overrides)
    resp = client.post(
        "/api/v1/incubator/projects",
        json=body,
        cookies=auth_cookies(user),
        headers=auth_headers(),
    )
    return resp


def test_create_project_requires_auth(client, db):
    resp = client.post(
        "/api/v1/incubator/projects",
        json={"title": "x", "category": "y"},
        headers=auth_headers(),
    )
    assert resp.status_code == 401


def test_create_and_get_project(client, db):
    creator = make_user(db, auth_source="sep", status="active")
    resp = _create_project(client, creator)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["title"] == "Huerta comunitaria"
    assert data["status"] == "evaluating"
    assert data["budget"]["totals"]["total"] == 50
    assert data["creator"]["id"] == str(creator.id)

    got = client.get(
        f"/api/v1/incubator/projects/{data['id']}",
        cookies=auth_cookies(creator),
        headers=auth_headers(),
    )
    assert got.status_code == 200
    assert got.json()["id"] == data["id"]


def test_creator_cannot_evaluate_own_project(client, db):
    creator = make_user(db, auth_source="sep", status="active")
    project = _create_project(client, creator).json()

    resp = client.post(
        f"/api/v1/incubator/projects/{project['id']}/evaluate",
        json=EVAL_PAYLOAD,
        cookies=auth_cookies(creator),
        headers=auth_headers(),
    )
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "project.not_creator"


def test_community_evaluation_gates_admin_approval_flow(client, db):
    creator = make_user(db, auth_source="sep", status="active")
    evaluator = make_user(db, auth_source="google", status="active")
    admin = make_user(db, role="admin", status="active")
    project = _create_project(client, creator).json()
    pid = project["id"]

    # Admin cannot approve before the community reaches quorum.
    missing = client.post(
        f"/api/v1/incubator/projects/{pid}/approve",
        cookies=auth_cookies(admin),
        headers=auth_headers(),
    )
    assert missing.status_code == 409
    assert missing.json()["error"]["code"] == "project.not_approved"

    # A single evaluation reaches the quorum (target=1) with active users.
    eval_resp = client.post(
        f"/api/v1/incubator/projects/{pid}/evaluate",
        json=EVAL_PAYLOAD,
        cookies=auth_cookies(evaluator),
        headers=auth_headers(),
    )
    assert eval_resp.status_code == 200

    approve = client.post(
        f"/api/v1/incubator/projects/{pid}/approve",
        cookies=auth_cookies(admin),
        headers=auth_headers(),
    )
    assert approve.status_code == 200
    assert approve.json()["status"] == "collecting"

    # Contributions are accepted once collecting.
    contrib = client.post(
        f"/api/v1/incubator/projects/{pid}/contributions",
        json={"type": "money", "amount": 100, "message": "apoyo"},
        cookies=auth_cookies(evaluator),
        headers=auth_headers(),
    )
    assert contrib.status_code == 200
    assert any(c["amount"] == 100 for c in contrib.json()["contributions"])

    # Start execution, publish accountability, finish (creator-only actions).
    start = client.post(
        f"/api/v1/incubator/projects/{pid}/start-execution",
        cookies=auth_cookies(creator),
        headers=auth_headers(),
    )
    assert start.status_code == 200
    assert start.json()["status"] == "executing"

    acc = client.post(
        f"/api/v1/incubator/projects/{pid}/accountability",
        json={
            "body": "Rendimos cuentas",
            "presupuesto_final": [{"concept": "Semillas", "quantity": 10, "unit_cost": 5}],
            "explicacion_cambios": None,
            "impacto_generado": "Cosecha lista",
        },
        cookies=auth_cookies(creator),
        headers=auth_headers(),
    )
    assert acc.status_code == 200
    assert acc.json()["status"] == "accountability"

    finish = client.post(
        f"/api/v1/incubator/projects/{pid}/finish",
        cookies=auth_cookies(creator),
        headers=auth_headers(),
    )
    assert finish.status_code == 200
    assert finish.json()["status"] == "finished"


def test_non_admin_cannot_approve(client, db):
    creator = make_user(db, auth_source="sep", status="active")
    # SEP internal non-admin (e.g. becario/egresado) must be forbidden from
    # admin routes; external google users are intentionally allowed (see docs).
    evaluator = make_user(db, auth_source="sep", status="active")
    project = _create_project(client, creator).json()
    pid = project["id"]

    client.post(
        f"/api/v1/incubator/projects/{pid}/evaluate",
        json=EVAL_PAYLOAD,
        cookies=auth_cookies(evaluator),
        headers=auth_headers(),
    )
    resp = client.post(
        f"/api/v1/incubator/projects/{pid}/approve",
        cookies=auth_cookies(evaluator),
        headers=auth_headers(),
    )
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "auth.forbidden"


def test_duplicate_evaluation_rejected(client, db):
    creator = make_user(db, auth_source="sep", status="active")
    evaluator = make_user(db, auth_source="google", status="active")
    project = _create_project(client, creator).json()
    pid = project["id"]

    first = client.post(
        f"/api/v1/incubator/projects/{pid}/evaluate",
        json=EVAL_PAYLOAD,
        cookies=auth_cookies(evaluator),
        headers=auth_headers(),
    )
    assert first.status_code == 200
    second = client.post(
        f"/api/v1/incubator/projects/{pid}/evaluate",
        json=EVAL_PAYLOAD,
        cookies=auth_cookies(evaluator),
        headers=auth_headers(),
    )
    assert second.status_code == 409
    assert second.json()["error"]["code"] == "evaluation.already_submitted"
