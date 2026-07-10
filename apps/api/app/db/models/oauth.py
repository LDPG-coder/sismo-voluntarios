from __future__ import annotations

import uuid
from sqlalchemy import Boolean, Column, DateTime, String, Text

from app.db.models._base import Base, IdMixin, TimestampMixin


class OAuthState(Base, IdMixin):
    __tablename__ = "oauth_states"

    state = Column(String(255), unique=True, nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), nullable=False)
    return_to = Column(Text, nullable=True)
    consumed = Column(Boolean, nullable=False, default=False)


class OAuthExchangeCode(Base, IdMixin):
    __tablename__ = "oauth_exchange_codes"

    code = Column(String(255), unique=True, nullable=False, index=True)
    user_id = Column(String(36), nullable=False)
    role = Column(String(20), nullable=False)
    status = Column(String(20), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False)
    consumed = Column(Boolean, nullable=False, default=False)
