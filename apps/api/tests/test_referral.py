"""Unit tests for the referral / invitation code machinery (E1/E2)."""

import re
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace

from app.core.utils import generate_referral_code, is_invitation_expired


def test_referral_code_format_and_alphabet():
    code = generate_referral_code()
    # 12 chars grouped as XXXX-XXXX-XXXX over A-Z0-9 (~62 bits of entropy).
    assert re.fullmatch(r"[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}", code), code
    assert len(code) == 14


def test_referral_codes_are_unique():
    codes = {generate_referral_code() for _ in range(2000)}
    assert len(codes) == 2000


def test_invitation_expiry_logic():
    now = datetime.now(UTC)
    # Active accounts never expire (their code is a shareable referral id).
    assert (
        is_invitation_expired(
            SimpleNamespace(status="active", created_at=now - timedelta(days=365)), 30
        )
        is False
    )
    # Fresh pending invitation is valid.
    assert (
        is_invitation_expired(SimpleNamespace(status="pending", created_at=now), 30)
        is False
    )
    # Pending invitation just inside the window is still valid.
    assert (
        is_invitation_expired(
            SimpleNamespace(status="pending", created_at=now - timedelta(days=29)), 30
        )
        is False
    )
    # Pending invitation past the window has lapsed.
    assert (
        is_invitation_expired(
            SimpleNamespace(status="pending", created_at=now - timedelta(days=31)), 30
        )
        is True
    )
