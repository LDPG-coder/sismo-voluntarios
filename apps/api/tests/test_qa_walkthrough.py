"""Recorrido QA integral de actividades (multi-usuario).

Cubre de forma end-to-end lo que el usuario recorre en la app:
  - Creación de actividades (pública futura, privada pasada, interna, externa oficial)
  - Edición (solo creador, toggle interno, `is_private` no se recalcula al editar)
  - Cambios de estado (cancelar / realizada-archivar; flujo de validación externa)
  - Orden de los listados (descubrimiento y enrolados por fecha; "mis" por creación)
  - Filtros de descubrimiento (propias, ya-inscritas, pasadas, demo)
  - Público / privado (ocultamiento en feed/zonas, 404 para terceros y admin)
  - Unirse / salir / ceder cupo (cupo agotado, reglas SEP vs externo)
  - Asistencia y PII de inscritos (solo creador marca; email solo para privilegiados)
  - Constancia externa (portal solo en estado no-activo con asistencia)

Se autentica como usuarios arbitrarios usando las factories (sin OAuth), igual
que el resto de la suite.
"""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone

from app.db.constants import MVP_TENANT_ID
from app.db.enums import ActivityStatus
from app.db.models import Activity, ActivityMember

from factories import auth_cookies, auth_headers, make_user

# Tiny 1x1 PNG data URL, válido para subir como comprobante.
_PNG = (
    "data:image/png;base64,"
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC"
)


def _now():
    return datetime.now(timezone.utc)


def _iso(dt):
    return dt.strftime("%Y-%m-%dT%H:%M:%S")


def _create_activity(client, user, **overrides):
    base = {
        "title": "Actividad QA",
        "zone": "Caracas",
        "raw_address": "Av. Libertador 123",
        "date_time": "2030-01-01T10:00:00",
    }
    base.update(overrides)
    resp = client.post(
        "/api/v1/activities",
        json=base,
        cookies=auth_cookies(user),
        headers=auth_headers(),
    )
    assert resp.status_code == 200, resp.text
    return resp.json()


def _create_external_started(client, user, **overrides):
    """Actividad externa oficial ya iniciada pero no finalizada: activa, no
    privada (finished_at = end_time en el futuro) y lista para subir evidencias."""
    base = {
        "title": "Voluntariado externo QA",
        "zone": "Caracas",
        "raw_address": "Av. Libertador 456",
        "date_time": _iso(_now() - timedelta(days=1)),
        "end_time": _iso(_now() + timedelta(days=1)),
        "external_beneficiary": "Institucion X",
        "external_supervisor": "Supervisor Y",
        "external_supervisor_email": "sup@example.com",
        "external_assigned_hours": 5,
        "external_relevant_data": "Contexto y logros de la actividad.",
    }
    base.update(overrides)
    return _create_activity(client, user, **base)


def _join(client, user, activity_id):
    resp = client.post(
        f"/api/v1/activities/{activity_id}/join",
        cookies=auth_cookies(user),
        headers=auth_headers(),
    )
    assert resp.status_code == 200, resp.text
    return resp


def _upload_evidence(client, user, activity_id):
    resp = client.post(
        f"/api/v1/activities/{activity_id}/evidence",
        json={"images": [_PNG]},
        cookies=auth_cookies(user),
        headers=auth_headers(),
    )
    assert resp.status_code == 200, resp.text
    return resp.json()


def _delete_activity(client, user, activity_id, *, archive=False):
    # TestClient.delete no acepta `json=`/`content=`, asi que usamos
    # `request("DELETE", ...)` que si reenvia el cuerpo JSON.
    body = {"archive": True} if archive else {}
    resp = client.request(
        "DELETE",
        f"/api/v1/activities/{activity_id}",
        json=body,
        cookies=auth_cookies(user),
        headers=auth_headers(),
    )
    return resp


# -- Creación --------------------------------------------------------------


def test_creacion_futura_es_publica_y_activa(client, db):
    owner = make_user(db, auth_source="google", status="active")
    data = _create_activity(client, owner)
    assert data["is_private"] is False
    assert data["status"] == ActivityStatus.active.value


