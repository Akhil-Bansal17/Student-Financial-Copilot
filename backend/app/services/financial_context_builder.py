import datetime
from decimal import Decimal
from typing import Dict, Any, List
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.services.analytics_service import AnalyticsService
from app.services.budget_service import BudgetService
from app.services.goal_service import GoalService
from app.services.insight_service import AdvancedInsightsService


class FinancialContextBuilder:
    """
    Builds a bounded, strictly scoped, verified financial context for the AI Financial Copilot.
    Uses only authoritative deterministic services. Never fabricates data.
    """

    @staticmethod
    def build_context(db: Session, user_id: int, year: int, month: int) -> Dict[str, Any]:
        period_str = f"{year:04d}-{month:02d}"

        # 1. Authoritative All-Time Account Balances & Totals
        summary = AnalyticsService.get_summary(db, user_id)

        # 2. Authoritative Monthly Analytics & MoM Comparison
        monthly = AnalyticsService.get_monthly_analytics(db, user_id, year, month)

        # 3. Categorized Expense Breakdown
        category_spending = AnalyticsService.get_category_spending(db, user_id, year, month)

        # 4. Categorized Income Breakdown
        income_breakdown = AnalyticsService.get_income_categories(db, user_id, year, month)

        # 5. Authoritative Budgets & Utilization
        budget_summary = BudgetService.get_summary(db, user_id, year, month)

        # 6. Authoritative Savings Goals & Progress
        goal_overview = GoalService.get_overview(db, user_id)
        goals_list = GoalService.get_goals(db, user_id)

        # 7. Authoritative Deterministic Insights (Phase 6 Observations)
        insights_res = AdvancedInsightsService.generate_insights(db, user_id, year, month)

        # Determine Data Sufficiency
        has_sufficient_data = bool(
            monthly.transaction_count > 0
            or (summary.income_transaction_count + summary.expense_transaction_count) > 0
            or len(goals_list) > 0
            or (budget_summary.overall is not None)
            or len(budget_summary.category_budgets) > 0
        )

        top_categories_serialized: List[Dict[str, Any]] = [
            {
                "category": item.category,
                "amount": str(item.amount),
                "percentage": str(item.percentage) if item.percentage is not None else None,
                "transaction_count": item.transaction_count,
            }
            for item in category_spending.items[:5]  # Limit to top 5 to keep context bounded
        ]

        income_categories_serialized: List[Dict[str, Any]] = [
            {
                "category": item.category,
                "amount": str(item.amount),
                "percentage": str(item.percentage) if item.percentage is not None else None,
                "transaction_count": item.transaction_count,
            }
            for item in income_breakdown.items[:5]
        ]

        budgets_serialized: List[Dict[str, Any]] = [
            {
                "category": b.category,
                "budget_amount": str(b.budget),
                "actual_spending": str(b.spent),
                "remaining_amount": str(b.remaining),
                "utilization_percentage": str(b.utilization),
                "over_budget": b.over_budget,
            }
            for b in budget_summary.category_budgets
        ]

        overall_budget_serialized = None
        if budget_summary.overall:
            ob = budget_summary.overall
            overall_budget_serialized = {
                "budget_amount": str(ob.budget),
                "actual_spending": str(ob.spent),
                "remaining_amount": str(ob.remaining),
                "utilization_percentage": str(ob.utilization),
                "over_budget": ob.over_budget,
            }

        goals_serialized: List[Dict[str, Any]] = [
            {
                "name": g.name,
                "target_amount": str(g.target_amount),
                "current_amount": str(g.current_amount),
                "remaining_amount": str(g.remaining_amount),
                "progress_percentage": str(g.progress_percentage),
                "status": g.status,
                "target_date": str(g.target_date) if g.target_date else None,
            }
            for g in goals_list[:6]  # Limit to top 6
        ]

        deterministic_insights_serialized: List[Dict[str, Any]] = [
            {
                "type": ins.type.value,
                "priority": ins.priority.value,
                "title": ins.title,
                "description": ins.description,
                "amount": str(ins.amount) if ins.amount is not None else None,
                "percentage": str(ins.percentage) if ins.percentage is not None else None,
            }
            for ins in insights_res.insights
        ]

        # 8. Authoritative Connected Bank Accounts (Phase 9B & Phase 10)
        from app.models.account import ConnectedAccount
        from app.models.reconciliation import TransactionReconciliation
        connected_accs = (
            db.query(ConnectedAccount)
            .filter(ConnectedAccount.user_id == user_id, ConnectedAccount.status == "ACTIVE")
            .all()
        )
        total_connected_balance = sum(
            (acc.current_balance for acc in connected_accs if acc.current_balance is not None),
            Decimal("0.00"),
        )

        now = datetime.datetime.now(datetime.timezone.utc)
        latest_sync = None
        for acc in connected_accs:
            if acc.last_synced_at:
                s_dt = acc.last_synced_at if acc.last_synced_at.tzinfo else acc.last_synced_at.replace(tzinfo=datetime.timezone.utc)
                if latest_sync is None or s_dt > latest_sync:
                    latest_sync = s_dt

        is_stale = False
        sync_freshness = "Never synchronized"
        if latest_sync:
            diff_hours = (now - latest_sync).total_seconds() / 3600
            if diff_hours < 1:
                sync_freshness = "just now"
            elif diff_hours < 24:
                sync_freshness = f"{int(diff_hours)} hour(s) ago"
            else:
                sync_freshness = f"{int(diff_hours // 24)} day(s) ago"
                is_stale = True
            if diff_hours > 12:
                is_stale = True
        elif connected_accs:
            is_stale = True

        pending_reconciliations_count = (
            db.query(func.count(TransactionReconciliation.id))
            .filter(
                TransactionReconciliation.user_id == user_id,
                TransactionReconciliation.status == "PENDING_REVIEW",
            )
            .scalar()
            or 0
        )

        return {
            "period": period_str,
            "has_sufficient_data": has_sufficient_data,
            "account_summary": {
                "current_balance": str(summary.current_balance),
                "starting_balance": str(summary.starting_balance),
                "total_income": str(summary.total_income),
                "total_expenses": str(summary.total_expenses),
                "net_cash_flow": str(summary.net_cash_flow),
                "currency": summary.currency,
            },
            "connected_accounts": {
                "has_connected_bank": len(connected_accs) > 0,
                "active_accounts_count": len(connected_accs),
                "total_connected_bank_balance": str(total_connected_balance),
                "institutions": [acc.institution_name for acc in connected_accs],
                "last_synced_at": latest_sync.isoformat() if latest_sync else None,
                "is_sync_stale": is_stale,
                "sync_freshness": sync_freshness,
                "pending_reconciliations_count": pending_reconciliations_count,
            },
            "monthly_analytics": {
                "year": monthly.year,
                "month": monthly.month,
                "income": str(monthly.monthly_income),
                "expenses": str(monthly.monthly_expenses),
                "net_cash_flow": str(monthly.monthly_net_cash_flow),
                "transaction_count": monthly.transaction_count,
                "previous_month_income": str(monthly.previous_month_income) if monthly.previous_month_income else None,
                "previous_month_expenses": str(monthly.previous_month_expenses) if monthly.previous_month_expenses else None,
                "income_change_percentage": str(monthly.income_change_percentage) if monthly.income_change_percentage else None,
                "expense_change_percentage": str(monthly.expense_change_percentage) if monthly.expense_change_percentage else None,
            },
            "top_expense_categories": top_categories_serialized,
            "income_sources": income_categories_serialized,
            "overall_budget": overall_budget_serialized,
            "category_budgets": budgets_serialized,
            "goals": goals_serialized,
            "goal_overview": {
                "total_goals_count": goal_overview.total_goals_count,
                "active_goals_count": goal_overview.active_goals_count,
                "completed_goals_count": goal_overview.completed_goals_count,
                "overdue_goals_count": goal_overview.overdue_goals_count,
                "overall_progress_percentage": str(goal_overview.overall_progress_percentage),
            },
            "deterministic_observations": deterministic_insights_serialized,
        }
