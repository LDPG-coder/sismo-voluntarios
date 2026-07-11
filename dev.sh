#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$SCRIPT_DIR/infra"

# Project name aislado para dev, así no colisiona con el stack de
# producción (que usa el nombre "infra" del directorio). Permite tener
# dev y prod corriendo a la vez sin pisarse los containers/redes.
export COMPOSE_PROJECT_NAME=sismo-dev

usage() {
    cat <<EOF
Sismo Voluntarios — Dev Manager

Usage: ./dev.sh <command>

Environment (all optional, with defaults):
  SISMO_API_PORT (8000)  SISMO_WEB_PORT (3001)  SISMO_PG_PORT (5432)
  COMPOSE_PROFILES        e.g. "test" to also bring up the test service

Commands:
  up          Start all services (postgres, redis, api, web)
  down        Stop all services
  restart     Restart all services
  logs        Tail logs from all services
  logs-api    Tail API logs only
  logs-web    Tail web logs only
  migrate     Run alembic migrations
  migrate-make MSG  Create new migration (e.g. ./dev.sh migrate-make "add field")
  shell       Shell into API container
  db          Open psql shell
  status      Show service status
  build       Rebuild all containers
  test-api    Run API pytest suite (efímero, sin rebuild del stack)
  test-web    Run web typecheck inside the web container
  lint        Run linters (ruff + tsc)
  clean       Stop and remove volumes (DESTRUCTIVE)
EOF
}

cd "$INFRA_DIR"

API_PORT="${SISMO_API_PORT:-8000}"
WEB_PORT="${SISMO_WEB_PORT:-3001}"
PG_PORT="${SISMO_PG_PORT:-5432}"

case "${1:-help}" in
    up)
        echo "Starting services..."
        docker compose -f docker-compose.dev.yml up -d --build
        echo ""
        echo "Services:"
        echo "  API  → http://localhost:${API_PORT}/docs"
        echo "  Web  → http://localhost:${WEB_PORT}"
        echo "  DB   → localhost:${PG_PORT}"
        ;;
    down)
        docker compose -f docker-compose.dev.yml down
        ;;
    restart)
        docker compose -f docker-compose.dev.yml restart
        ;;
    logs)
        docker compose -f docker-compose.dev.yml logs -f --tail=50
        ;;
    logs-api)
        docker compose -f docker-compose.dev.yml logs -f --tail=50 api
        ;;
    logs-web)
        docker compose -f docker-compose.dev.yml logs -f --tail=50 web
        ;;
    migrate)
        echo "Running migrations..."
        docker compose -f docker-compose.dev.yml exec api alembic upgrade head
        ;;
    migrate-make)
        shift
        MSG="${1:?Usage: ./dev.sh migrate-make \"description\"}"
        docker compose -f docker-compose.dev.yml exec api alembic revision --autogenerate -m "$MSG"
        ;;
    shell)
        docker compose -f docker-compose.dev.yml exec api bash
        ;;
    db)
        docker compose -f docker-compose.dev.yml exec postgres psql -U sismo -d sismo
        ;;
    status)
        docker compose -f docker-compose.dev.yml ps
        ;;
    build)
        docker compose -f docker-compose.dev.yml build --no-cache
        ;;
    clean)
        echo "WARNING: This will delete all data volumes."
        read -p "Continue? [y/N] " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            docker compose -f docker-compose.dev.yml down -v
            echo "Done."
        fi
        ;;
    test-api)
        echo "Running API tests..."
        docker compose -f docker-compose.dev.yml --profile test run --rm --build test-api
        ;;
    test-web)
        echo "Running web typecheck..."
        docker compose -f docker-compose.dev.yml run --rm web npm run typecheck
        ;;
    lint)
        echo "Running ruff..."
        docker compose -f docker-compose.dev.yml exec api ruff check app/
        echo "Running tsc..."
        cd "$SCRIPT_DIR/apps/web" && npx tsc --noEmit
        ;;
    help|*)
        usage
        ;;
esac
