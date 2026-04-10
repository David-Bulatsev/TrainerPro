from fastapi import APIRouter, Depends, Query

from app.core.rbac import require_permission, set_current_user
from app.services.weather import weather_service

router = APIRouter(
    prefix="/external",
    tags=["external"],
    dependencies=[Depends(set_current_user)],
)


@router.get(
    "/weather",
    dependencies=[Depends(require_permission("workouts:read"))],
)
async def get_weather(location: str = Query("Moscow", min_length=2, max_length=120)):
    return await weather_service.get_forecast(location=location)
