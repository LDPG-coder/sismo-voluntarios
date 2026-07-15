"""Photo evidence (comprobantes) for activities.

- Upload/delete is reserved to the creator and only while the activity has
  started and is not closed (archived/cancelled).
- Listing is open to any authenticated user.
"""

from datetime import datetime, timedelta, timezone

from app.db.constants import MVP_TENANT_ID
from app.db.enums import ActivityStatus
from app.db.models.activities import Activity

from factories import auth_cookies, auth_headers, make_user

PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC"


def _make_activity(db, owner, *, started: bool, closed: bool = False):
    date_time = (
        datetime.now(timezone.utc) - timedelta(days=1)
        if started
        else datetime.now(timezone.utc) + timedelta(days=1)
    )
    status = (
        ActivityStatus.archived.value
        if closed
        else ActivityStatus.active.value
    )
    act = Activity(
        title="Actividad evidencia",
        zone="Caracas",
        raw_address="Calle 3",
        date_time=date_time,
        creator_id=owner.id,
        status=status,
        tenant_id=MVP_TENANT_ID,
    )
    db.add(act)
    db.commit()
    db.refresh(act)
    return act


def test_list_evidence_empty_for_started(client, db):
    owner = make_user(db, role="admin", status="active")
    other = make_user(db, auth_source="google", status="active")
    act = _make_activity(db, owner, started=True)
    resp = client.get(
        f"/api/v1/activities/{act.id}/evidence",
        cookies=auth_cookies(other),
        headers=auth_headers(),
    )
    assert resp.status_code == 200
    assert resp.json() == []


def test_upload_requires_started(client, db):
    owner = make_user(db, role="admin", status="active")
    act = _make_activity(db, owner, started=False)
    resp = client.post(
        f"/api/v1/activities/{act.id}/evidence",
        json={"images": [PNG]},
        cookies=auth_cookies(owner),
        headers=auth_headers(),
    )
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "validation.invalid"


def test_upload_requires_creator(client, db):
    owner = make_user(db, role="admin", status="active")
    intruder = make_user(db, auth_source="google", status="active")
    act = _make_activity(db, owner, started=True)
    resp = client.post(
        f"/api/v1/activities/{act.id}/evidence",
        json={"images": [PNG]},
        cookies=auth_cookies(intruder),
        headers=auth_headers(),
    )
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "activity.not_creator"


def test_upload_and_delete_flow(client, db):
    owner = make_user(db, role="admin", status="active")
    act = _make_activity(db, owner, started=True)

    # Upload multiple images in one request.
    resp = client.post(
        f"/api/v1/activities/{act.id}/evidence",
        json={"images": [PNG, PNG]},
        cookies=auth_cookies(owner),
        headers=auth_headers(),
    )
    assert resp.status_code == 200
    items = resp.json()["items"]
    assert len(items) == 2
    assert items[0]["image_url"] == PNG

    # Listed for any authenticated viewer.
    resp = client.get(
        f"/api/v1/activities/{act.id}/evidence",
        cookies=auth_cookies(owner),
        headers=auth_headers(),
    )
    assert resp.status_code == 200
    assert len(resp.json()) == 2

    # Delete one before close.
    ev_id = items[0]["id"]
    resp = client.delete(
        f"/api/v1/activities/{act.id}/evidence/{ev_id}",
        cookies=auth_cookies(owner),
        headers=auth_headers(),
    )
    assert resp.status_code == 200

    resp = client.get(
        f"/api/v1/activities/{act.id}/evidence",
        cookies=auth_cookies(owner),
        headers=auth_headers(),
    )
    assert len(resp.json()) == 1


def test_delete_blocked_after_close(client, db):
    owner = make_user(db, role="admin", status="active")
    act = _make_activity(db, owner, started=True, closed=True)
    resp = client.post(
        f"/api/v1/activities/{act.id}/evidence",
        json={"images": [PNG]},
        cookies=auth_cookies(owner),
        headers=auth_headers(),
    )
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "validation.invalid"
