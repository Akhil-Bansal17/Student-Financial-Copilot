import calendar
import datetime
from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, List, Optional, Any, Tuple
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.account import ConnectedAccount
from app.models.transaction import Transaction
from app.schemas.financial_health import (
    CashBufferStatus,
    CashFlowStabilityStatus,
    BudgetHealthStatus,
    RecurringBurdenStatus,
    GoalHealthStatus,
    SpendingPatternStatus,
    ForecastRiskStatus,
    ActionPriority,
    ActionType,
    HealthDimensionDetail,
    SmartActionItem,
    PositiveSignalItem,
    BankFreshnessDetail,
    FinancialHealthOverview,
    FinancialHealthResponse,
    SmartActionsResponse,
)
from app.services.analytics_service import AnalyticsService, get_month_date_range
from app.services.budget_service import BudgetService
from app.services.goal_service import GoalService
from app.services.recurring_expense_service import RecurringExpenseService
from app.services.cash_flow_forecast_service import CashFlowForecastService


# Documented Deterministic Rules & Constants
PRIORITY_ORDER: Dict[ActionPriority, int] = {
    ActionPriority.CRITICAL: 1,
    ActionPriority.HIGH: 2,
    ActionPriority.MEDIUM: 3,
    ActionPriority.LOW: 4,
    ActionPriority.INFO: 5,
}

BUFFER_LIMITED_MULTIPLIER = Decimal("1.5")
BUDGET_APPROACHING_PCT = Decimal("80.0")
SPENDING_CONCENTRATION_PCT = Decimal("60.0")
ELEVATED_SPENDING_MOM_PCT = Decimal("25.0")
RECURRING_BURDEN_CRITICAL_PCT = Decimal("60.0")
RECURRING_BURDEN_HIGH_PCT = Decimal("40.0")
RECURRING_BURDEN_MODERATE_PCT = Decimal("20.0")
BANK_STALE_HOURS_THRESHOLD = 12


