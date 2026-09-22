from fastapi import APIRouter, status
from app.schemas.health import HealthResponse
from app.core.config import settings

router = APIRouter()


@router.get(
    "/health",
    response_model=HealthResponse,
    status_code=status.HTTP_200_OK,
    summary="Health check",
    description="Returns the operational status of the Student Financial Copilot API.",
)
async def get_health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        environment=settings.APP_ENV,
        version="0.1.0",
    )
