"""Visibility rules for activities.

- The discovery feed (GET /activities) must NOT include the current user's own
  creations (they live under "Mis actividades" / Creadas).
- GET /activities/{id}/attendees must be readable by the creator (so they can
  administer their activity) and by SEP users / admins, but NOT by other
  external (public) accounts (PII protection).
"""

from datetime import datetime, timedelta, timezone

from app.db.constants import MVP_TENANT_ID
from app.db.enums import ActivityStatus
from app.db.models.activities import Activity

from factories import auth_cookies, auth_headers, make_user


def _create_activity(client, user, *, max_participants: int = 1000):
    resp = client.post(
        "/api/v1/activities",
        json={
            "title": "Actividad visibilidad",
            "zone": "Caracas",
            "raw_address": "Av. Libertador 123",
            "date_time": "2030-01-01T10:00:00",
            "max_participants": max_participants,
        },
        cookies=auth_cookies(user),
        headers=auth_headers(),
    )
    assert resp.status_code == 200, resp.text
    return resp.json()["id"]


def _insert_activity(db, owner_id):
    act = Activity(
        title="Actividad propia externa",
        zone="Caracas",
        raw_address="Calle 1",
        date_time=datetime.now(timezone.utc) + timedelta(days=1),
        creator_id=owner_id,
        status=ActivityStatus.active.value,
        tenant_id=MVP_TENANT_ID,
    )
    db.add(act)
    db.commit()
    db.refresh(act)
    return act.id


def test_feed_excludes_own_activity(client, db):
    admin = make_user(db, role="admin", status="active")
    own_id = _create_activity(client, admin)
    # Creator (admin) must not see their own in the discovery feed.
    resp = client.get("/api/v1/activities", cookies=auth_cookies(admin), headers=auth_headers())
    assert resp.status_code == 200
    ids = [a["id"] for a in resp.json()]
    assert own_id not in ids


def test_feed_shows_others_activity(client, db):
    admin = make_user(db, role="admin", status="active")
    other = make_user(db, auth_source="google", status="active")
    own_id = _create_activity(client, admin)
    # An external user DOES see activities published by others.
    resp = client.get("/api/v1/activities", cookies=auth_cookies(other), headers=auth_headers())
    assert resp.status_code == 200
    ids = [a["id"] for a in resp.json()]
    assert own_id in ids


def test_creator_can_view_own_attendees(client, db):
    # External user owning an activity (edge: created outside the normal
    # create-activity restriction) must be able to administer it.
    ext = make_user(db, auth_source="google", status="active")
    act_id = _insert_activity(db, ext.id)
    resp = client.get(
        f"/api/v1/activities/{act_id}/attendees",
        cookies=auth_cookies(ext),
        headers=auth_headers(),
    )
    assert resp.status_code == 200


def test_external_non_creator_cannot_view_attendees(client, db):
    admin = make_user(db, role="admin", status="active")
    ext = make_user(db, auth_source="google", status="active")
    act_id = _create_activity(client, admin)
    resp = client.get(
        f"/api/v1/activities/{act_id}/attendees",
        cookies=auth_cookies(ext),
        headers=auth_headers(),
    )
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "auth.forbidden"


def test_sep_can_view_attendees(client, db):
    admin = make_user(db, role="admin", status="active")
    sep = make_user(db, auth_source="sep", status="active")
    act_id = _create_activity(client, admin)
    resp = client.get(
        f"/api/v1/activities/{act_id}/attendees",
        cookies=auth_cookies(sep),
        headers=auth_headers(),
    )
    assert resp.status_code == 200