def test_creacion_pasada_es_privada(client, db):
    owner = make_user(db, auth_source="google", status="active")
    data = _create_activity(
        client, owner, date_time=_iso(_now() - timedelta(days=3))
    )
    assert data["is_private"] is True
    assert data["status"] == ActivityStatus.active.value


def test_creacion_interna_limpia_campos_externos(client, db):
    owner = make_user(db, auth_source="sep", status="active")
    data = _create_activity(
        client,
        owner,
        is_internal=True,
        external_beneficiary="Institucion X",
        external_assigned_hours=3,
    )
    assert data["is_internal"] is True
    assert data["is_external_official"] is False
    # Los campos externos se descartan al ser interna.
    a = db.get(Activity, __import__("uuid").UUID(data["id"]))
    assert a.external_beneficiary is None
    assert a.external_assigned_hours is None


def test_creacion_externa_oficial(client, db):
    owner = make_user(db, auth_source="sep", status="active")
    data = _create_activity(
        client,
        owner,
        external_beneficiary="Institucion X",
        external_assigned_hours=4,
        external_relevant_data="Datos",
    )
    assert data["is_external_official"] is True


# -- Edición ---------------------------------------------------------------


def test_edicion_solo_creador(client, db):
    owner = make_user(db, auth_source="google", status="active")
    other = make_user(db, auth_source="google", status="active")
    admin = make_user(db, role="admin", status="active")
    data = _create_activity(client, owner)
    # Otro voluntario no puede editar.
    resp = client.patch(
        f"/api/v1/activities/{data['id']}",
        json={"title": "Hack"},
        cookies=auth_cookies(other),
        headers=auth_headers(),
    )
    assert resp.status_code == 403
    # Un admin tampoco (no es el creador).
    resp = client.patch(
        f"/api/v1/activities/{data['id']}",
        json={"title": "Hack"},
        cookies=auth_cookies(admin),
        headers=auth_headers(),
    )
    assert resp.status_code == 403
    # El creador sí.
    resp = client.patch(
        f"/api/v1/activities/{data['id']}",
        json={"title": "Renombrada"},
        cookies=auth_cookies(owner),
        headers=auth_headers(),
    )
    assert resp.status_code == 200
    assert resp.json()["title"] == "Renombrada"


def test_edicion_toggle_interno_limpia_externo(client, db):
    owner = make_user(db, auth_source="sep", status="active")
    data = _create_activity(
        client, owner, external_beneficiary="Institucion X", external_assigned_hours=4
    )
    resp = client.patch(
        f"/api/v1/activities/{data['id']}",
        json={"is_internal": True},
        cookies=auth_cookies(owner),
        headers=auth_headers(),
    )
    assert resp.status_code == 200
    assert resp.json()["is_internal"] is True
    assert resp.json()["is_external_official"] is False
    a = db.get(Activity, __import__("uuid").UUID(data["id"]))
    assert a.external_beneficiary is None


def test_edicion_no_recalcula_is_private(client, db):
    """Al crear, `is_private` se fija segun la fecha. Al editar la fecha despues,
    NO se recalcula: una actividad publica sigue publica aunque mueva la fecha al
    pasado. Lo verificamos y documentamos (comportamiento actual del backend)."""
    owner = make_user(db, auth_source="google", status="active")
    data = _create_activity(client, owner)  # futura -> publica
    assert data["is_private"] is False
    resp = client.patch(
        f"/api/v1/activities/{data['id']}",
        json={"date_time": _iso(_now() - timedelta(days=2))},
        cookies=auth_cookies(owner),
        headers=auth_headers(),
    )
    assert resp.status_code == 200
    assert resp.json()["is_private"] is False  # se mantiene publica


# -- Estados: cancelar / realizada ----------------------------------------


