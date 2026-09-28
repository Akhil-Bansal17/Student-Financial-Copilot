from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.errors import setup_exception_handlers
from app.api.v1.router import api_router

app = FastAPI(
    title=settings.APP_NAME,
    description="Backend API foundation for Student Financial Copilot",
    version="0.1.0",
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
)

# Set up CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    """
    Attach standard enterprise security headers to all HTTP responses
    to prevent clickjacking, MIME-sniffing, and cross-site scripting vulnerabilities.
    """
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    return response


# Set up centralized exception handling
setup_exception_handlers(app)

# Mount API version 1 router
app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/", tags=["Root"])
async def root():
    return {
        "name": settings.APP_NAME,
        "version": "0.1.0",
        "docs": "/docs" if settings.DEBUG else None,
        "health": f"{settings.API_V1_STR}/health",
    }
