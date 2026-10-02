from fastapi import APIRouter
from app.api.v1.endpoints import (
    health,
    auth,
    profile,
    transactions,
    analytics,
    budgets,
    goals,
    insights,
    copilot,
    accounts,
    reconciliation,
    merchant_preferences,
    recurring,
)

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

# Register budgets router
api_router.include_router(budgets.router, prefix="/budgets", tags=["Budgets"])

# Register goals router
api_router.include_router(goals.router, prefix="/goals", tags=["Goals"])

# Register insights router
api_router.include_router(insights.router, prefix="/insights", tags=["Insights"])

# Register AI Copilot router
api_router.include_router(copilot.router, prefix="/ai", tags=["AI Copilot"])

# Register connected financial accounts router (Phase 9A)
api_router.include_router(accounts.router, prefix="/accounts", tags=["Accounts"])

# Register transaction reconciliation & bank sync router (Phase 10)
api_router.include_router(reconciliation.router, prefix="/reconciliation", tags=["Reconciliation"])

# Register merchant category preferences router (Phase 11)
api_router.include_router(merchant_preferences.router, prefix="/merchant-preferences", tags=["Merchant Preferences"])

# Register recurring expenses & subscription intelligence router (Phase 12)
api_router.include_router(recurring.router, tags=["Recurring Expenses & Subscriptions"])

