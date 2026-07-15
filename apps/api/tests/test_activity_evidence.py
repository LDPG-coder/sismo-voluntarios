"""Photo evidence (comprobantes) for activities.

- The creator OR an active member can upload/delete evidence, only while the
  activity has started and is not closed (archived/cancelled).
- A member can only delete their own evidence; the creator can delete any.
- Listing is restricted: the creator sees everything, everyone else sees only
  their own files plus the creator's (privacy between participants).
"""

from datetime import datetime, timedelta, timezone

from app.db.constants import MVP_TENANT_ID
from app.db.enums import ActivityStatus
from app.db.models.activities import Activity
from app.db.models.activity_members import ActivityMember

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


def _enroll(db, activity_id, user_id):
    m = ActivityMember(activity_id=activity_id, user_id=user_id, status="active")
    db.add(m)
    db.commit()


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
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "validation.invalid_format"


def test_non_member_cannot_upload(client, db):
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
    assert resp.json()["error"]["code"] == "auth.forbidden"


def test_member_can_upload_and_sees_own_plus_creator(client, db):
    owner = make_user(db, role="admin", status="active")
    member = make_user(db, auth_source="google", status="active")
    act = _make_activity(db, owner, started=True)
    _enroll(db, act.id, member.id)

    # Creator uploads their proof.
    resp = client.post(
        f"/api/v1/activities/{act.id}/evidence",
        json={"images": [PNG]},
        cookies=auth_cookies(owner),
        headers=auth_headers(),
    )
    assert resp.status_code == 200

    # Member uploads their own proof.
    resp = client.post(
        f"/api/v1/activities/{act.id}/evidence",
        json={"images": [PNG, PNG]},
        cookies=auth_cookies(member),
        headers=auth_headers(),
    )
    assert resp.status_code == 200
    assert len(resp.json()["items"]) == 2

    # Member listing sees their own (2) + creator's (1) = 3.
    resp = client.get(
        f"/api/v1/activities/{act.id}/evidence",
        cookies=auth_cookies(member),
        headers=auth_headers(),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 3
    assert sum(1 for e in body if e["uploaded_by"] == str(member.id)) == 2
    assert sum(1 for e in body if e["uploaded_by"] == str(owner.id)) == 1


def test_participants_cannot_see_each_others_evidence(client, db):
    owner = make_user(db, role="admin", status="active")
    member1 = make_user(db, auth_source="google", status="active")
    member2 = make_user(db, auth_source="google", status="active")
    act = _make_activity(db, owner, started=True)
    _enroll(db, act.id, member1.id)
    _enroll(db, act.id, member2.id)

    # Creator uploads 1, member1 uploads 1.
    client.post(
        f"/api/v1/activities/{act.id}/evidence",
        json={"images": [PNG]},
        cookies=auth_cookies(owner),
        headers=auth_headers(),
    )
    client.post(
        f"/api/v1/activities/{act.id}/evidence",
        json={"images": [PNG]},
        cookies=auth_cookies(member1),
        headers=auth_headers(),
    )

    # Creator sees both (2).
    resp = client.get(
        f"/api/v1/activities/{act.id}/evidence",
        cookies=auth_cookies(owner),
        headers=auth_headers(),
    )
    assert len(resp.json()) == 2

    # member2 (no uploads) sees only the creator's (1), not member1's.
    resp = client.get(
        f"/api/v1/activities/{act.id}/evidence",
        cookies=auth_cookies(member2),
        headers=auth_headers(),
    )
    body = resp.json()
    assert len(body) == 1
    assert body[0]["uploaded_by"] == str(owner.id)


def test_member_can_delete_own_but_not_others(client, db):
    owner = make_user(db, role="admin", status="active")
    member1 = make_user(db, auth_source="google", status="active")
    member2 = make_user(db, auth_source="google", status="active")
    act = _make_activity(db, owner, started=True)
    _enroll(db, act.id, member1.id)
    _enroll(db, act.id, member2.id)

    resp = client.post(
        f"/api/v1/activities/{act.id}/evidence",
        json={"images": [PNG]},
        cookies=auth_cookies(member1),
        headers=auth_headers(),
    )
    ev_id = resp.json()["items"][0]["id"]

    # member2 cannot delete member1's evidence.
    resp = client.delete(
        f"/api/v1/activities/{act.id}/evidence/{ev_id}",
        cookies=auth_cookies(member2),
        headers=auth_headers(),
    )
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "auth.forbidden"

    # member1 can delete their own.
    resp = client.delete(
        f"/api/v1/activities/{act.id}/evidence/{ev_id}",
        cookies=auth_cookies(member1),
        headers=auth_headers(),
    )
    assert resp.status_code == 200


def test_creator_can_delete_any_evidence(client, db):
    owner = make_user(db, role="admin", status="active")
    member = make_user(db, auth_source="google", status="active")
    act = _make_activity(db, owner, started=True)
    _enroll(db, act.id, member.id)

    resp = client.post(
        f"/api/v1/activities/{act.id}/evidence",
        json={"images": [PNG]},
        cookies=auth_cookies(member),
        headers=auth_headers(),
    )
    ev_id = resp.json()["items"][0]["id"]

    # Creator can delete the member's evidence.
    resp = client.delete(
        f"/api/v1/activities/{act.id}/evidence/{ev_id}",
        cookies=auth_cookies(owner),
        headers=auth_headers(),
    )
    assert resp.status_code == 200


def test_upload_and_delete_flow_creator(client, db):
    owner = make_user(db, role="admin", status="active")
    act = _make_activity(db, owner, started=True)

    resp = client.post(
        f"/api/v1/activities/{act.id}/evidence",
        json={"images": [PNG, PNG]},
        cookies=auth_cookies(owner),
        headers=auth_headers(),
    )
    assert resp.status_code == 200
    items = resp.json()["items"]
    assert len(items) == 2

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


def test_blocked_after_close(client, db):
    owner = make_user(db, role="admin", status="active")
    act = _make_activity(db, owner, started=True, closed=True)
    resp = client.post(
        f"/api/v1/activities/{act.id}/evidence",
        json={"images": [PNG]},
        cookies=auth_cookies(owner),
        headers=auth_headers(),
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "validation.invalid_format"


def test_evidence_stored_as_reference_and_served_via_api(client, db):
    """La imagen NO viaja como base64 en la respuesta ni en la BD: se guarda
    en el backend de almacenamiento y se sirve por la API autenticada."""
    from app.storage.service import decode_data_url

    owner = make_user(db, role="admin", status="active")
    act = _make_activity(db, owner, started=True)

    resp = client.post(
        f"/api/v1/activities/{act.id}/evidence",
        json={"images": [PNG]},
        cookies=auth_cookies(owner),
        headers=auth_headers(),
    )
    assert resp.status_code == 200
    item = resp.json()["items"][0]

    # La respuesta solo trae la referencia (URL), no el binario.
    assert item["image_url"].startswith("http://") or item["image_url"].startswith("/")
    assert not item["image_url"].startswith("data:")

    # El binario se recupera por la API autenticada y coincide con el original.
    media_id = item["image_url"].rstrip("/").split("/")[-1]
    resp = client.get(
        f"/api/v1/media/{media_id}",
        cookies=auth_cookies(owner),
        headers=auth_headers(),
    )
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("image/")
    expected = decode_data_url(PNG)[1]
    assert resp.content == expected

