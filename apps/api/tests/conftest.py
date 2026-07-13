"""Pytest configuration for the Sismo API suite.

Runs entirely inside the `test-api` container (see infra/docker-compose.dev.yml)
where Postgres and Redis are available. We point the app at an isolated
database (`sismo_test`) and an isolated Redis DB (index 1) so the suite never
touches dev/prod data.
"""

import os
import re
import subprocess

# Isolate data: dedicated test database + redis db index.
os.environ["SISMO_DB_NAME"] = "sismo_test"
os.environ["SISMO_REDIS_URL"] = "redis://redis:6379/1"

import pytest  # noqa: E402
from sqlalchemy import create_engine, text  # noqa: E402


def _create_test_db_and_migrate() -> None:
    from app.core.config import get_settings

    settings = get_settings()
    # Connect to the default application database to be able to CREATE the
    # isolated test database.
    base_url = settings.database_url  # postgresql+psycopg://user:pass@host:port/sismo_test
    admin_url = base_url.rsplit("/", 1)[0] + "/sismo"
    admin = create_engine(admin_url)
    with admin.connect() as conn:
        conn = conn.execution_options(isolation_level="AUTOCOMMIT")
        exists = conn.execute(
            text("SELECT 1 FROM pg_database WHERE datname=:n"), {"n": "sismo_test"}
        ).scalar()
        if not exists:
            conn.execute(text("CREATE DATABASE sismo_test"))

    env = dict(os.environ)
    env["SISMO_DB_NAME"] = "sismo_test"
    subprocess.run(["alembic", "upgrade", "head"], env=env, cwd="/app", check=True)


_create_test_db_and_migrate()


@pytest.fixture(autouse=True)
def clean_db():
    """Truncate every application table between tests for isolation."""
    from app.db.base import engine
    from app.db.models._base import Base

    with engine.begin() as conn:
        tables = ", ".join(f'"{t.name}"' for t in Base.metadata.sorted_tables)
        if tables:
            conn.execute(text(f"TRUNCATE TABLE {tables} RESTART IDENTITY CASCADE"))
    yield


@pytest.fixture
def db():
    from app.db.base import SessionLocal

    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client():
    from app.main import app
    from fastapi.testclient import TestClient

    return TestClient(app)


@pytest.fixture
def settings():
    from app.core.config import get_settings

    return get_settings()
