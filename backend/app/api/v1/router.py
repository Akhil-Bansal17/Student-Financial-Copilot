from fastapi import APIRouter
from app.api.v1.endpoints import health, auth, profile, transactions, analytics

api_router = APIRouter()

# Register core health router
api_router.include_router(health.router, tags=["Health"])

# Register authentication router
api_router.include_router(auth.router, prefix="/auth", tags=["Auth"])

# Register financial profile router
api_router.include_router(profile.router, prefix="/profile", tags=["Profile"])

# Register transactions router
api_router.include_router(transactions.router, prefix="/transactions", tags=["Transactions"])

# Register analytics router
api_router.include_router(analytics.router, prefix="/analytics", tags=["Analytics"])

