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


def _create_past_activity(client, user):
    """Registrar una actividad cuya fecha ya paso (registro ya realizado)."""
    past = (datetime.now(timezone.utc) - timedelta(days=3)).strftime("%Y-%m-%dT%H:%M:%S")
    resp = client.post(
        "/api/v1/activities",
        json={
            "title": "Actividad ya realizada",
            "zone": "Caracas",
            "raw_address": "Av. Libertador 123",
            "date_time": past,
        },
        cookies=auth_cookies(user),
        headers=auth_headers(),
    )
    assert resp.status_code == 200, resp.text
    return resp.json()


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


def test_zones_exclude_own_activity(client, db):
    admin = make_user(db, role="admin", status="active")
    other = make_user(db, auth_source="google", status="active")
    own_id = _create_activity(client, admin)  # zona "Caracas"
    # Creator (admin) must not see their own in the zone counts.
    resp = client.get("/api/v1/activities/zones", cookies=auth_cookies(admin), headers=auth_headers())
    assert resp.status_code == 200
    zones = {z["name"]: z["count"] for z in resp.json()}
    assert zones.get("Caracas", 0) == 0
    # Another user DOES see it counted.
    resp = client.get("/api/v1/activities/zones", cookies=auth_cookies(other), headers=auth_headers())
    zones = {z["name"]: z["count"] for z in resp.json()}
    assert zones.get("Caracas", 0) >= 1


def _join(client, user, activity_id):
    resp = client.post(
        f"/api/v1/activities/{activity_id}/join",
        cookies=auth_cookies(user),
        headers=auth_headers(),
    )
    assert resp.status_code == 200, resp.text


def test_feed_excludes_enrolled_activity(client, db):
    admin = make_user(db, role="admin", status="active")
    other = make_user(db, auth_source="google", status="active")
    act_id = _create_activity(client, admin)  # Caracas, active
    _join(client, other, act_id)
    # The user who already joined must not see it in the discovery feed.
    resp = client.get("/api/v1/activities", cookies=auth_cookies(other), headers=auth_headers())
    assert resp.status_code == 200
    ids = [a["id"] for a in resp.json()]
    assert act_id not in ids


def test_zones_exclude_enrolled_activity(client, db):
    admin = make_user(db, role="admin", status="active")
    other = make_user(db, auth_source="google", status="active")
    act_id = _create_activity(client, admin)  # Caracas, active
    _join(client, other, act_id)
    # The user who already joined must not see it counted in the zone tags.
    resp = client.get("/api/v1/activities/zones", cookies=auth_cookies(other), headers=auth_headers())
    assert resp.status_code == 200
    zones = {z["name"]: z["count"] for z in resp.json()}
    assert zones.get("Caracas", 0) == 0


def test_feed_excludes_past_activity_but_link_still_works(client, db):
    admin = make_user(db, role="admin", status="active")
    other = make_user(db, auth_source="google", status="active")
    # Activity whose start date already passed.
    act = Activity(
        title="Actividad ya iniciada",
        zone="Caracas",
        raw_address="Calle 2",
        date_time=datetime.now(timezone.utc) - timedelta(days=1),
        creator_id=admin.id,
        status=ActivityStatus.active.value,
        tenant_id=MVP_TENANT_ID,
    )
    db.add(act)
    db.commit()
    db.refresh(act)
    # Hidden from the discovery feed for everyone (even the organizer).
    for viewer in (admin, other):
        resp = client.get("/api/v1/activities", cookies=auth_cookies(viewer), headers=auth_headers())
        assert resp.status_code == 200
        assert str(act.id) not in [a["id"] for a in resp.json()]
    # Still reachable via direct link / organizer profile.
    resp = client.get(f"/api/v1/activities/{act.id}", cookies=auth_cookies(other), headers=auth_headers())
    assert resp.status_code == 200
    resp = client.get("/api/v1/activities/mine", cookies=auth_cookies(admin), headers=auth_headers())
    assert resp.status_code == 200
    assert str(act.id) in [a["id"] for a in resp.json()]


# -- Registro de actividades ya realizadas (privadas) ------------------------


def test_past_activity_is_registered_as_private(client, db):
    owner = make_user(db, auth_source="google", status="active")
    data = _create_past_activity(client, owner)
    assert data["is_private"] is True


def test_future_activity_is_not_private(client, db):
    owner = make_user(db, auth_source="google", status="active")
    act_id = _create_activity(client, owner)
    resp = client.get(
        f"/api/v1/activities/{act_id}", cookies=auth_cookies(owner), headers=auth_headers()
    )
    assert resp.status_code == 200
    assert resp.json()["is_private"] is False


def test_private_activity_hidden_from_feed_and_zones(client, db):
    owner = make_user(db, auth_source="google", status="active")
    other = make_user(db, auth_source="google", status="active")
    data = _create_past_activity(client, owner)
    # Ni el creador ni terceros la ven en descubrimiento.
    for viewer in (owner, other):
        resp = client.get(
            "/api/v1/activities", cookies=auth_cookies(viewer), headers=auth_headers()
        )
        assert resp.status_code == 200
        assert data["id"] not in [a["id"] for a in resp.json()]
    # Tampoco cuenta en las zonas.
    resp = client.get(
        "/api/v1/activities/zones", cookies=auth_cookies(other), headers=auth_headers()
    )
    zones = {z["name"]: z["count"] for z in resp.json()}
    assert zones.get("Caracas", 0) == 0


def test_private_activity_visible_only_to_creator(client, db):
    owner = make_user(db, auth_source="google", status="active")
    other = make_user(db, auth_source="google", status="active")
    data = _create_past_activity(client, owner)
    # El creador la ve por enlace directo y en "mis actividades".
    resp = client.get(
        f"/api/v1/activities/{data['id']}", cookies=auth_cookies(owner), headers=auth_headers()
    )
    assert resp.status_code == 200
    resp = client.get(
        "/api/v1/activities/mine", cookies=auth_cookies(owner), headers=auth_headers()
    )
    assert data["id"] in [a["id"] for a in resp.json()]
    # Un tercero no puede verla (se responde 404, sin revelar su existencia).
    resp = client.get(
        f"/api/v1/activities/{data['id']}", cookies=auth_cookies(other), headers=auth_headers()
    )
    assert resp.status_code == 404


def test_private_activity_not_visible_to_admin(client, db):
    owner = make_user(db, auth_source="google", status="active")
    admin = make_user(db, role="admin", status="active")
    data = _create_past_activity(client, owner)
    resp = client.get(
        f"/api/v1/activities/{data['id']}", cookies=auth_cookies(admin), headers=auth_headers()
    )
    assert resp.status_code == 404


def test_private_activity_rejects_participants(client, db):
    owner = make_user(db, auth_source="google", status="active")
    other = make_user(db, auth_source="google", status="active")
    data = _create_past_activity(client, owner)
    resp = client.post(
        f"/api/v1/activities/{data['id']}/join",
        cookies=auth_cookies(other),
        headers=auth_headers(),
    )
    assert resp.status_code == 404



