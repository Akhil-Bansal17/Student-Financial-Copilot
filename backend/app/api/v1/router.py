from fastapi import APIRouter
from app.api.v1.endpoints import health, auth

api_router = APIRouter()

# Register core health router
api_router.include_router(health.router, tags=["Health"])

# Register authentication router
api_router.include_router(auth.router, prefix="/auth", tags=["Auth"])

# Future modules will be registered here cleanly:
# api_router.include_router(transactions.router, prefix="/transactions", tags=["Transactions"])
# api_router.include_router(budgets.router, prefix="/budgets", tags=["Budgets"])
# api_router.include_router(analytics.router, prefix="/analytics", tags=["Analytics"])
