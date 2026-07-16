from fastapi import APIRouter

from app.api.v1.auth import router as auth_router
from app.api.v1.activities import router as activities_router
from app.api.v1.health import router as health_router
from app.api.v1.ai import router as ai_router
from app.api.v1.users import router as users_router
from app.api.v1.partner import router as partner_router
from app.api.v1.media import router as media_router
from app.api.v1.admin_dashboard import router as admin_dashboard_router

# [INCUBADORA] Seccion desactivada temporalmente: no debe exponerse en prod.
# Reactivar descomentando el import y el include_router de abajo.
# from app.api.v1.incubator import router as incubator_router

api_v1_router = APIRouter(prefix="/api/v1")
api_v1_router.include_router(health_router)
api_v1_router.include_router(auth_router)
api_v1_router.include_router(activities_router)
api_v1_router.include_router(ai_router)
api_v1_router.include_router(users_router)
api_v1_router.include_router(partner_router)
api_v1_router.include_router(media_router)
api_v1_router.include_router(admin_dashboard_router)
# [INCUBADORA] Router desactivado (ver nota arriba).
# api_v1_router.include_router(incubator_router)
