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

        # 9. Authoritative Recent Transactions & Merchant Intelligence (Phase 11)
        from app.models.transaction import Transaction
        recent_txs = (
            db.query(Transaction)
            .filter(Transaction.user_id == user_id)
            .order_by(Transaction.transaction_date.desc(), Transaction.id.desc())
            .limit(10)
            .all()
        )
        recent_transactions_serialized = [
            {
                "date": tx.transaction_date.strftime("%Y-%m-%d"),
                "type": tx.transaction_type,
                "amount": str(tx.amount),
                "category": tx.category,
                "merchant": tx.normalized_merchant or tx.merchant or tx.description,
                "source": tx.source,
                "reconciliation_status": tx.reconciliation_status,
            }
            for tx in recent_txs
        ]

        top_merchants_query = (
            db.query(
                Transaction.normalized_merchant,
                func.sum(Transaction.amount).label("total_spent"),
                func.count(Transaction.id).label("tx_count"),
            )
            .filter(
                Transaction.user_id == user_id,
                Transaction.transaction_type == "expense",
                Transaction.normalized_merchant.isnot(None),
            )
            .group_by(Transaction.normalized_merchant)
            .order_by(func.sum(Transaction.amount).desc())
            .limit(5)
            .all()
        )
        top_merchants_serialized = [
            {
                "merchant": row[0],
                "total_spent": str(row[1]),
                "transaction_count": row[2],
            }
            for row in top_merchants_query
        ]

        # 10. Authoritative Recurring Expenses & Subscription Intelligence (Phase 12)
        from app.services.recurring_expense_service import RecurringExpenseService
        recurring_summary = RecurringExpenseService.get_recurring_summary(db, user_id)
        all_recurring_items = RecurringExpenseService.get_recurring_expenses(db, user_id)

        subscriptions_serialized = [
            {
                "merchant": item.merchant,
                "amount": str(item.latest_amount),
                "frequency": item.frequency,
                "category": item.category,
                "next_expected_date": item.next_expected_date.strftime("%Y-%m-%d"),
                "status": item.status,
            }
            for item in all_recurring_items
            if item.recurring_type == "SUBSCRIPTION" and item.status in {"ACTIVE", "OVERDUE_EXPECTED"}
        ]

        recurring_expenses_serialized = [
            {
                "merchant": item.merchant,
                "type": item.recurring_type,
                "amount": str(item.latest_amount),
                "frequency": item.frequency,
                "category": item.category,
                "next_expected_date": item.next_expected_date.strftime("%Y-%m-%d"),
                "status": item.status,
            }
            for item in all_recurring_items
            if item.recurring_type != "SUBSCRIPTION" and item.status in {"ACTIVE", "OVERDUE_EXPECTED"}
        ]

        upcoming_payments_serialized = [
            {
                "merchant": item.merchant,
                "amount": str(item.latest_amount),
                "date": item.next_expected_date.strftime("%Y-%m-%d"),
                "type": item.recurring_type,
            }
            for item in recurring_summary.get("upcoming_payments", [])
        ]

        price_changes_serialized = [
            {
                "merchant": item.merchant,
                "previous_amount": str(item.previous_amount) if item.previous_amount else None,
                "latest_amount": str(item.latest_amount),
                "change": str(item.amount_change) if item.amount_change else None,
                "change_percentage": str(item.amount_change_percentage) if item.amount_change_percentage else None,
            }
            for item in recurring_summary.get("recently_changed", [])
        ]

        overdue_serialized = [
            {
                "merchant": item.merchant,
                "amount": str(item.latest_amount),
                "expected_date": item.next_expected_date.strftime("%Y-%m-%d"),
                "status": item.status,
            }
            for item in recurring_summary.get("needs_attention", [])
        ]

        has_sufficient_data = bool(
            has_sufficient_data
            or recurring_summary["total_detected_count"] > 0
        )

        # 11. Authoritative Cash Flow Forecast (Phase 13)
        from app.services.cash_flow_forecast_service import CashFlowForecastService
        forecast_res = CashFlowForecastService.compute_cash_flow_forecast(db, user_id, days=30)
        forecast_serialized = {
            "forecast_horizon_days": forecast_res.forecast_days,
            "starting_balance": str(forecast_res.starting_balance),
            "projected_balance": str(forecast_res.projected_balance),
            "expected_income": str(forecast_res.expected_income),
            "expected_recurring_commitments": str(forecast_res.expected_recurring_expenses),
            "estimated_discretionary_spending": str(forecast_res.estimated_discretionary_spending),
            "projected_total_outflow": str(forecast_res.projected_total_outflow),
            "net_projected_cash_flow": str(forecast_res.net_cash_flow),
            "minimum_projected_balance": str(forecast_res.minimum_projected_balance),
            "minimum_balance_date": (
                forecast_res.minimum_balance_date.isoformat() if forecast_res.minimum_balance_date else None
            ),
            "minimum_balance_threshold": str(forecast_res.minimum_balance_threshold),
            "is_negative_projected": forecast_res.is_negative_projected,
            "negative_balance_date": (
                forecast_res.negative_balance_date.isoformat() if forecast_res.negative_balance_date else None
            ),
            "is_low_balance_projected": forecast_res.is_low_balance_projected,
            "low_balance_date": (
                forecast_res.low_balance_date.isoformat() if forecast_res.low_balance_date else None
            ),
            "data_sufficiency": forecast_res.data_sufficiency,
            "confidence": forecast_res.confidence,
            "bank_data_freshness": forecast_res.bank_data_freshness,
            "upcoming_events": [
                {
                    "date": ev.date.isoformat(),
                    "name": ev.name,
                    "amount": str(ev.amount),
                    "is_inflow": ev.is_inflow,
                    "type": ev.type,
                }
                for ev in forecast_res.timeline[:10]
            ],
            "warnings": forecast_res.warnings,
        }

        # 12. Authoritative Financial Health & Smart Actions (Phase 14)
        from app.services.financial_health_service import FinancialHealthService
        health_res = FinancialHealthService.evaluate_financial_health(
            db=db,
            user_id=user_id,
            year=year,
            month=month,
        )
        health_serialized = {
            "overall_status_label": health_res.overview.overall_status_label,
            "overall_summary": health_res.overview.overall_summary,
            "data_sufficiency": health_res.data_sufficiency,
            "primary_attention_dimension": health_res.overview.primary_attention_dimension,
            "dimensions": {
                dim_k: {
                    "name": dim_v.name,
                    "status": dim_v.status,
                    "label": dim_v.label,
                    "summary": dim_v.summary,
                    "is_positive": dim_v.is_positive,
                    "is_attention_required": dim_v.is_attention_required,
                }
                for dim_k, dim_v in health_res.dimensions.items()
            },
            "top_actions": [
                {
                    "title": act.title,
                    "priority": act.priority.value,
                    "description": act.description,
                    "reason": act.reason,
                    "recommended_next_step": act.recommended_next_step,
                }
                for act in health_res.actions[:5]
            ],
            "positive_signals": [
                {
                    "title": sig.title,
                    "dimension": sig.dimension,
                    "description": sig.description,
                }
                for sig in health_res.positive_signals[:5]
            ],
            "bank_freshness": {
                "has_connected_bank": health_res.bank_freshness.has_connected_bank,
                "is_stale": health_res.bank_freshness.is_stale,
                "freshness_description": health_res.bank_freshness.freshness_description,
            },
        }

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
            "recent_transactions": recent_transactions_serialized,
            "top_merchants": top_merchants_serialized,
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
            "recurring_intelligence": {
                "total_monthly_recurring_spend": str(recurring_summary["total_monthly_recurring_spend"]),
                "subscription_count": recurring_summary["subscription_count"],
                "recurring_expense_count": recurring_summary["recurring_expense_count"],
                "fixed_recurring_spend": str(recurring_summary["fixed_recurring_spend"]),
                "variable_recurring_spend": str(recurring_summary["variable_recurring_spend"]),
                "subscriptions": subscriptions_serialized,
                "recurring_expenses": recurring_expenses_serialized,
                "upcoming_payments": upcoming_payments_serialized,
                "recent_price_changes": price_changes_serialized,
                "overdue_payments": overdue_serialized,
            },
            "cash_flow_forecast": forecast_serialized,
            "financial_health": health_serialized,
            "deterministic_observations": deterministic_insights_serialized,
        }