def test_estado_cancelar(client, db):
    owner = make_user(db, auth_source="google", status="active")
    data = _create_activity(client, owner)
    resp = _delete_activity(client, owner, data["id"])
    assert resp.status_code == 200
    assert resp.json()["status"] == ActivityStatus.cancelled.value
    # No creador no puede cancelar.
    other = make_user(db, auth_source="google", status="active")
    resp = _delete_activity(client, other, data["id"])
    assert resp.status_code == 403


def test_estado_realizada_archivar(client, db):
    owner = make_user(db, auth_source="google", status="active")
    data = _create_activity(client, owner)
    resp = _delete_activity(client, owner, data["id"], archive=True)
    assert resp.status_code == 200
    assert resp.json()["status"] == ActivityStatus.archived.value


def test_cancelar_notifica_inscritos(client, db):
    owner = make_user(db, auth_source="sep", status="active")
    member = make_user(db, auth_source="google", status="active")
    data = _create_activity(client, owner)
    _join(client, member, data["id"])
    _delete_activity(client, owner, data["id"])
    resp = client.get(
        "/api/v1/activities/notifications",
        cookies=auth_cookies(member),
        headers=auth_headers(),
    )
    assert resp.status_code == 200
    types = [n["type"] for n in resp.json()]
    assert "activity_cancelled" in types


# -- Estados: validación de actividad externa -----------------------------


