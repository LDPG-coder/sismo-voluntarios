"""Integration tests for "ceder cupo" (slot transfer) authorization rules.

External (Google) users may only cede to other external users, but may
receive a cupo from anyone (including SEP users). SEP users and admins may
cede to anyone.
"""

from uuid import uuid4

from factories import auth_cookies, auth_headers, make_user


def _create_activity(client, user, *, max_participants: int = 1000):
    cookies = auth_cookies(user)
    body = {
        "title": "Actividad ceder cupo",
        "zone": "Caracas",
        "raw_address": "Av. Libertador 123",
        "date_time": "2030-01-01T10:00:00",
        "max_participants": max_participants,
    }
    resp = client.post(
        "/api/v1/activities", json=body, cookies=cookies, headers=auth_headers()
    )
    assert resp.status_code == 200, resp.text
    return resp.json()["id"]


def _join(client, user, activity_id):
    resp = client.post(
        f"/api/v1/activities/{activity_id}/join",
        cookies=auth_cookies(user),
        headers=auth_headers(),
    )
    assert resp.status_code == 200, resp.text


def _transfer(client, user, activity_id, to_user_id):
    return client.post(
        f"/api/v1/activities/{activity_id}/transfer",
        json={"to_user_id": str(to_user_id)},
        cookies=auth_cookies(user),
        headers=auth_headers(),
    )


def test_external_can_cede_to_external(client, db):
    admin = make_user(db, role="admin", status="active")
    e1 = make_user(db, auth_source="google", status="active")
    e2 = make_user(db, auth_source="google", status="active")
    activity_id = _create_activity(client, admin)
    _join(client, e1, activity_id)
    assert _transfer(client, e1, activity_id, e2.id).status_code == 200


def test_external_cannot_cede_to_sep(client, db):
    admin = make_user(db, role="admin", status="active")
    e1 = make_user(db, auth_source="google", status="active")
    sep = make_user(db, auth_source="sep", status="active")
    activity_id = _create_activity(client, admin)
    _join(client, e1, activity_id)
    resp = _transfer(client, e1, activity_id, sep.id)
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "auth.forbidden"


def test_external_cannot_cede_to_self(client, db):
    admin = make_user(db, role="admin", status="active")
    e1 = make_user(db, auth_source="google", status="active")
    activity_id = _create_activity(client, admin)
    _join(client, e1, activity_id)
    resp = _transfer(client, e1, activity_id, e1.id)
    assert resp.status_code == 422


def test_sep_can_cede_to_anyone(client, db):
    admin = make_user(db, role="admin", status="active")
    sep1 = make_user(db, auth_source="sep", status="active")
    sep2 = make_user(db, auth_source="sep", status="active")
    sep3 = make_user(db, auth_source="sep", status="active")
    e2 = make_user(db, auth_source="google", status="active")
    activity_id = _create_activity(client, admin)
    _join(client, sep1, activity_id)
    assert _transfer(client, sep1, activity_id, sep2.id).status_code == 200
    # SEP may also cede to an external user (otro SEP cede a externo; el que
    # ya cedio no puede reinscribirse para ceder de nuevo).
    _join(client, sep3, activity_id)
    assert _transfer(client, sep3, activity_id, e2.id).status_code == 200


def test_ceded_user_cannot_rejoin(client, db):
    admin = make_user(db, role="admin", status="active")
    e1 = make_user(db, auth_source="google", status="active")
    e2 = make_user(db, auth_source="google", status="active")
    activity_id = _create_activity(client, admin)
    _join(client, e1, activity_id)
    assert _transfer(client, e1, activity_id, e2.id).status_code == 200
    # El que cedio su cupo no puede reinscribirse (el cupo vuelve a el solo
    # si el receptor lo rechaza).
    resp = client.post(
        f"/api/v1/activities/{activity_id}/join",
        cookies=auth_cookies(e1),
        headers=auth_headers(),
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "activity.already_joined"


def test_external_can_receive_from_sep(client, db):
    admin = make_user(db, role="admin", status="active")
    sep = make_user(db, auth_source="sep", status="active")
    e1 = make_user(db, auth_source="google", status="active")
    activity_id = _create_activity(client, admin)
    _join(client, sep, activity_id)
    # e1 (external) receives a cupo ceded by a SEP user -> allowed
    assert _transfer(client, sep, activity_id, e1.id).status_code == 200


def _membership_status(client, user, activity_id):
    resp = client.get(
        f"/api/v1/activities/{activity_id}/membership",
        cookies=auth_cookies(user),
        headers=auth_headers(),
    )
    assert resp.status_code == 200
    return resp.json().get("status")


def _accept(client, user, activity_id):
    return client.post(
        f"/api/v1/activities/{activity_id}/transfer/accept",
        cookies=auth_cookies(user),
        headers=auth_headers(),
    )


def _reject(client, user, activity_id):
    return client.post(
        f"/api/v1/activities/{activity_id}/transfer/reject",
        cookies=auth_cookies(user),
        headers=auth_headers(),
    )


def test_transfer_requires_accept_before_recipient_is_active(client, db):
    admin = make_user(db, role="admin", status="active")
    e1 = make_user(db, auth_source="google", status="active")
    e2 = make_user(db, auth_source="google", status="active")
    activity_id = _create_activity(client, admin)
    _join(client, e1, activity_id)
    assert _transfer(client, e1, activity_id, e2.id).status_code == 200

    # The sender gave up their spot immediately...
    assert _membership_status(client, e1, activity_id) == "ceded"
    # ...and the recipient only has a PENDING cupo until they accept.
    assert _membership_status(client, e2, activity_id) == "pending_transfer"
    # The recipient is not yet an active member.
    mem = client.get(
        f"/api/v1/activities/{activity_id}/membership",
        cookies=auth_cookies(e2),
        headers=auth_headers(),
    ).json()
    assert mem["is_member"] is False

    # Accepting activates the recipient.
    assert _accept(client, e2, activity_id).status_code == 200
    assert _membership_status(client, e2, activity_id) == "active"
    assert _membership_status(client, e1, activity_id) == "ceded"


def test_reject_transfer_restores_sender_spot(client, db):
    admin = make_user(db, role="admin", status="active")
    e1 = make_user(db, auth_source="google", status="active")
    e2 = make_user(db, auth_source="google", status="active")
    activity_id = _create_activity(client, admin)
    _join(client, e1, activity_id)
    assert _transfer(client, e1, activity_id, e2.id).status_code == 200
    assert _membership_status(client, e1, activity_id) == "ceded"

    # Rejecting returns the cupo to the sender.
    assert _reject(client, e2, activity_id).status_code == 200
    assert _membership_status(client, e1, activity_id) == "active"
    # The pending row for the recipient is gone.
    assert _membership_status(client, e2, activity_id) is None


def test_accept_transfer_only_by_recipient(client, db):
    admin = make_user(db, role="admin", status="active")
    e1 = make_user(db, auth_source="google", status="active")
    e2 = make_user(db, auth_source="google", status="active")
    e3 = make_user(db, auth_source="google", status="active")
    activity_id = _create_activity(client, admin)
    _join(client, e1, activity_id)
    assert _transfer(client, e1, activity_id, e2.id).status_code == 200
    # A third party (not the recipient) cannot accept the cupo.
    assert _accept(client, e3, activity_id).status_code == 404
    # The sender also cannot accept their own ceded cupo.
    assert _accept(client, e1, activity_id).status_code == 404
    # The actual recipient can.
    assert _accept(client, e2, activity_id).status_code == 200
