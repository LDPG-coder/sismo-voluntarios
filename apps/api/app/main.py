from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_v1_router
from app.core.config import get_settings
from app.core.errors import register_error_handlers
from app.core.logging import configure_logging, get_logger
from app.middleware.csrf import CsrfMiddleware
from app.middleware.rate_limit import RateLimitMiddleware
from app.services.demo_cleanup import start_demo_cleanup_scheduler

configure_logging()
log = get_logger("app.main")

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Limpieza programada de las publicaciones de ejemplo de la induccion.
    stop_cleanup = start_demo_cleanup_scheduler()
    try:
        yield
    finally:
        stop_cleanup()


app = FastAPI(
    title="Sismo Voluntarios API",
    version="0.1.0",
    debug=settings.debug,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.api_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(RateLimitMiddleware)
app.add_middleware(CsrfMiddleware)

register_error_handlers(app)
app.include_router(api_v1_router)


@app.middleware("http")
async def _request_log_middleware(request, call_next):  # type: ignore[no-untyped-def]
    response = await call_next(request)
    log.info("http.request", method=request.method, path=request.url.path, status=response.status_code)
    return response


@app.get("/")
def root() -> dict[str, str]:
    return {"service": "sismo-voluntarios-api", "version": "0.1.0", "docs": "/docs"}
