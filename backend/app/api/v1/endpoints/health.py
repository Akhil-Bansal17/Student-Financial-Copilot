from typing import Annotated
from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.schemas.health import HealthResponse
from app.core.config import settings

router = APIRouter()


@router.get(
    "/health",
    response_model=HealthResponse,
    status_code=status.HTTP_200_OK,
    summary="Health check",
    description="Returns the operational status and database readiness of the Student Financial Copilot API.",
)
def get_health(db: Annotated[Session, Depends(get_db)]) -> HealthResponse:
    try:
        db.execute(text("SELECT 1"))
        db_status = "healthy"
    except Exception:
        db_status = "unhealthy"
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={
                "status": "degraded",
                "environment": settings.APP_ENV,
                "version": "0.1.0",
                "database": db_status,
            },
        )

    return HealthResponse(
        status="ok",
        environment=settings.APP_ENV,
        version="0.1.0",
        database=db_status,
    )


@router.get(
    "/ready",
    status_code=status.HTTP_200_OK,
    summary="Readiness probe",
    description="Checks whether the application is fully initialized and ready to receive traffic.",
)
def get_readiness(db: Annotated[Session, Depends(get_db)]):
    try:
        db.execute(text("SELECT 1"))
        return {"ready": True, "database": "connected"}
    except Exception:
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={"ready": False, "database": "disconnected"},
        )
