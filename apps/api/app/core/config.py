from __future__ import annotations

import os
from functools import lru_cache
from typing import Annotated

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="SISMO_",
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    env: str = "local"
    debug: bool = False

    api_host: str = "0.0.0.0"
    api_port: int = 8000
    api_cors_origins: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: ["http://localhost:3000"]
    )
    web_origin: str = ""

    db_host: str = "localhost"
    db_port: int = 5432
    db_name: str = "sismo"
    db_user: str = "sismo"
    db_password: str = "sismo"

    importer_token: str | None = None

    # Shared secret that the SEP platform backend uses to call SISMO's
    # server-to-server login endpoint (POST /api/v1/auth/sep-login). SEP mints
    # a one-time exchange code on behalf of an authenticated SEP user; the
    # browser then carries that code to SISMO to obtain a normal session cookie.
    sep_api_token: str | None = None

    google_client_id: str | None = None
    google_client_secret: str | None = None
    google_redirect_uri: str = "http://localhost:8000/api/v1/auth/callback"
    google_oauth_scopes: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: ["openid", "email", "profile"]
    )
    oauth_exchange_ttl_seconds: int = 300

    session_secret: str | None = None
    # Short-lived access token (the signed session cookie). Kept short so a
    # stolen cookie has a small window; longevity comes from refresh tokens.
    session_max_age_seconds: int = 30 * 60
    # Revocable, rotating refresh token stored server-side in Redis.
    session_refresh_max_age_seconds: int = 30 * 24 * 60 * 60
    session_refresh_cookie_name: str = "sismo_refresh"
    cookie_domain: str | None = None
    cookie_same_site: str = "lax"

    log_level: str = "INFO"
    log_format: str = "local"

    rate_limit_public_per_min: int = 60
    rate_limit_auth_per_min: int = 30
    rate_limit_burst: int = 10
    # Strict limit for the public referral-code validation oracle so it cannot
    # be used to enumerate valid invitation codes.
    rate_limit_referral_per_min: int = 10
    # Only trust X-Forwarded-For / CF-Connecting-IP when the API is deployed
    # behind a trusted proxy that overwrites those headers (e.g. Cloudflare).
    # When False (default) the peer socket address is always used, preventing
    # clients from spoofing their rate-limit bucket via forged headers.
    rate_limit_trust_proxy: bool = False

    redis_url: str = "redis://localhost:6379/0"

    openai_api_key: str | None = None
    openai_model: str = "north-mini-code-free"
    ai_rate_limit_per_user_per_hour: int = 5000
    # A pending invitation (the user created by POST /auth/invite) is valid for
    # this many days before it must be re-issued.
    referral_expiry_days: int = 30
    ai_rate_limit_per_min: int = 600
    ai_rate_limit_burst: int = 200

    timezone_offset_hours: int = -4

    @field_validator("google_redirect_uri", mode="before")
    @classmethod
    def _strip_scheme_prefix(cls, value: object) -> object:
        if not isinstance(value, str):
            return value
        s = value.strip()
        last_sep = s.rfind("://")
        if last_sep == -1:
            return s
        prefix = s[:last_sep]
        if prefix.lower().endswith("https:"):
            return "https://" + s[last_sep + 3 :]
        if prefix.lower().endswith("http:"):
            return "http://" + s[last_sep + 3 :]
        return s

    @field_validator("api_cors_origins", mode="before")
    @classmethod
    def _split_csv(cls, value: object) -> object:
        if isinstance(value, str):
            return [item.strip() for item in value.split(",") if item.strip()]
        return value

    @field_validator("google_oauth_scopes", mode="before")
    @classmethod
    def _split_csv_scopes(cls, value: object) -> object:
        if isinstance(value, str):
            return [item.strip() for item in value.split(",") if item.strip()]
        return value

    @property
    def database_url(self) -> str:
        return (
            f"postgresql+psycopg://{self.db_user}:{self.db_password}"
            f"@{self.db_host}:{self.db_port}/{self.db_name}"
        )

    @property
    def oauth_enabled(self) -> bool:
        return bool(self.google_client_id and self.google_client_secret)


@lru_cache
def get_settings() -> Settings:
    return Settings()
