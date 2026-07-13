"""Integration tests for the security hardening (D1, C1, C2, refresh, referidos)."""

from datetime import UTC, datetime, timedelta
from uuid import uuid4

import redis

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


# -- Referidos / invitaciones (E1/E2) -------------------------------------


def test_referral_valid_and_invalid(client, db):
    pending = make_user(db, status="pending", referral_code="INVITECODE1")
    ok = client.post("/api/v1/auth/referral", json={"code": pending.referral_code})
    assert ok.status_code == 200
    assert ok.json() == {"valid": True}

    bad = client.post("/api/v1/auth/referral", json={"code": "NOPE-NOPE-NOPE"})
    assert bad.status_code == 400
    assert bad.json()["error"]["code"] == "referral.invalid"


def test_referral_expired_is_invalid(client, db):
    old = make_user(
        db,
        status="pending",
        referral_code="OLDCODE123",
        created_at=datetime.now(UTC) - timedelta(days=31),
    )
    resp = client.post("/api/v1/auth/referral", json={"code": old.referral_code})
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "referral.invalid"


def test_referral_rate_limit(client, db):
    # The public validation oracle must be throttled so it cannot be brute
    # forced to enumerate valid invitation codes.
    r = redis.Redis.from_url("redis://redis:6379/1")
    r.flushdb()
    statuses = [
        client.post("/api/v1/auth/referral", json={"code": "X"}).status_code
        for _ in range(12)
    ]
    assert all(s in (200, 400) for s in statuses[:10])
    assert 429 in statuses[10:]


def test_invite_reissues_expired_pending(client, db):
    admin = make_user(db, role="admin", status="active")
    old = make_user(
        db,
        status="pending",
        email="expired@example.com",
        referral_code="OLDINVITE01",
        created_at=datetime.now(UTC) - timedelta(days=31),
    )
    cookies = auth_cookies(admin)
    headers = auth_headers()
    resp = client.post(
        "/api/v1/auth/invite",
        json={"email": "expired@example.com"},
        cookies=cookies,
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["id"] == str(old.id)
    assert data["referral_code"] != old.referral_code
