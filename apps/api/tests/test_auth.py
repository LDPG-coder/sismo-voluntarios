"""Integration tests for the security hardening (D1, C1, C2, refresh, permisos)."""

from uuid import uuid4

from app.api.v1.auth import _resolve_or_create_sep_user
from app.pipeline.session_store import (
    issue_refresh,
    revoke_user_sessions,
)
from factories import auth_cookies, auth_headers, make_user


# -- D1: server-side logout revocation -------------------------------------


def test_logout_revokes_session(client, db):
    user = make_user(db, role="admin", status="active")
    cookies = auth_cookies(user)

    assert client.get("/api/v1/auth/me", cookies=cookies).status_code == 200

    logout = client.post("/api/v1/auth/logout", cookies=cookies, headers=auth_headers())
    assert logout.status_code == 204

    after = client.get("/api/v1/auth/me", cookies=cookies)
    assert after.status_code == 401
    assert after.json()["error"]["code"] == "auth.session_revoked"


# -- C1: create_activity ignores body injection ----------------------------


def test_create_activity_ignores_body_injection(client, db):
    admin = make_user(db, role="admin", status="active")
    cookies = auth_cookies(admin)
    headers = auth_headers()
    body = {
        "title": "Cleanup",
        "zone": "Caracas",
        "raw_address": "Av. Libertador 123",
        "date_time": "2030-01-01T10:00:00",
        # Injection attempts: these must be ignored / overridden server-side.
        "creator_id": str(uuid4()),
        "status": "pending",
        "tenant_id": "hack",
    }
    resp = client.post(
        "/api/v1/activities", json=body, cookies=cookies, headers=headers
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["creator_id"] == str(admin.id)
    assert data["status"] == "active"
    assert data["title"] == "Cleanup"


def test_create_activity_validation(client, db):
    admin = make_user(db, role="admin", status="active")
    cookies = auth_cookies(admin)
    headers = auth_headers()
    base = {
        "title": "X",
        "zone": "Z",
        "raw_address": "A",
        "date_time": "2030-01-01T10:00:00",
    }
    missing = {k: v for k, v in base.items() if k != "title"}
    assert (
        client.post(
            "/api/v1/activities", json=missing, cookies=cookies, headers=headers
        ).status_code
        == 422
    )
    assert (
        client.post(
            "/api/v1/activities",
            json={**base, "max_participants": 0},
            cookies=cookies,
            headers=headers,
        ).status_code
        == 422
    )


# -- C2: SEP cannot escalate privileges -------------------------------------


def test_sep_cannot_escalate_to_admin(db):
    sep_id = "sep-" + uuid4().hex
    # New SEP user asserting admin role is created as volunteer.
    u = _resolve_or_create_sep_user(
        db, sep_user_id=sep_id, email="sep1@example.com", name=None, role="admin"
    )
    assert u.role == "volunteer"

    # Existing SEP user stays volunteer even if SEP claims admin.
    u2 = _resolve_or_create_sep_user(
        db, sep_user_id=sep_id, email="sep1@example.com", name="X", role="admin"
    )
    assert u2.id == u.id
    assert u2.role == "volunteer"

    # An existing admin reached via SEP is not demoted/promoted by SEP.
    admin = make_user(
        db,
        role="admin",
        status="active",
        auth_source="sep",
        sep_user_id="sep-admin-1",
        email="admin@example.com",
    )
    u3 = _resolve_or_create_sep_user(
        db, sep_user_id="sep-admin-1", email="admin@example.com", name="Y", role="admin"
    )
    assert u3.id == admin.id
    assert u3.role == "admin"


# -- Refresh tokens: rotation + family revocation --------------------------


def test_refresh_rotates_and_invalidates_old(client, db):
    user = make_user(db, role="volunteer", status="active")
    rid = issue_refresh(str(user.id), user.role, user.status)

    resp = client.post("/api/v1/auth/refresh", json={"refresh_token": rid})
    assert resp.status_code == 200, resp.text
    new_rid = resp.json()["refresh_token"]
    assert new_rid != rid

    # The consumed (old) token must no longer work.
    again = client.post("/api/v1/auth/refresh", json={"refresh_token": rid})
    assert again.status_code == 401


def test_refresh_revoked_on_family_bump(client, db):
    user = make_user(db, role="volunteer", status="active")
    rid = issue_refresh(str(user.id), user.role, user.status)
    revoke_user_sessions(str(user.id))
    resp = client.post("/api/v1/auth/refresh", json={"refresh_token": rid})
    assert resp.status_code == 401


# -- Permisos unificados SEP/externo y alta de usuarios desactivada --------


def test_external_user_can_create_activity(client, db):
    # Las cuentas externas (auth_source=google) pueden crear actividades.
    ext = make_user(db, auth_source="google", status="active")
    cookies = auth_cookies(ext)
    headers = auth_headers()
    body = {
        "title": "Limpieza externa",
        "zone": "Caracas",
        "raw_address": "Av. Libertador 123",
        "date_time": "2030-01-01T10:00:00",
    }
    resp = client.post("/api/v1/activities", json=body, cookies=cookies, headers=headers)
    assert resp.status_code == 200, resp.text
    assert resp.json()["creator_id"] == str(ext.id)


def test_referral_endpoint_disabled(client, db):
    # El alta por token está desactivada: el endpoint no debe existir.
    resp = client.post("/api/v1/auth/referral", json={"code": "WHATEVER"})
    assert resp.status_code == 404


def test_invite_endpoint_disabled(client, db):
    # La invitación por email está desactivada: el endpoint no debe existir.
    user = make_user(db, role="admin", status="active")
    cookies = auth_cookies(user)
    headers = auth_headers()
    resp = client.post(
        "/api/v1/auth/invite",
        json={"email": "nuevo@example.com"},
        cookies=cookies,
        headers=headers,
    )
    assert resp.status_code == 404