def test_validacion_externa_flujo_completo(client, db):
    owner = make_user(db, auth_source="sep", status="active")
    admin = make_user(db, role="admin", status="active")
    data = _create_external_started(client, owner)
    # Sin evidencia aun: rechaza el envio.
    resp = client.post(
        f"/api/v1/activities/{data['id']}/submit-validation",
        cookies=auth_cookies(owner),
        headers=auth_headers(),
    )
    assert resp.status_code != 200
    # Subimos comprobante y enviamos a validacion.
    _upload_evidence(client, owner, data["id"])
    resp = client.post(
        f"/api/v1/activities/{data['id']}/submit-validation",
        cookies=auth_cookies(owner),
        headers=auth_headers(),
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == ActivityStatus.pending_validation.value
    # Solo el creador puede enviar; un tercero no.
    third = make_user(db, auth_source="google", status="active")
    resp = client.post(
        f"/api/v1/activities/{data['id']}/submit-validation",
        cookies=auth_cookies(third),
        headers=auth_headers(),
    )
    assert resp.status_code == 403
    # Admin valida.
    resp = client.post(
        f"/api/v1/activities/{data['id']}/validate",
        json={"notes": "OK"},
        cookies=auth_cookies(admin),
        headers=auth_headers(),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == ActivityStatus.validated.value
    assert body["validated_by"] == str(admin.id)
    assert body["validated_at"] is not None


def test_validacion_externa_rechazo_devuelve_a_active(client, db):
    owner = make_user(db, auth_source="sep", status="active")
    admin = make_user(db, role="admin", status="active")
    data = _create_external_started(client, owner)
    _upload_evidence(client, owner, data["id"])
    client.post(
        f"/api/v1/activities/{data['id']}/submit-validation",
        cookies=auth_cookies(owner),
        headers=auth_headers(),
    )
    # Rechazo sin motivo -> error.
    resp = client.post(
        f"/api/v1/activities/{data['id']}/reject-validation",
        json={"notes": ""},
        cookies=auth_cookies(admin),
        headers=auth_headers(),
    )
    assert resp.status_code != 200
    # Rechazo con motivo -> vuelve a active.
    resp = client.post(
        f"/api/v1/activities/{data['id']}/reject-validation",
        json={"notes": "Falta informacion"},
        cookies=auth_cookies(admin),
        headers=auth_headers(),
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == ActivityStatus.active.value


def test_validacion_externa_solo_admin_valida(client, db):
    owner = make_user(db, auth_source="sep", status="active")
    not_admin = make_user(db, auth_source="google", status="active")
    data = _create_external_started(client, owner)
    _upload_evidence(client, owner, data["id"])
    client.post(
        f"/api/v1/activities/{data['id']}/submit-validation",
        cookies=auth_cookies(owner),
        headers=auth_headers(),
    )
    resp = client.post(
        f"/api/v1/activities/{data['id']}/validate",
        json={"notes": "OK"},
        cookies=auth_cookies(not_admin),
        headers=auth_headers(),
    )
    assert resp.status_code == 403


# -- Orden de los listados ------------------------------------------------


def test_orden_descubrimiento_fecha_desc(client, db):
    owner = make_user(db, auth_source="sep", status="active")
    viewer = make_user(db, auth_source="google", status="active")
    t1 = _iso(_now() + timedelta(days=1))
    t2 = _iso(_now() + timedelta(days=3))
    t3 = _iso(_now() + timedelta(days=2))
    id1 = _create_activity(client, owner, title="A1", date_time=t1)["id"]
    id2 = _create_activity(client, owner, title="A2", date_time=t2)["id"]
    id3 = _create_activity(client, owner, title="A3", date_time=t3)["id"]
    resp = client.get("/api/v1/activities", cookies=auth_cookies(viewer), headers=auth_headers())
    ids = [a["id"] for a in resp.json()]
    assert ids.index(id2) < ids.index(id3) < ids.index(id1)


def test_orden_mis_actividades_creacion_desc(client, db):
    owner = make_user(db, auth_source="google", status="active")
    a = _create_activity(client, owner, title="Primera")
    b = _create_activity(client, owner, title="Segunda")
    resp = client.get("/api/v1/activities/mine", cookies=auth_cookies(owner), headers=auth_headers())
    ids = [x["id"] for x in resp.json()]
    assert ids.index(b["id"]) < ids.index(a["id"])


def test_orden_enrolados_fecha_desc(client, db):
    owner = make_user(db, auth_source="sep", status="active")
    viewer = make_user(db, auth_source="google", status="active")
    t1 = _iso(_now() + timedelta(days=1))
    t2 = _iso(_now() + timedelta(days=5))
    id1 = _create_activity(client, owner, title="E1", date_time=t1)["id"]
    id2 = _create_activity(client, owner, title="E2", date_time=t2)["id"]
    _join(client, viewer, id1)
    _join(client, viewer, id2)
    resp = client.get("/api/v1/activities/enrolled", cookies=auth_cookies(viewer), headers=auth_headers())
    ids = [a["id"] for a in resp.json()]
    assert ids.index(id2) < ids.index(id1)


# -- Descubrimiento: filtros ----------------------------------------------


def test_descubrimiento_filtro_zona(client, db):
    owner = make_user(db, auth_source="sep", status="active")
    viewer = make_user(db, auth_source="google", status="active")
    _create_activity(client, owner, zone="Caracas")
    _create_activity(client, owner, zone="Valencia")
    resp = client.get(
        "/api/v1/activities", params={"zone": "Valencia"},
        cookies=auth_cookies(viewer), headers=auth_headers(),
    )
    zones = {a["zone"] for a in resp.json()}
    assert zones == {"Valencia"}


def test_descubrimiento_demo_oculta_por_defecto(client, db):
    owner = make_user(db, auth_source="sep", status="active")
    viewer = make_user(db, auth_source="google", status="active")
    act = Activity(
        title="Demo QA",
        zone="Caracas",
        raw_address="Calle demo",
        date_time=_now() + timedelta(days=1),
        creator_id=owner.id,
        status=ActivityStatus.active.value,
        is_demo=True,
        tenant_id=MVP_TENANT_ID,
    )
    db.add(act)
    db.commit()
    db.refresh(act)
    # Por defecto no aparece.
    resp = client.get("/api/v1/activities", cookies=auth_cookies(viewer), headers=auth_headers())
    assert str(act.id) not in [a["id"] for a in resp.json()]
    # Con include_demo si.
    resp = client.get(
        "/api/v1/activities", params={"include_demo": True},
        cookies=auth_cookies(viewer), headers=auth_headers(),
    )
    assert str(act.id) in [a["id"] for a in resp.json()]


def test_zonas_espejan_descubrimiento(client, db):
    owner = make_user(db, auth_source="sep", status="active")
    viewer = make_user(db, auth_source="google", status="active")
    _create_activity(client, owner, zone="Caracas")
    _create_activity(client, owner, zone="Caracas")
    resp = client.get("/api/v1/activities/zones", cookies=auth_cookies(viewer), headers=auth_headers())
    zones = {z["name"]: z["count"] for z in resp.json()}
    assert zones.get("Caracas") == 2
    # No cuenta las propias del viewer.
    _create_activity(client, viewer, zone="Caracas")
    resp = client.get("/api/v1/activities/zones", cookies=auth_cookies(viewer), headers=auth_headers())
    zones = {z["name"]: z["count"] for z in resp.json()}
    assert zones.get("Caracas") == 2


# -- Público / privado -----------------------------------------------------


def test_privada_oculta_y_404_para_terceros_y_admin(client, db):
    owner = make_user(db, auth_source="google", status="active")
    other = make_user(db, auth_source="google", status="active")
    admin = make_user(db, role="admin", status="active")
    data = _create_activity(
        client, owner, date_time=_iso(_now() - timedelta(days=3))
    )
    assert data["is_private"] is True
    for viewer in (owner, other, admin):
        resp = client.get("/api/v1/activities", cookies=auth_cookies(viewer), headers=auth_headers())
        assert data["id"] not in [a["id"] for a in resp.json()]
    # El creador la ve; terceros y admin reciben 404.
    assert client.get(
        f"/api/v1/activities/{data['id']}", cookies=auth_cookies(owner), headers=auth_headers()
    ).status_code == 200
    assert client.get(
        f"/api/v1/activities/{data['id']}", cookies=auth_cookies(other), headers=auth_headers()
    ).status_code == 404
    assert client.get(
        f"/api/v1/activities/{data['id']}", cookies=auth_cookies(admin), headers=auth_headers()
    ).status_code == 404
    # Membership y attendees tambien 404 para no-creadores.
    assert client.get(
        f"/api/v1/activities/{data['id']}/membership", cookies=auth_cookies(other), headers=auth_headers()
    ).status_code == 404
    assert client.get(
        f"/api/v1/activities/{data['id']}/attendees", cookies=auth_cookies(admin), headers=auth_headers()
    ).status_code == 404


def test_privada_rechaza_inscripcion(client, db):
    owner = make_user(db, auth_source="google", status="active")
    other = make_user(db, auth_source="google", status="active")
    data = _create_activity(
        client, owner, date_time=_iso(_now() - timedelta(days=3))
    )
    resp = client.post(
        f"/api/v1/activities/{data['id']}/join",
        cookies=auth_cookies(other),
        headers=auth_headers(),
    )
    assert resp.status_code == 404


# -- Unirse / salir / ceder -----------------------------------------------


def test_cupo_agotado(client, db):
    owner = make_user(db, auth_source="sep", status="active")
    u1 = make_user(db, auth_source="google", status="active")
    u2 = make_user(db, auth_source="google", status="active")
    data = _create_activity(client, owner, max_participants=1)
    _join(client, u1, data["id"])
    resp = client.post(
        f"/api/v1/activities/{data['id']}/join",
        cookies=auth_cookies(u2),
        headers=auth_headers(),
    )
    assert resp.status_code == 409  # activity.full


def test_salir_y_reingresar(client, db):
    owner = make_user(db, auth_source="sep", status="active")
    u1 = make_user(db, auth_source="google", status="active")
    data = _create_activity(client, owner)
    _join(client, u1, data["id"])
    resp = client.post(
        f"/api/v1/activities/{data['id']}/leave",
        cookies=auth_cookies(u1),
        headers=auth_headers(),
    )
    assert resp.status_code == 200
    # Puede reinscribirse.
    resp = client.post(
        f"/api/v1/activities/{data['id']}/join",
        cookies=auth_cookies(u1),
        headers=auth_headers(),
    )
    assert resp.status_code == 200


def test_ceder_sep_a_cualquiera(client, db):
    owner = make_user(db, auth_source="google", status="active")
    sep_member = make_user(db, auth_source="sep", status="active")
    target_sep = make_user(db, auth_source="sep", status="active")
    target_ext = make_user(db, auth_source="google", status="active")
    # Un miembro SEP puede ceder su cupo a otro SEP...
    data = _create_activity(client, owner)
    _join(client, sep_member, data["id"])
    resp = client.post(
        f"/api/v1/activities/{data['id']}/transfer",
        json={"to_user_id": str(target_sep.id)},
        cookies=auth_cookies(sep_member),
        headers=auth_headers(),
    )
    assert resp.status_code == 200
    # ...y tambien a un externo (SEP puede ceder a cualquiera).
    data2 = _create_activity(client, owner)
    _join(client, sep_member, data2["id"])
    resp = client.post(
        f"/api/v1/activities/{data2['id']}/transfer",
        json={"to_user_id": str(target_ext.id)},
        cookies=auth_cookies(sep_member),
        headers=auth_headers(),
    )
    assert resp.status_code == 200


def test_ceder_externo_solo_a_externo(client, db):
    owner = make_user(db, auth_source="google", status="active")
    member = make_user(db, auth_source="google", status="active")
    target_sep = make_user(db, auth_source="sep", status="active")
    target_ext = make_user(db, auth_source="google", status="active")
    data = _create_activity(client, owner)
    _join(client, member, data["id"])
    # Externo cede a SEP -> prohibido.
    resp = client.post(
        f"/api/v1/activities/{data['id']}/transfer",
        json={"to_user_id": str(target_sep.id)},
        cookies=auth_cookies(member),
        headers=auth_headers(),
    )
    assert resp.status_code == 403
    # Externo cede a externo -> permitido.
    resp = client.post(
        f"/api/v1/activities/{data['id']}/transfer",
        json={"to_user_id": str(target_ext.id)},
        cookies=auth_cookies(member),
        headers=auth_headers(),
    )
    assert resp.status_code == 200
    # El receptor aun no esta inscrito activamente: su cupo queda pendiente
    # hasta que lo acepte.
    resp = client.get(
        f"/api/v1/activities/{data['id']}/membership",
        cookies=auth_cookies(target_ext), headers=auth_headers(),
    )
    assert resp.json()["status"] == "pending_transfer"
    # Al aceptarlo, aparece en sus inscritas.
    resp = client.post(
        f"/api/v1/activities/{data['id']}/transfer/accept",
        cookies=auth_cookies(target_ext), headers=auth_headers(),
    )
    assert resp.status_code == 200
    resp = client.get(
        "/api/v1/activities/enrolled", cookies=auth_cookies(target_ext), headers=auth_headers()
    )
    assert data["id"] in [a["id"] for a in resp.json()]


def test_ceder_no_a_si_mismo(client, db):
    owner = make_user(db, auth_source="google", status="active")
    member = make_user(db, auth_source="google", status="active")
    data = _create_activity(client, owner)
    _join(client, member, data["id"])
    resp = client.post(
        f"/api/v1/activities/{data['id']}/transfer",
        json={"to_user_id": str(member.id)},
        cookies=auth_cookies(member),
        headers=auth_headers(),
    )
    assert resp.status_code != 200


# -- Asistencia y PII ------------------------------------------------------


def test_asistencia_solo_creador_marca(client, db):
    owner = make_user(db, auth_source="sep", status="active")
    member = make_user(db, auth_source="google", status="active")
    data = _create_external_started(client, owner)
    _join(client, member, data["id"])
    # Un miembro no puede marcar asistencia.
    resp = client.post(
        f"/api/v1/activities/{data['id']}/attendees/{member.id}/attended",
        json={"attended": True},
        cookies=auth_cookies(member),
        headers=auth_headers(),
    )
    assert resp.status_code == 403
    # El creador si.
    resp = client.post(
        f"/api/v1/activities/{data['id']}/attendees/{member.id}/attended",
        json={"attended": True},
        cookies=auth_cookies(owner),
        headers=auth_headers(),
    )
    assert resp.status_code == 200


def test_inscritos_pii_email_segun_rol(client, db):
    owner = make_user(db, auth_source="sep", status="active")
    member = make_user(db, auth_source="google", status="active")
    ext_outsider = make_user(db, auth_source="google", status="active")
    admin = make_user(db, role="admin", status="active")
    data = _create_external_started(client, owner)
    _join(client, member, data["id"])
    # Creador (sep) ve email.
    resp = client.get(
        f"/api/v1/activities/{data['id']}/attendees",
        cookies=auth_cookies(owner), headers=auth_headers(),
    )
    assert resp.status_code == 200
    assert any(x["email"] for x in resp.json())
    # Admin ve email.
    resp = client.get(
        f"/api/v1/activities/{data['id']}/attendees",
        cookies=auth_cookies(admin), headers=auth_headers(),
    )
    assert any(x["email"] for x in resp.json())
    # Miembro externo ve la lista pero sin email.
    resp = client.get(
        f"/api/v1/activities/{data['id']}/attendees",
        cookies=auth_cookies(member), headers=auth_headers(),
    )
    assert resp.status_code == 200
    assert all(x["email"] is None for x in resp.json())
    # Externo ajeno (no creador, no miembro) ahora si puede ver la lista de
    # inscritos (nombre + foto), pero sin emails.
    resp = client.get(
        f"/api/v1/activities/{data['id']}/attendees",
        cookies=auth_cookies(ext_outsider), headers=auth_headers(),
    )
    assert resp.status_code == 200
    assert all(x["email"] is None for x in resp.json())


# -- Constancia externa ----------------------------------------------------


def test_constancia_externa_portal_y_requisitos(client, db):
    owner = make_user(db, auth_source="sep", status="active")
    member = make_user(db, auth_source="google", status="active")
    data = _create_external_started(client, owner)
    _join(client, member, data["id"])
    # Mientras esta activa (sin enviar a validacion) subir constancia falla.
    resp = client.post(
        f"/api/v1/activities/{data['id']}/external-certificate",
        json={"certificate": "data:application/pdf;base64,JVBERi0xLjQK"},
        cookies=auth_cookies(owner),
        headers=auth_headers(),
    )
    assert resp.status_code != 200
    # Marcamos asistencia y enviamos a validacion.
    client.post(
        f"/api/v1/activities/{data['id']}/attendees/{member.id}/attended",
        json={"attended": True},
        cookies=auth_cookies(owner),
        headers=auth_headers(),
    )
    _upload_evidence(client, owner, data["id"])
    client.post(
        f"/api/v1/activities/{data['id']}/submit-validation",
        cookies=auth_cookies(owner),
        headers=auth_headers(),
    )
    # Ahora si se puede subir la constancia.
    resp = client.post(
        f"/api/v1/activities/{data['id']}/external-certificate",
        json={"certificate": "data:application/pdf;base64,JVBERi0xLjQK"},
        cookies=auth_cookies(owner),
        headers=auth_headers(),
    )
    assert resp.status_code == 200
    assert resp.json()["external_certificate"]
    # Solo el creador puede gestionarla.
    resp = client.post(
        f"/api/v1/activities/{data['id']}/external-certificate",
        json={"certificate": "data:application/pdf;base64,JVBERi0xLjQK"},
        cookies=auth_cookies(member),
        headers=auth_headers(),
    )
    assert resp.status_code == 403


def test_google_login_nunca_devuelve_json(client):
    """El endpoint GET /auth/login es navegado directamente por el navegador
    (enlace 'Continuar con Google'). Ante cualquier fallo (p.ej. OAuth no
    configurado) debe REDIRIGIR a la pagina de login del web con un parametro de
    error, nunca devolver un JSON de error crudo al navegador."""
    resp = client.get("/api/v1/auth/login", follow_redirects=False)
    assert resp.status_code == 302, resp.text
    assert "location" in resp.headers
    assert "application/json" not in resp.headers.get("content-type", "")
    if not resp.headers["location"].startswith("https://accounts.google.com"):
        # OAuth deshabilitado: debe redirigir a la pagina de login del web.
        assert "/login?error=" in resp.headers["location"]
