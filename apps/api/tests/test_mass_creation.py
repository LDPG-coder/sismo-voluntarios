"""Tests de creación masiva de actividades.

Verifica que el sistema soporte crear múltiples actividades seguidas
y que cada tipo (proponer, oficial, realizada) genere los campos correctos.
"""
from __future__ import annotations

import pytest
from httpx import AsyncClient


pytestmark = pytest.mark.anyio


# ── Helpers ──────────────────────────────────────────────────────────


async def _create_activity(client: AsyncClient, cookies: dict, **overrides) -> dict:
    """Crea una actividad y retorna la respuesta."""
    payload = {
        "title": "Test activity",
        "description": "Descripcion de prueba",
        "zone": "Caracas",
        "raw_address": "Av. Principal",
        "date_time": "2026-12-01T10:00:00Z",
        "contact_info": "@test",
        **overrides,
    }
    res = await client.post(
        "/api/v1/activities",
        json=payload,
        cookies=cookies,
    )
    return res


# ── Tests: creación masiva ──────────────────────────────────────────


async def test_mass_create_10_activities(client: AsyncClient, auth_cookies: dict):
    """Crear 10 actividades seguidas sin errores."""
    for i in range(10):
        res = await _create_activity(
            client,
            auth_cookies,
            title=f"Actividad masiva #{i+1}",
        )
        assert res.status_code == 200, f"Error en actividad #{i+1}: {res.text}"
        data = res.json()
        assert data["title"] == f"Actividad masiva #{i+1}"


async def test_create_proponer_activity(client: AsyncClient, auth_cookies: dict):
    """Crear una actividad tipo 'proponer' (pública, sin campos externos)."""
    res = await _create_activity(
        client,
        auth_cookies,
        title="Proponer test",
    )
    assert res.status_code == 200
    data = res.json()
    assert data["title"] == "Proponer test"
    assert data.get("is_external_official") is not True
    assert data.get("is_private") is not True


async def test_create_oficial_activity(client: AsyncClient, auth_cookies: dict):
    """Crear una actividad tipo 'oficial' (externa, con campos de empresa)."""
    res = await _create_activity(
        client,
        auth_cookies,
        title="Oficial test",
        is_external_official=True,
        external_beneficiary="Empresa XYZ",
        external_supervisor="Juan Perez",
        external_supervisor_email="juan@xyz.com",
        external_assigned_hours=10.0,
        external_relevant_data="Datos relevantes",
    )
    assert res.status_code == 200
    data = res.json()
    assert data["title"] == "Oficial test"
    assert data.get("is_external_official") is True


async def test_create_realizada_activity_is_private(client: AsyncClient, auth_cookies: dict):
    """Crear una actividad ya realizada debe ser privada."""
    res = await _create_activity(
        client,
        auth_cookies,
        title="Realizada test",
        date_time="2025-01-01T10:00:00Z",  # fecha pasada
    )
    assert res.status_code == 200
    data = res.json()
    assert data["title"] == "Realizada test"
    # El backend marca como privada si la fecha ya paso
    assert data.get("is_private") is True


async def test_create_activity_missing_required_fields(client: AsyncClient, auth_cookies: dict):
    """Crear actividad sin campos obligatorios debe fallar."""
    res = await client.post(
        "/api/v1/activities",
        json={"title": "Sin campos"},
        cookies=auth_cookies,
    )
    assert res.status_code in (400, 422)


async def test_create_activity_each_type_has_correct_fields(client: AsyncClient, auth_cookies: dict):
    """Verificar que cada tipo de actividad genera los campos correctos."""
    # Proponer: sin campos externos
    res1 = await _create_activity(client, auth_cookies, title="Type proponer")
    data1 = res1.json()
    assert data1.get("external_beneficiary") is None
    assert data1.get("external_supervisor") is None

    # Oficial: con campos externos
    res2 = await _create_activity(
        client,
        auth_cookies,
        title="Type oficial",
        is_external_official=True,
        external_beneficiary="Beneficiario",
        external_supervisor="Supervisor",
        external_supervisor_email="sup@test.com",
        external_assigned_hours=5.0,
    )
    data2 = res2.json()
    assert data2.get("is_external_official") is True

    # Realizada: privada
    res3 = await _create_activity(
        client,
        auth_cookies,
        title="Type realizada",
        date_time="2024-06-01T10:00:00Z",
    )
    data3 = res3.json()
    assert data3.get("is_private") is True


async def test_create_many不同类型(client: AsyncClient, auth_cookies: dict):
    """Crear 5 actividades de cada tipo (15 total) y verificar que todas se crean."""
    count = {"proponer": 0, "oficial": 0, "realizada": 0}

    for i in range(5):
        # Proponer
        res = await _create_activity(client, auth_cookies, title=f"Proponer {i}")
        if res.status_code == 200:
            count["proponer"] += 1

        # Oficial
        res = await _create_activity(
            client,
            auth_cookies,
            title=f"Oficial {i}",
            is_external_official=True,
            external_beneficiary="B",
            external_supervisor="S",
            external_supervisor_email="s@t.com",
            external_assigned_hours=1.0,
        )
        if res.status_code == 200:
            count["oficial"] += 1

        # Realizada
        res = await _create_activity(
            client,
            auth_cookies,
            title=f"Realizada {i}",
            date_time="2023-01-01T10:00:00Z",
        )
        if res.status_code == 200:
            count["realizada"] += 1

    assert count["proponer"] == 5, f"Proponer: {count['proponer']}/5"
    assert count["oficial"] == 5, f"Oficial: {count['oficial']}/5"
    assert count["realizada"] == 5, f"Realizada: {count['realizada']}/5"
