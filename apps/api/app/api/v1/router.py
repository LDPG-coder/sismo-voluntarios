from fastapi import APIRouter

from app.api.v1.auth import router as auth_router
from app.api.v1.activities import router as activities_router
from app.api.v1.health import router as health_router
from app.api.v1.ai import router as ai_router
from app.api.v1.users import router as users_router

api_v1_router = APIRouter(prefix="/api/v1")
api_v1_router.include_router(health_router)
api_v1_router.include_router(auth_router)
api_v1_router.include_router(activities_router)
api_v1_router.include_router(ai_router)
api_v1_router.include_router(users_router)