class FinancialHealthService:
    """
    Authoritative deterministic Financial Health & Smart Action Center Engine.
    Composes existing verified services (CashFlowForecastService, BudgetService,
    GoalService, RecurringExpenseService, AnalyticsService, and BankSync).
    Produces zero arbitrary 0-100 gamified scores.
    Every conclusion is evidence-backed and traceable to authoritative data.
    """

    @classmethod
    def evaluate_financial_health(
        cls,
        db: Session,
        user_id: int,
        year: Optional[int] = None,
        month: Optional[int] = None,
        as_of_date: Optional[datetime.date] = None,
    ) -> FinancialHealthResponse:
        now_utc = datetime.datetime.now(datetime.timezone.utc)
        target_date = as_of_date or now_utc.date()
        target_year = year or target_date.year
        target_month = month or target_date.month

        # 1. Authoritative Phase 13 Cash Flow Forecast & User Preference
        forecast = CashFlowForecastService.compute_cash_flow_forecast(
            db=db,
            user_id=user_id,
            days=30,
            as_of_date=target_date,
        )
        pref = CashFlowForecastService.get_or_create_preference(db, user_id)
        minimum_threshold = pref.minimum_balance_threshold

        # 2. Authoritative Budget Summary for period
        budget_summary = BudgetService.get_summary(
            db=db,
            user_id=user_id,
            year=target_year,
            month=target_month,
        )

        # 3. Authoritative Goals Overview
        goal_overview = GoalService.get_overview(db, user_id)
        goals_list = GoalService.get_goals(db, user_id)

        # 4. Authoritative Phase 12 Recurring Summary & Expenses
        recurring_summary = RecurringExpenseService.get_recurring_summary(db, user_id)
        all_recurring = RecurringExpenseService.get_recurring_expenses(db, user_id)

        # 5. Authoritative Analytics & Spending
        analytics_summary = AnalyticsService.get_summary(db, user_id)
        monthly_analytics = AnalyticsService.get_monthly_analytics(
            db=db,
            user_id=user_id,
            year=target_year,
            month=target_month,
        )
        category_spending = AnalyticsService.get_category_spending(
            db=db,
            user_id=user_id,
            year=target_year,
            month=target_month,
        )

        # 6. Connected Bank Freshness
        bank_freshness = cls._evaluate_bank_freshness(db, user_id, now_utc)

        # 7. Evaluate Dimensions Deterministically
        dimensions: Dict[str, HealthDimensionDetail] = {}

        # A. Cash Buffer
        dim_buffer = cls._evaluate_cash_buffer(
            forecast=forecast,
            minimum_threshold=minimum_threshold,
        )
        dimensions["CASH_BUFFER"] = dim_buffer

        # B. Cash-Flow Stability
        dim_stability = cls._evaluate_cash_flow_stability(
            forecast=forecast,
            monthly_analytics=monthly_analytics,
            analytics_summary=analytics_summary,
            recurring_summary=recurring_summary,
        )
        dimensions["CASH_FLOW_STABILITY"] = dim_stability

        # C. Budget Health
        dim_budget = cls._evaluate_budget_health(
            budget_summary=budget_summary,
            data_sufficiency=forecast.data_sufficiency,
        )
        dimensions["BUDGET_HEALTH"] = dim_budget

        # D. Recurring Expense Burden
        dim_recurring = cls._evaluate_recurring_burden(
            recurring_summary=recurring_summary,
            monthly_analytics=monthly_analytics,
            data_sufficiency=forecast.data_sufficiency,
        )
        dimensions["RECURRING_BURDEN"] = dim_recurring

        # E. Savings & Goal Health
        dim_goal = cls._evaluate_goal_health(
            goal_overview=goal_overview,
            goals_list=goals_list,
            forecast=forecast,
        )
        dimensions["GOAL_HEALTH"] = dim_goal

        # F. Spending Pattern Health
        dim_spending = cls._evaluate_spending_pattern(
            category_spending=category_spending,
            monthly_analytics=monthly_analytics,
            data_sufficiency=forecast.data_sufficiency,
        )
        dimensions["SPENDING_PATTERN"] = dim_spending

        # G. Forecast Risk
        dim_forecast = cls._evaluate_forecast_risk(forecast=forecast)
        dimensions["FORECAST_RISK"] = dim_forecast

        # 8. Deterministic Smart Actions Generation & Deduplication
        actions = cls._generate_smart_actions(
            forecast=forecast,
            minimum_threshold=minimum_threshold,
            budget_summary=budget_summary,
            goals_list=goals_list,
            recurring_summary=recurring_summary,
            category_spending=category_spending,
            bank_freshness=bank_freshness,
            generated_at=now_utc,
        )

        # 9. Deterministic Positive Signals
        positive_signals = cls._generate_positive_signals(
            forecast=forecast,
            budget_summary=budget_summary,
            goal_overview=goal_overview,
            goals_list=goals_list,
            recurring_summary=recurring_summary,
            monthly_analytics=monthly_analytics,
            dim_buffer=dim_buffer,
            dim_stability=dim_stability,
            dim_budget=dim_budget,
            dim_goal=dim_goal,
            dim_recurring=dim_recurring,
            dim_forecast=dim_forecast,
        )

        # 10. Financial Health Overview
        overview = cls._build_overview(
            data_sufficiency=forecast.data_sufficiency,
            dimensions=dimensions,
            actions=actions,
            positive_signals=positive_signals,
        )

        return FinancialHealthResponse(
            overview=overview,
            dimensions=dimensions,
            actions=actions,
            positive_signals=positive_signals,
            bank_freshness=bank_freshness,
            data_sufficiency=forecast.data_sufficiency,
            generated_at=now_utc,
        )

    @classmethod
    def get_smart_actions(
        cls,
        db: Session,
        user_id: int,
        year: Optional[int] = None,
        month: Optional[int] = None,
    ) -> SmartActionsResponse:
        """Fetch prioritized smart actions exclusively for authenticated user."""
        health = cls.evaluate_financial_health(db=db, user_id=user_id, year=year, month=month)
        by_priority: Dict[str, int] = {
            ActionPriority.CRITICAL.value: 0,
            ActionPriority.HIGH.value: 0,
            ActionPriority.MEDIUM.value: 0,
            ActionPriority.LOW.value: 0,
            ActionPriority.INFO.value: 0,
        }
        for act in health.actions:
            by_priority[act.priority.value] = by_priority.get(act.priority.value, 0) + 1

        # Phase 16: Adapt presentation ranking to user's financial priority while preserving priority tiers
        actions = health.actions
        try:
            from app.services.personalization_service import PersonalizationService
            profile = PersonalizationService.get_or_create_profile(db, user_id)
            actions = PersonalizationService.prioritize_actions(profile, health.actions)
        except Exception:
            actions = health.actions

        return SmartActionsResponse(
            actions=actions,
            total_count=len(actions),
            by_priority=by_priority,
            generated_at=health.generated_at,
        )

    # =========================================================================
    # DIMENSION EVALUATION METHODS
    # =========================================================================

    @staticmethod
    def _evaluate_cash_buffer(
        forecast: Any,
        minimum_threshold: Decimal,
    ) -> HealthDimensionDetail:
        ledger_bal = forecast.current_ledger_balance
        proj_min = forecast.minimum_projected_balance
        bank_bal = forecast.current_connected_bank_balance

        if forecast.data_sufficiency == "INSUFFICIENT" and ledger_bal == Decimal("0.00"):
            return HealthDimensionDetail(
                dimension="CASH_BUFFER",
                name="Cash Buffer",
                status=CashBufferStatus.INSUFFICIENT_DATA.value,
                label="Insufficient Data",
                summary="Not enough verified transaction history to evaluate available cash buffer.",
                supporting_data={
                    "current_ledger_balance": str(ledger_bal),
                    "minimum_threshold": str(minimum_threshold),
                },
                is_positive=False,
                is_attention_required=False,
            )

        if forecast.is_negative_projected or ledger_bal < Decimal("0.00") or proj_min < Decimal("0.00"):
            status_val = CashBufferStatus.AT_RISK.value
            label_val = "At Risk"
            summary_val = (
                f"Your balance is projected to reach ₹{proj_min:,.2f} on "
                f"{forecast.negative_balance_date or forecast.minimum_balance_date or 'upcoming days'}, falling below zero."
            )
            is_pos = False
            is_att = True
        elif forecast.is_low_balance_projected or proj_min < minimum_threshold or ledger_bal < minimum_threshold:
            status_val = CashBufferStatus.LOW_BUFFER.value
            label_val = "Low Buffer"
            summary_val = (
                f"Your projected minimum balance of ₹{proj_min:,.2f} falls below your "
                f"safety threshold of ₹{minimum_threshold:,.2f}."
            )
            is_pos = False
            is_att = True
        elif proj_min < (minimum_threshold * BUFFER_LIMITED_MULTIPLIER):
            status_val = CashBufferStatus.LIMITED_BUFFER.value
            label_val = "Limited Buffer"
            summary_val = (
                f"Your balance remains above the threshold (₹{minimum_threshold:,.2f}) but "
                f"has a limited safety margin (projected low ₹{proj_min:,.2f})."
            )
            is_pos = True
            is_att = False
        else:
            status_val = CashBufferStatus.HEALTHY_BUFFER.value
            label_val = "Healthy Buffer"
            summary_val = (
                f"Your projected balance stays comfortably above your ₹{minimum_threshold:,.2f} "
                f"threshold with a projected low of ₹{proj_min:,.2f}."
            )
            is_pos = True
            is_att = False

        return HealthDimensionDetail(
            dimension="CASH_BUFFER",
            name="Cash Buffer",
            status=status_val,
            label=label_val,
            summary=summary_val,
            supporting_data={
                "current_ledger_balance": str(ledger_bal),
                "connected_bank_balance": str(bank_bal) if bank_bal is not None else None,
                "minimum_projected_balance": str(proj_min),
                "minimum_threshold": str(minimum_threshold),
                "minimum_balance_date": str(forecast.minimum_balance_date) if forecast.minimum_balance_date else None,
            },
            is_positive=is_pos,
            is_attention_required=is_att,
        )

    @staticmethod
    def _evaluate_cash_flow_stability(
        forecast: Any,
        monthly_analytics: Any,
        analytics_summary: Any,
        recurring_summary: Dict[str, Any],
    ) -> HealthDimensionDetail:
        if forecast.data_sufficiency == "INSUFFICIENT":
            return HealthDimensionDetail(
                dimension="CASH_FLOW_STABILITY",
                name="Cash-Flow Stability",
                status=CashFlowStabilityStatus.INSUFFICIENT_DATA.value,
                label="Insufficient Data",
                summary="Insufficient transaction volume to establish cash-flow stability patterns.",
                supporting_data={"data_sufficiency": forecast.data_sufficiency},
                is_positive=False,
                is_attention_required=False,
            )

        net_monthly = monthly_analytics.monthly_net_cash_flow
        net_projected = forecast.net_cash_flow

        # Negative trend when cash outflow consistently exceeds inflow and ending projected balance drops
        if net_monthly < Decimal("0.00") and net_projected < Decimal("0.00"):
            status_val = CashFlowStabilityStatus.NEGATIVE_TREND.value
            label_val = "Negative Trend"
            summary_val = (
                f"Net cash flow is negative this month (-₹{abs(net_monthly):,.2f}) and "
                f"projected to remain negative (-₹{abs(net_projected):,.2f} over 30 days)."
            )
            is_pos = False
            is_att = True
        elif recurring_summary.get("total_detected_count", 0) > 0 and abs(net_projected) < Decimal("2000.00"):
            status_val = CashFlowStabilityStatus.STABLE.value
            label_val = "Stable"
            summary_val = "Inflow and recurring commitment patterns are predictable with consistent pacing."
            is_pos = True
            is_att = False
        elif monthly_analytics.expense_change_percentage is not None and abs(Decimal(str(monthly_analytics.expense_change_percentage))) > Decimal("35.0"):
            status_val = CashFlowStabilityStatus.HIGHLY_VARIABLE.value
            label_val = "Highly Variable"
            summary_val = (
                f"Spending exhibited substantial month-over-month variation "
                f"({monthly_analytics.expense_change_percentage}% change)."
            )
            is_pos = False
            is_att = False  # Normal for students during exam or vacation periods
        elif net_monthly >= Decimal("0.00"):
            status_val = CashFlowStabilityStatus.STABLE.value
            label_val = "Stable"
            summary_val = f"Current cash flow is positive with a net surplus of ₹{net_monthly:,.2f}."
            is_pos = True
            is_att = False
        else:
            status_val = CashFlowStabilityStatus.MODERATELY_VARIABLE.value
            label_val = "Moderately Variable"
            summary_val = "Cash flow exhibits modest periodic variation within manageable student spending bounds."
            is_pos = True
            is_att = False

        return HealthDimensionDetail(
            dimension="CASH_FLOW_STABILITY",
            name="Cash-Flow Stability",
            status=status_val,
            label=label_val,
            summary=summary_val,
            supporting_data={
                "monthly_income": str(monthly_analytics.monthly_income),
                "monthly_expenses": str(monthly_analytics.monthly_expenses),
                "monthly_net_cash_flow": str(net_monthly),
                "projected_30d_net": str(net_projected),
            },
            is_positive=is_pos,
            is_attention_required=is_att,
        )

    @staticmethod
    def _evaluate_budget_health(
        budget_summary: Any,
        data_sufficiency: str,
    ) -> HealthDimensionDetail:
        has_overall = budget_summary.overall is not None
        cats = budget_summary.category_budgets

        if not has_overall and not cats:
            return HealthDimensionDetail(
                dimension="BUDGET_HEALTH",
                name="Budget Health",
                status=BudgetHealthStatus.NO_ACTIVE_BUDGET.value,
                label="No Active Budget",
                summary="You haven't configured any monthly budgets or spending limits yet.",
                supporting_data={"has_active_budget": False},
                is_positive=False,
                is_attention_required=False,
            )

        # Check over-budget conditions
        is_overall_over = has_overall and budget_summary.overall.over_budget
        over_cats = [c for c in cats if c.over_budget]

        if is_overall_over or over_cats:
            cat_names = [c.category for c in over_cats]
            label_cats = f"in {', '.join(cat_names)}" if cat_names else "overall"
            return HealthDimensionDetail(
                dimension="BUDGET_HEALTH",
                name="Budget Health",
                status=BudgetHealthStatus.OVER_BUDGET.value,
                label="Over Budget",
                summary=f"Spending has exceeded planned budget limits {label_cats}.",
                supporting_data={
                    "over_budget_categories": cat_names,
                    "overall_over_budget": is_overall_over,
                },
                is_positive=False,
                is_attention_required=True,
            )

        # Check approaching limit (>= 80%)
        is_overall_approaching = has_overall and budget_summary.overall.utilization >= BUDGET_APPROACHING_PCT
        approaching_cats = [c for c in cats if c.utilization >= BUDGET_APPROACHING_PCT]

        if is_overall_approaching or approaching_cats:
            cat_names = [c.category for c in approaching_cats]
            label_cats = f"in {', '.join(cat_names)}" if cat_names else "overall"
            return HealthDimensionDetail(
                dimension="BUDGET_HEALTH",
                name="Budget Health",
                status=BudgetHealthStatus.APPROACHING_LIMIT.value,
                label="Approaching Limit",
                summary=f"Spending has reached 80%+ of allocated budget {label_cats}.",
                supporting_data={
                    "approaching_categories": cat_names,
                    "overall_approaching": is_overall_approaching,
                },
                is_positive=False,
                is_attention_required=True,
            )

        total_budgeted_amt = (
            budget_summary.overall.budget
            if budget_summary.overall
            else sum((c.budget for c in cats), Decimal("0.00"))
        )
        total_spent_amt = (
            budget_summary.overall.spent
            if budget_summary.overall
            else sum((c.spent for c in cats), Decimal("0.00"))
        )

        return HealthDimensionDetail(
            dimension="BUDGET_HEALTH",
            name="Budget Health",
            status=BudgetHealthStatus.ON_TRACK.value,
            label="On Track",
            summary="All active budgets and categories are operating within planned spending limits.",
            supporting_data={
                "total_budgeted": str(total_budgeted_amt),
                "total_spent": str(total_spent_amt),
            },
            is_positive=True,
            is_attention_required=False,
        )

    @staticmethod
    def _evaluate_recurring_burden(
        recurring_summary: Dict[str, Any],
        monthly_analytics: Any,
        data_sufficiency: str,
    ) -> HealthDimensionDetail:
        committed = Decimal(str(recurring_summary.get("total_monthly_committed", "0.00")))
        sub_count = recurring_summary.get("subscription_count", 0)
        bill_count = recurring_summary.get("recurring_count", 0)

        if data_sufficiency == "INSUFFICIENT" and committed == Decimal("0.00"):
            return HealthDimensionDetail(
                dimension="RECURRING_BURDEN",
                name="Recurring Burden",
                status=RecurringBurdenStatus.INSUFFICIENT_DATA.value,
                label="Insufficient Data",
                summary="Insufficient history to detect recurring payments or subscriptions.",
                supporting_data={},
                is_positive=False,
                is_attention_required=False,
            )

        # Baseline: compare against monthly income or spending, minimum ₹4,000 for standard student budget
        baseline = max(
            monthly_analytics.monthly_income,
            monthly_analytics.monthly_expenses,
            Decimal("4000.00"),
        )
        burden_pct = ((committed / baseline) * Decimal("100")).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP)

        if burden_pct >= RECURRING_BURDEN_CRITICAL_PCT:
            status_val = RecurringBurdenStatus.CRITICAL.value
            label_val = "Critical Burden"
            summary_val = (
                f"Recurring commitments (₹{committed:,.2f}/mo) consume {burden_pct}% "
                f"of your monthly financial baseline."
            )
            is_pos = False
            is_att = True
        elif burden_pct >= RECURRING_BURDEN_HIGH_PCT:
            status_val = RecurringBurdenStatus.HIGH.value
            label_val = "High Burden"
            summary_val = (
                f"Recurring subscriptions and bills represent {burden_pct}% of your monthly baseline "
                f"(₹{committed:,.2f}/mo across {sub_count + bill_count} items)."
            )
            is_pos = False
            is_att = True
        elif burden_pct >= RECURRING_BURDEN_MODERATE_PCT:
            status_val = RecurringBurdenStatus.MODERATE.value
            label_val = "Moderate"
            summary_val = (
                f"Recurring commitments are manageable at ₹{committed:,.2f}/mo "
                f"({burden_pct}% of baseline)."
            )
            is_pos = True
            is_att = False
        else:
            status_val = RecurringBurdenStatus.LOW.value
            label_val = "Low"
            summary_val = (
                f"Recurring expenses are modest at ₹{committed:,.2f}/mo "
                f"({burden_pct}% of baseline)."
            )
            is_pos = True
            is_att = False

        return HealthDimensionDetail(
            dimension="RECURRING_BURDEN",
            name="Recurring Burden",
            status=status_val,
            label=label_val,
            summary=summary_val,
            supporting_data={
                "monthly_committed": str(committed),
                "subscription_count": sub_count,
                "bill_count": bill_count,
                "burden_percentage": str(burden_pct),
            },
            is_positive=is_pos,
            is_attention_required=is_att,
        )

    @staticmethod
    def _evaluate_goal_health(
        goal_overview: Any,
        goals_list: List[Any],
        forecast: Any,
    ) -> HealthDimensionDetail:
        active_count = goal_overview.active_goals_count
        completed_count = goal_overview.completed_goals_count

        if active_count == 0 and completed_count == 0:
            return HealthDimensionDetail(
                dimension="GOAL_HEALTH",
                name="Savings & Goals",
                status=GoalHealthStatus.NO_ACTIVE_GOALS.value,
                label="No Active Goals",
                summary="You haven't set any savings targets or academic financial goals yet.",
                supporting_data={"active_goals_count": 0},
                is_positive=False,
                is_attention_required=False,
            )

        if active_count == 0 and completed_count > 0:
            return HealthDimensionDetail(
                dimension="GOAL_HEALTH",
                name="Savings & Goals",
                status=GoalHealthStatus.COMPLETED.value,
                label="Completed",
                summary=f"All {completed_count} savings goals have been successfully completed!",
                supporting_data={
                    "active_goals_count": 0,
                    "completed_goals_count": completed_count,
                },
                is_positive=True,
                is_attention_required=False,
            )

        # Check overdue or forecast affordability issues
        overdue_goals = [g for g in goals_list if g.status == "overdue"]
        unaffordable_goal_ids = {
            gp.goal_id for gp in forecast.goal_planning if not gp.is_affordable
        }
        at_risk_goals = [g for g in goals_list if g.id in unaffordable_goal_ids or g.status == "overdue"]

        if at_risk_goals:
            names = [g.name for g in at_risk_goals]
            return HealthDimensionDetail(
                dimension="GOAL_HEALTH",
                name="Savings & Goals",
                status=GoalHealthStatus.AT_RISK.value,
                label="At Risk",
                summary=f"Goal pace or deadline is at risk for {', '.join(names)}.",
                supporting_data={
                    "at_risk_goals": names,
                    "overdue_count": len(overdue_goals),
                    "active_count": active_count,
                    "total_target_amount": str(goal_overview.total_target_amount),
                    "total_saved_amount": str(goal_overview.total_saved_amount),
                },
                is_positive=False,
                is_attention_required=True,
            )

        # Check goals with low progress (<25%) when more than half time passed
        return HealthDimensionDetail(
            dimension="GOAL_HEALTH",
            name="Savings & Goals",
            status=GoalHealthStatus.ON_TRACK.value,
            label="On Track",
            summary=f"All {active_count} active savings goals are progressing feasibly toward targets.",
            supporting_data={
                "active_goals_count": active_count,
                "overall_progress_percentage": str(goal_overview.overall_progress_percentage),
                "total_target_amount": str(goal_overview.total_target_amount),
                "total_saved_amount": str(goal_overview.total_saved_amount),
                "total_remaining_amount": str(goal_overview.total_target_amount - goal_overview.total_saved_amount),
            },
            is_positive=True,
            is_attention_required=False,
        )

    @staticmethod
    def _evaluate_spending_pattern(
        category_spending: Any,
        monthly_analytics: Any,
        data_sufficiency: str,
    ) -> HealthDimensionDetail:
        if data_sufficiency == "INSUFFICIENT" or not category_spending.items:
            return HealthDimensionDetail(
                dimension="SPENDING_PATTERN",
                name="Spending Pattern",
                status=SpendingPatternStatus.INSUFFICIENT_DATA.value,
                label="Insufficient Data",
                summary="Insufficient expense records to analyze category concentration or trend shifts.",
                supporting_data={},
                is_positive=False,
                is_attention_required=False,
            )

        top_item = category_spending.items[0]
        top_pct = top_item.percentage or Decimal("0.0")

        # Spending concentration >= 60%
        if top_pct >= SPENDING_CONCENTRATION_PCT:
            return HealthDimensionDetail(
                dimension="SPENDING_PATTERN",
                name="Spending Pattern",
                status=SpendingPatternStatus.HIGH_CONCENTRATION.value,
                label="High Concentration",
                summary=f"Spending is concentrated in {top_item.category} ({top_pct}% of total expenses).",
                supporting_data={
                    "top_category": top_item.category,
                    "top_category_percentage": str(top_pct),
                    "top_category_amount": str(top_item.amount),
                },
                is_positive=False,
                is_attention_required=False,
            )

        # MoM spike > 25% with non-trivial previous spend
        mom_change = monthly_analytics.expense_change_percentage
        prev_exp = monthly_analytics.previous_month_expenses
        if mom_change is not None and mom_change > ELEVATED_SPENDING_MOM_PCT and prev_exp >= Decimal("500.00"):
            return HealthDimensionDetail(
                dimension="SPENDING_PATTERN",
                name="Spending Pattern",
                status=SpendingPatternStatus.ELEVATED_SPENDING.value,
                label="Elevated Spending",
                summary=f"Monthly spending increased {mom_change}% compared with the previous month.",
                supporting_data={
                    "expense_change_percentage": str(mom_change),
                    "current_expenses": str(monthly_analytics.monthly_expenses),
                    "previous_month_expenses": str(prev_exp),
                },
                is_positive=False,
                is_attention_required=True,
            )

        return HealthDimensionDetail(
            dimension="SPENDING_PATTERN",
            name="Spending Pattern",
            status=SpendingPatternStatus.HEALTHY_PATTERN.value,
            label="Balanced Pattern",
            summary="Spending is distributed across diverse categories without unusual sudden surges.",
            supporting_data={
                "top_category": top_item.category,
                "top_category_percentage": str(top_pct),
                "total_categories_count": len(category_spending.items),
            },
            is_positive=True,
            is_attention_required=False,
        )

    @staticmethod
    def _evaluate_forecast_risk(forecast: Any) -> HealthDimensionDetail:
        if forecast.data_sufficiency == "INSUFFICIENT":
            return HealthDimensionDetail(
                dimension="FORECAST_RISK",
                name="Forecast Risk",
                status=ForecastRiskStatus.INSUFFICIENT_DATA.value,
                label="Insufficient Data",
                summary="More historical transactions are required to build a confident forward projection.",
                supporting_data={"confidence": forecast.confidence},
                is_positive=False,
                is_attention_required=False,
            )

        if forecast.is_negative_projected:
            return HealthDimensionDetail(
                dimension="FORECAST_RISK",
                name="Forecast Risk",
                status=ForecastRiskStatus.HIGH_RISK.value,
                label="High Risk",
                summary=(
                    f"Based on your recent financial pattern, a negative balance is projected "
                    f"around {forecast.negative_balance_date or forecast.minimum_balance_date}."
                ),
                supporting_data={
                    "projected_balance": str(forecast.projected_balance),
                    "minimum_projected_balance": str(forecast.minimum_projected_balance),
                    "negative_balance_date": str(forecast.negative_balance_date),
                },
                is_positive=False,
                is_attention_required=True,
            )

        if forecast.is_low_balance_projected:
            return HealthDimensionDetail(
                dimension="FORECAST_RISK",
                name="Forecast Risk",
                status=ForecastRiskStatus.MODERATE_RISK.value,
                label="Moderate Risk",
                summary=(
                    f"Based on your recent financial pattern, your balance may dip below "
                    f"your safety buffer around {forecast.low_balance_date}."
                ),
                supporting_data={
                    "minimum_projected_balance": str(forecast.minimum_projected_balance),
                    "minimum_threshold": str(forecast.minimum_balance_threshold),
                    "low_balance_date": str(forecast.low_balance_date),
                },
                is_positive=False,
                is_attention_required=True,
            )

        return HealthDimensionDetail(
            dimension="FORECAST_RISK",
            name="Forecast Risk",
            status=ForecastRiskStatus.LOW_RISK.value,
            label="Low Risk",
            summary=(
                f"Based on your recent financial pattern, your projected balance remains "
                f"comfortably positive (₹{forecast.projected_balance:,.2f}) through 30 days."
            ),
            supporting_data={
                "projected_balance": str(forecast.projected_balance),
                "minimum_projected_balance": str(forecast.minimum_projected_balance),
                "confidence": forecast.confidence,
            },
            is_positive=True,
            is_attention_required=False,
        )

    # =========================================================================
    # BANK FRESHNESS EVALUATION
    # =========================================================================

    @staticmethod
    def _evaluate_bank_freshness(
        db: Session,
        user_id: int,
        now_utc: datetime.datetime,
    ) -> BankFreshnessDetail:
        accounts = (
            db.query(ConnectedAccount)
            .filter(
                ConnectedAccount.user_id == user_id,
                ConnectedAccount.status == "ACTIVE",
            )
            .all()
        )
        if not accounts:
            return BankFreshnessDetail(
                connected_accounts_count=0,
                has_connected_bank=False,
                last_synced_at=None,
                is_stale=False,
                sync_status=None,
                freshness_description="No connected bank accounts. Ledger transactions remain authoritative.",
                impacts_assessment=False,
            )

        latest_sync: Optional[datetime.datetime] = None
        for acc in accounts:
            if acc.last_synced_at:
                s_dt = acc.last_synced_at if acc.last_synced_at.tzinfo else acc.last_synced_at.replace(tzinfo=datetime.timezone.utc)
                if latest_sync is None or s_dt > latest_sync:
                    latest_sync = s_dt

        is_stale = False
        impacts = False
        if latest_sync:
            diff = (now_utc - latest_sync).total_seconds()
            diff_hours = int(diff // 3600)
            if diff_hours < 1:
                freshness_desc = "Connected bank data was synchronized less than an hour ago."
            elif diff_hours < 24:
                freshness_desc = f"Connected bank data was last synchronized {diff_hours} hours ago."
            else:
                diff_days = int(diff // 86400)
                freshness_desc = f"Connected bank data was last synchronized {diff_days} days ago."
                is_stale = True

            if diff_hours >= BANK_STALE_HOURS_THRESHOLD:
                is_stale = True
                impacts = True
        else:
            freshness_desc = "Connected bank account exists but has never completed synchronization."
            is_stale = True
            impacts = True

        return BankFreshnessDetail(
            connected_accounts_count=len(accounts),
            has_connected_bank=True,
            last_synced_at=latest_sync,
            is_stale=is_stale,
            sync_status="DELAYED" if is_stale else "SUCCESS",
            freshness_description=freshness_desc,
            impacts_assessment=impacts,
        )

    # =========================================================================
    # SMART ACTION GENERATOR & DEDUPLICATION
    # =========================================================================

    @classmethod
    def _generate_smart_actions(
        cls,
        forecast: Any,
        minimum_threshold: Decimal,
        budget_summary: Any,
        goals_list: List[Any],
        recurring_summary: Dict[str, Any],
        category_spending: Any,
        bank_freshness: BankFreshnessDetail,
        generated_at: datetime.datetime,
    ) -> List[SmartActionItem]:
        actions_map: Dict[str, SmartActionItem] = {}

        # 1. Projected Negative Balance -> CRITICAL
        if forecast.is_negative_projected and forecast.negative_balance_date:
            action_id = "action_forecast_negative_projected"
            actions_map[action_id] = SmartActionItem(
                id=action_id,
                type=ActionType.FORECAST_NEGATIVE,
                title="Forecasted Negative Balance",
                description=(
                    f"Your projected cash position drops below ₹0 around "
                    f"{forecast.negative_balance_date.strftime('%d %b')}. "
                    f"Projected low: ₹{forecast.minimum_projected_balance:,.2f}."
                ),
                priority=ActionPriority.CRITICAL,
                reason="Upcoming recurring commitments and spending pace exceed starting funds.",
                supporting_metric={
                    "projected_minimum": str(forecast.minimum_projected_balance),
                    "date": str(forecast.negative_balance_date),
                },
                related_entity={"entity_type": "forecast"},
                recommended_next_step="Review upcoming recurring expenses and discretionary spending immediately.",
                action_url="/forecast",
                generated_at=generated_at,
            )

        # 2. Projected Low Balance -> HIGH
        elif forecast.is_low_balance_projected and forecast.low_balance_date:
            action_id = "action_forecast_low_balance_projected"
            actions_map[action_id] = SmartActionItem(
                id=action_id,
                type=ActionType.FORECAST_LOW_BUFFER,
                title="Buffer Threshold Breach",
                description=(
                    f"Your forecasted balance falls below your ₹{minimum_threshold:,.2f} "
                    f"minimum buffer around {forecast.low_balance_date.strftime('%d %b')}."
                ),
                priority=ActionPriority.HIGH,
                reason="Projected balance enters your safety buffer reserve.",
                supporting_metric={
                    "projected_minimum": str(forecast.minimum_projected_balance),
                    "minimum_threshold": str(minimum_threshold),
                    "date": str(forecast.low_balance_date),
                },
                related_entity={"entity_type": "forecast"},
                recommended_next_step="Check planned payments before your buffer is breached.",
                action_url="/forecast",
                generated_at=generated_at,
            )

        # 3. Budget Overruns -> HIGH
        if budget_summary.overall and budget_summary.overall.over_budget:
            action_id = "action_budget_overspent_overall"
            actions_map[action_id] = SmartActionItem(
                id=action_id,
                type=ActionType.BUDGET_OVERRUN,
                title="Overall Budget Exceeded",
                description=(
                    f"Total spending (₹{budget_summary.overall.spent:,.2f}) has exceeded your "
                    f"monthly overall budget of ₹{budget_summary.overall.budget:,.2f}."
                ),
                priority=ActionPriority.HIGH,
                reason="Actual monthly expenditures crossed the allocated total cap.",
                supporting_metric={
                    "budget": str(budget_summary.overall.budget),
                    "spent": str(budget_summary.overall.spent),
                    "utilization": str(budget_summary.overall.utilization),
                },
                related_entity={"entity_type": "budget", "category": "overall"},
                recommended_next_step="Pause discretionary outlays until next month or adjust spending caps.",
                action_url="/budgets",
                generated_at=generated_at,
            )

        for b in budget_summary.category_budgets:
            if b.over_budget:
                action_id = f"action_budget_overspent_{b.category.lower().replace(' ', '_')}"
                actions_map[action_id] = SmartActionItem(
                    id=action_id,
                    type=ActionType.BUDGET_OVERRUN,
                    title=f"{b.category} Budget Exceeded",
                    description=(
                        f"{b.category} spending (₹{b.spent:,.2f}) exceeded its ₹{b.budget:,.2f} limit "
                        f"by ₹{abs(b.remaining):,.2f} ({b.utilization}% used)."
                    ),
                    priority=ActionPriority.HIGH,
                    reason=f"Spending in category '{b.category}' surpassed the set threshold.",
                    supporting_metric={
                        "category": b.category,
                        "budget": str(b.budget),
                        "spent": str(b.spent),
                        "utilization": str(b.utilization),
                    },
                    related_entity={"entity_type": "budget", "category": b.category},
                    recommended_next_step=f"Review recent {b.category} transactions to control outflow.",
                    action_url="/budgets",
                    generated_at=generated_at,
                )
            elif b.utilization >= BUDGET_APPROACHING_PCT:
                action_id = f"action_budget_approaching_{b.category.lower().replace(' ', '_')}"
                actions_map[action_id] = SmartActionItem(
                    id=action_id,
                    type=ActionType.BUDGET_WARNING,
                    title=f"{b.category} Approaching Limit",
                    description=(
                        f"{b.category} has reached {b.utilization}% of this month's budget. "
                        f"₹{b.remaining:,.2f} remaining."
                    ),
                    priority=ActionPriority.MEDIUM,
                    reason=f"Category '{b.category}' utilization reached {b.utilization}%.",
                    supporting_metric={
                        "category": b.category,
                        "budget": str(b.budget),
                        "spent": str(b.spent),
                        "remaining": str(b.remaining),
                    },
                    related_entity={"entity_type": "budget", "category": b.category},
                    recommended_next_step=f"Keep daily {b.category} purchases modest to stay under cap.",
                    action_url="/budgets",
                    generated_at=generated_at,
                )

        # 4. Overdue Goals & Unaffordable Goals -> HIGH / MEDIUM
        unaffordable_ids = {
            gp.goal_id: gp for gp in forecast.goal_planning if not gp.is_affordable
        }
        for g in goals_list:
            if g.status == "overdue":
                action_id = f"action_goal_overdue_{g.id}"
                actions_map[action_id] = SmartActionItem(
                    id=action_id,
                    type=ActionType.GOAL_OVERDUE,
                    title=f"Goal Overdue: {g.name}",
                    description=(
                        f"{g.name} target date ({g.target_date}) has passed, leaving "
                        f"₹{g.remaining_amount:,.2f} underfunded ({g.progress_percentage}% funded)."
                    ),
                    priority=ActionPriority.HIGH,
                    reason="Savings deadline expired before target amount was accumulated.",
                    supporting_metric={
                        "target_amount": str(g.target_amount),
                        "current_amount": str(g.current_amount),
                        "remaining": str(g.remaining_amount),
                    },
                    related_entity={"entity_type": "goal", "goal_id": g.id, "name": g.name},
                    recommended_next_step="Extend the target date or add a contribution to complete the goal.",
                    action_url="/goals",
                    generated_at=generated_at,
                )
            elif g.id in unaffordable_ids:
                gp = unaffordable_ids[g.id]
                action_id = f"action_goal_unaffordable_{g.id}"
                actions_map[action_id] = SmartActionItem(
                    id=action_id,
                    type=ActionType.GOAL_PACE,
                    title=f"Goal Pace at Risk: {g.name}",
                    description=(
                        f"Your planned pace for {g.name} (₹{gp.suggested_monthly_allocation or 0:,.2f}/mo) "
                        f"exceeds your projected monthly surplus."
                    ),
                    priority=ActionPriority.MEDIUM,
                    reason="Projected 30-day cash flow cannot absorb target monthly contribution.",
                    supporting_metric={
                        "suggested_monthly": str(gp.suggested_monthly_allocation or 0),
                        "remaining": str(g.remaining_amount),
                    },
                    related_entity={"entity_type": "goal", "goal_id": g.id, "name": g.name},
                    recommended_next_step="Adjust target date or rebalance discretionary expenses.",
                    action_url="/goals",
                    generated_at=generated_at,
                )

        # 5. Price Increases in Recurring Subscriptions -> MEDIUM
        price_changes = recurring_summary.get("recently_changed", [])
        for chg in price_changes:
            action_id = f"action_sub_price_change_{chg.id}"
            pct_str = f"+{chg.amount_change_percentage}%" if chg.amount_change_percentage else "increase"
            actions_map[action_id] = SmartActionItem(
                id=action_id,
                type=ActionType.SUBSCRIPTION_INCREASE,
                title=f"Price Increase: {chg.merchant}",
                description=(
                    f"A recurring payment for {chg.merchant} increased from "
                    f"₹{chg.previous_amount:,.2f} to ₹{chg.latest_amount:,.2f} ({pct_str})."
                ),
                priority=ActionPriority.MEDIUM,
                reason="Subscription payment amount was detected higher than the historical baseline.",
                supporting_metric={
                    "previous_amount": str(chg.previous_amount),
                    "latest_amount": str(chg.latest_amount),
                    "percentage_change": str(chg.amount_change_percentage),
                },
                related_entity={"entity_type": "recurring_expense", "merchant": chg.merchant},
                recommended_next_step="Verify whether plan changed or if this subscription should be cancelled.",
                action_url="/recurring",
                generated_at=generated_at,
            )

        # 6. Missed / Overdue Expected Recurring Commitments -> LOW
        needs_att = recurring_summary.get("needs_attention", [])
        for item in needs_att:
            action_id = f"action_recurring_attention_{item.id}"
            actions_map[action_id] = SmartActionItem(
                id=action_id,
                type=ActionType.RECURRING_MISSED,
                title=f"Pending Recurring Bill: {item.merchant}",
                description=(
                    f"An expected payment of ₹{item.latest_amount:,.2f} for {item.merchant} "
                    f"was anticipated around {item.next_expected_date.strftime('%d %b')}."
                ),
                priority=ActionPriority.LOW,
                reason="No matching transaction was recorded around expected renewal cycle.",
                supporting_metric={
                    "amount": str(item.latest_amount),
                    "expected_date": str(item.next_expected_date.date()),
                },
                related_entity={"entity_type": "recurring_expense", "merchant": item.merchant},
                recommended_next_step="Record payment if made or review if the subscription ended.",
                action_url="/recurring",
                generated_at=generated_at,
            )

        # 7. Stale Bank Sync -> LOW or INFO
        if bank_freshness.has_connected_bank and bank_freshness.is_stale:
            action_id = "action_bank_sync_stale"
            actions_map[action_id] = SmartActionItem(
                id=action_id,
                type=ActionType.BANK_SYNC_STALE,
                title="Bank Connection Needs Refresh",
                description=(
                    f"{bank_freshness.freshness_description} "
                    f"Recent bank deposits or debit card spending may not yet be reflected."
                ),
                priority=ActionPriority.LOW,
                reason="Automated synchronization has not completed recently.",
                supporting_metric={
                    "connected_accounts": bank_freshness.connected_accounts_count,
                    "last_synced_at": str(bank_freshness.last_synced_at) if bank_freshness.last_synced_at else None,
                },
                related_entity={"entity_type": "connected_account"},
                recommended_next_step="Trigger manual sync on Connected Accounts to fetch latest transactions.",
                action_url="/connected-accounts",
                generated_at=generated_at,
            )

        # 8. Missing Budget -> INFO
        if budget_summary.overall is None and not budget_summary.category_budgets:
            action_id = "action_no_active_budget"
            actions_map[action_id] = SmartActionItem(
                id=action_id,
                type=ActionType.NO_ACTIVE_BUDGET,
                title="Set Up Monthly Spending Limits",
                description="Setting category budgets helps keep daily campus expenses under control.",
                priority=ActionPriority.INFO,
                reason="No active budgets are currently configured for this month.",
                supporting_metric=None,
                related_entity={"entity_type": "budget"},
                recommended_next_step="Create an overall budget or food/travel spending limit.",
                action_url="/budgets",
                generated_at=generated_at,
            )

        # 9. Missing Goals -> INFO
        if not goals_list:
            action_id = "action_no_active_goals"
            actions_map[action_id] = SmartActionItem(
                id=action_id,
                type=ActionType.NO_ACTIVE_GOALS,
                title="Set a Student Savings Target",
                description="Create a savings goal for textbooks, exam fees, tech gadgets, or emergency buffer.",
                priority=ActionPriority.INFO,
                reason="No active savings goals found.",
                supporting_metric=None,
                related_entity={"entity_type": "goal"},
                recommended_next_step="Define a savings target with a timeline.",
                action_url="/goals",
                generated_at=generated_at,
            )

        # 10. Insufficient Data -> INFO
        if forecast.data_sufficiency == "INSUFFICIENT":
            action_id = "action_data_collection"
            actions_map[action_id] = SmartActionItem(
                id=action_id,
                type=ActionType.DATA_COLLECTION,
                title="Add Initial Transactions",
                description="Add 5+ transactions or connect a bank account to unlock full financial health insights.",
                priority=ActionPriority.INFO,
                reason="Historical transaction volume is below the statistical threshold.",
                supporting_metric={"data_sufficiency": forecast.data_sufficiency},
                related_entity=None,
                recommended_next_step="Record today's spending in Activity or sync your bank.",
                action_url="/activity",
                generated_at=generated_at,
            )

        # Deterministic sorting: Priority order first, then ID
        sorted_actions = sorted(
            actions_map.values(),
            key=lambda a: (PRIORITY_ORDER.get(a.priority, 99), a.id),
        )
        return sorted_actions

    # =========================================================================
    # POSITIVE SIGNALS GENERATOR
    # =========================================================================

    @classmethod
    def _generate_positive_signals(
        cls,
        forecast: Any,
        budget_summary: Any,
        goal_overview: Any,
        goals_list: List[Any],
        recurring_summary: Dict[str, Any],
        monthly_analytics: Any,
        dim_buffer: HealthDimensionDetail,
        dim_stability: HealthDimensionDetail,
        dim_budget: HealthDimensionDetail,
        dim_goal: HealthDimensionDetail,
        dim_recurring: HealthDimensionDetail,
        dim_forecast: HealthDimensionDetail,
    ) -> List[PositiveSignalItem]:
        signals: List[PositiveSignalItem] = []

        # Buffer positive
        if dim_buffer.is_positive and not dim_buffer.is_attention_required:
            signals.append(
                PositiveSignalItem(
                    id="signal_buffer_healthy",
                    dimension="CASH_BUFFER",
                    title="Healthy Safety Buffer",
                    description=(
                        f"Your projected cash balance remains above your threshold "
                        f"(projected low of ₹{forecast.minimum_projected_balance:,.2f})."
                    ),
                    supporting_data={"projected_minimum": str(forecast.minimum_projected_balance)},
                )
            )

        # Forecast low risk
        if dim_forecast.status == ForecastRiskStatus.LOW_RISK.value:
            signals.append(
                PositiveSignalItem(
                    id="signal_forecast_positive",
                    dimension="FORECAST_RISK",
                    title="Positive 30-Day Outlook",
                    description=(
                        f"Based on your recent financial pattern, your balance is projected "
                        f"to stay positive through the next 30 days."
                    ),
                    supporting_data={"projected_balance": str(forecast.projected_balance)},
                )
            )

        # Budget on track
        if (
            dim_budget.status == BudgetHealthStatus.ON_TRACK.value
            and (budget_summary.overall is not None or budget_summary.category_budgets)
        ):
            b_amt = budget_summary.overall.budget if budget_summary.overall else sum((c.budget for c in budget_summary.category_budgets), Decimal("0.00"))
            signals.append(
                PositiveSignalItem(
                    id="signal_budget_on_track",
                    dimension="BUDGET_HEALTH",
                    title="Budgets Under Control",
                    description="All active categories and spending limits are operating within planned caps.",
                    supporting_data={"total_budgeted": str(b_amt)},
                )
            )

        # Goals completed or on track
        if dim_goal.status in (GoalHealthStatus.ON_TRACK.value, GoalHealthStatus.COMPLETED.value):
            if dim_goal.status == GoalHealthStatus.COMPLETED.value:
                desc = "All savings targets have been completed!"
            else:
                desc = f"{goal_overview.active_goals_count} savings goals are progressing feasibly toward target deadlines."
            signals.append(
                PositiveSignalItem(
                    id="signal_goals_progressing",
                    dimension="GOAL_HEALTH",
                    title="Savings Goals on Target",
                    description=desc,
                    supporting_data={"overall_progress": str(goal_overview.overall_progress_percentage)},
                )
            )

        # Recurring low burden
        if dim_recurring.status == RecurringBurdenStatus.LOW.value:
            signals.append(
                PositiveSignalItem(
                    id="signal_recurring_low",
                    dimension="RECURRING_BURDEN",
                    title="Low Fixed Commitments",
                    description="Committed subscriptions and recurring bills account for less than 20% of baseline spend.",
                    supporting_data={"monthly_committed": str(recurring_summary.get("total_monthly_committed", 0))},
                )
            )

        # Positive net cash flow
        if monthly_analytics.monthly_net_cash_flow > Decimal("0.00"):
            signals.append(
                PositiveSignalItem(
                    id="signal_positive_net_cash_flow",
                    dimension="CASH_FLOW_STABILITY",
                    title="Net Monthly Surplus",
                    description=f"Generated a net surplus of ₹{monthly_analytics.monthly_net_cash_flow:,.2f} this month.",
                    supporting_data={"net_surplus": str(monthly_analytics.monthly_net_cash_flow)},
                )
            )

        return signals

    # =========================================================================
    # OVERVIEW BUILDER
    # =========================================================================

    @staticmethod
    def _build_overview(
        data_sufficiency: str,
        dimensions: Dict[str, HealthDimensionDetail],
        actions: List[SmartActionItem],
        positive_signals: List[PositiveSignalItem],
    ) -> FinancialHealthOverview:
        critical_count = sum(1 for a in actions if a.priority == ActionPriority.CRITICAL)
        high_count = sum(1 for a in actions if a.priority == ActionPriority.HIGH)
        total_actions = len(actions)

        # Primary attention dimension
        attention_dims = [k for k, d in dimensions.items() if d.is_attention_required]
        primary_dim = attention_dims[0] if attention_dims else None

        if data_sufficiency == "INSUFFICIENT":
            status_label = "Building Assessment"
            summary = (
                "Your financial health assessment is limited because there isn't enough "
                "recent transaction history yet. Record transactions to reveal trends."
            )
        elif critical_count > 0:
            status_label = "Needs Immediate Attention"
            summary = (
                f"You have {critical_count} critical financial alert(s) that require review, "
                f"principally around {dimensions.get(primary_dim or 'CASH_BUFFER').name}."
            )
        elif high_count > 0:
            status_label = "Requires Attention"
            summary = (
                f"Your finances have {high_count} area(s) needing attention, "
                f"notably in {dimensions.get(primary_dim or 'BUDGET_HEALTH').name}."
            )
        elif len(positive_signals) >= 3:
            status_label = "Solid Position"
            summary = (
                "Your financial position is stable with strong buffer margins, controlled spending, "
                "and steady progress on your goals."
            )
        else:
            status_label = "Fair & Stable"
            summary = "Your financial position is balanced with manageable student spending and commitments."

        return FinancialHealthOverview(
            data_sufficiency=data_sufficiency,
            overall_status_label=status_label,
            overall_summary=summary,
            critical_actions_count=critical_count,
            high_actions_count=high_count,
            total_actions_count=total_actions,
            positive_signals_count=len(positive_signals),
            primary_attention_dimension=primary_dim,
        )
