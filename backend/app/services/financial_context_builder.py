from decimal import Decimal
from typing import Dict, Any, List
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
