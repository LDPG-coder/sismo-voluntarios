#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$SCRIPT_DIR/infra"

usage() {
    cat <<EOF
Sismo Voluntarios — Dev Manager

Usage: ./dev.sh <command>

Commands:
  up          Start all services (postgres, api, web)
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
  clean       Stop and remove volumes (DESTRUCTIVE)
  test-api    Run API tests
  lint        Run linters (ruff + tsc)
EOF
}

cd "$INFRA_DIR"

case "${1:-help}" in
    up)
        echo "Starting services..."
        docker compose -f docker-compose.dev.yml up -d --build
        echo ""
        echo "Services:"
        echo "  API  → http://localhost:8000/docs"
        echo "  Web  → http://localhost:3001"
        echo "  DB   → localhost:5432"
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
        docker compose -f docker-compose.dev.yml exec api python -m pytest tests/ -v
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
