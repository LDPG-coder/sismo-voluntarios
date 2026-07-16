# ============================================================
# Sismo Voluntarios API — Production
# ============================================================
FROM python:3.12-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev gcc && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /build
COPY requirements.txt .
# BuildKit cache mount => reinstala solo si requirements.txt cambia
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --no-cache-dir --prefix=/install -r requirements.txt

FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends libpq5 curl && \
    rm -rf /var/lib/apt/lists/* && \
    groupadd -r appuser && useradd -r -g appuser appuser

COPY --from=builder /install /usr/local

WORKDIR /app
COPY app/ app/
COPY alembic/ alembic/
COPY alembic.ini .
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# El volumen de multimedia se monta en /data/media en runtime. Creamos y
# asignamos el directorio al usuario no-root ANTES de declarar USER: si el
# volumen esta vacio, Docker propaga esta propiedad/perms al inicializarlo,
# evitando PermissionError al escribir comprobantes.
RUN mkdir -p /data/media && chown -R appuser:appuser /app /data/media
USER appuser

# Entrypoint inyecta los Docker secrets como env antes de arrancar
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]

# Puerto abstracto: se puede sobreescribir con SISMO_API_PORT
ENV SISMO_API_PORT=8000
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/api/v1/health || exit 1

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${SISMO_API_PORT:-8000} --workers 4"]
