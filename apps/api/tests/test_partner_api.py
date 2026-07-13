"""SEP Partner API (server-to-server notifications for SEP's header)."""

from datetime import datetime, timezone

from app.core.config import get_settings
from app.db.constants import MVP_TENANT_ID
from app.db.models.activities import Activity
from app.db.models.notifications import Notification
from factories import make_user


def _make_activity(db, owner_id):
    act = Activity(
        title="Actividad partner",
        zone="Caracas",
        raw_address="Calle 1",
        date_time=datetime.now(timezone.utc),
        creator_id=owner_id,
        status="active",
        tenant_id=MVP_TENANT_ID,
    )
    db.add(act)
    db.commit()
    db.refresh(act)
    return act


def _make_notification(db, user_id, *, read=False, activity_id=None):
    n = Notification(
        user_id=user_id,
        activity_id=activity_id,
        type="new_enrollment",
        title="Nueva inscripción",
        message="Alguien se inscribió",
        read=read,
    )
    db.add(n)
    db.commit()
    db.refresh(n)
    return n


def _sep_token(client, db, value="test-sep-token"):
    settings = get_settings()
    settings.sep_api_token = value  # cached singleton usado por la dependencia
    return value


def test_partner_requires_token(client, db):
    token = _sep_token(client, db)
    sep = make_user(db, auth_source="sep", sep_user_id="sep-123")
    _make_notification(db, sep.id)
    # Token configurado pero incorrecto -> 401 token_invalid.
    resp = client.get(
        f"/api/v1/partner/v1/users/sep-123/notifications/summary",
        headers={"Authorization": "Bearer wrong"},
    )
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "auth.sep_token_invalid"


def test_partner_summary_and_list(client, db):
    token = _sep_token(client, db)
    sep = make_user(db, auth_source="sep", sep_user_id="sep-123")
    act = _make_activity(db, sep.id)
    _make_notification(db, sep.id, read=False, activity_id=act.id)
    _make_notification(db, sep.id, read=True)

    headers = {"Authorization": f"Bearer {token}"}
    resp = client.get(
        f"/api/v1/partner/v1/users/sep-123/notifications/summary", headers=headers
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["unread"] == 1
    assert len(body["items"]) == 2
    activity_ids = {i["activity_id"] for i in body["items"]}
    assert str(act.id) in activity_ids

    resp = client.get(
        f"/api/v1/partner/v1/users/sep-123/notifications", headers=headers
    )
    assert resp.status_code == 200
    assert len(resp.json()) == 2


def test_partner_unknown_sep_user_empty(client, db):
    token = _sep_token(client, db)
    headers = {"Authorization": f"Bearer {token}"}
    resp = client.get(
        "/api/v1/partner/v1/users/does-not-exist/notifications/summary", headers=headers
    )
    assert resp.status_code == 200
    assert resp.json() == {"unread": 0, "items": []}
