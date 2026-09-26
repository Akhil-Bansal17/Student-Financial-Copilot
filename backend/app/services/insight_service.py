import datetime
from decimal import Decimal
from typing import Dict, List, Optional, Tuple
import sqlalchemy as sa
from sqlalchemy.orm import Session

from app.models.transaction import Transaction
from app.schemas.insight import (
    FinancialInsight,
    InsightPriority,
    InsightType,
    InsightsResponse,
    InsightsSummaryMetrics,
)
from app.services.analytics_service import (
    AnalyticsService,
    calculate_percentage_change,
    get_month_date_range,
    get_previous_month_year,
)
from app.services.budget_service import BudgetService
from app.services.goal_service import GoalService

# ==============================================================================
# DETERMINISTIC THRESHOLDS & RULES
# ==============================================================================

# Spending concentration threshold: When top 1 or 2 categories account for >= 60% of total expenses.
SPENDING_CONCENTRATION_THRESHOLD = Decimal("60.0")

# Minimum previous month expense in a category to evaluate a trend percentage.
# Avoids noisy large percentage swings on trivial amounts (e.g. ₹10 -> ₹40 is 300% but negligible).
SPENDING_TREND_MIN_PREV_EXPENSE = Decimal("100.00")

# Minimum +/- percentage change in category spending to qualify as significant trend.
SPENDING_TREND_SIGNIFICANT_PCT = Decimal("10.0")

# Threshold for budget warnings: 80% to 100% of limit used is approaching budget.
BUDGET_APPROACHING_THRESHOLD_PCT = Decimal("80.0")

# Recurring pattern detection constants:
# Minimum occurrences required to identify a recurring pattern.
MIN_RECURRING_OCCURRENCES = 3

# Price tolerance for recurring expenses (e.g. 5% tolerance for minor billing variations).
RECURRING_AMOUNT_TOLERANCE_PCT = Decimal("0.05")

# Approximate intervals in days between successive occurrences.
RECURRING_WEEKLY_MIN_DAYS = 5
RECURRING_WEEKLY_MAX_DAYS = 9
RECURRING_MONTHLY_MIN_DAYS = 25
RECURRING_MONTHLY_MAX_DAYS = 35


class AdvancedInsightsService:
    """
    Deterministic Financial Insights Engine.
    Transforms raw transactional, budget, and savings goal data into clear,
    actionable, non-speculative financial observations for students.
    """

    @classmethod
    def generate_insights(
        cls, db: Session, user_id: int, year: int, month: int
    ) -> InsightsResponse:
        period = f"{year}-{month:02d}"
        insights: List[FinancialInsight] = []

        # 1. CASH FLOW INSIGHT
        cash_flow_insight = cls._generate_cash_flow_insight(db, user_id, year, month, period)
        if cash_flow_insight:
            insights.append(cash_flow_insight)

        # 2. TOP SPENDING CATEGORY & SPENDING CONCENTRATION INSIGHTS
        cat_insights = cls._generate_category_insights(db, user_id, year, month, period)
        insights.extend(cat_insights)

        # 3. MONTH-OVER-MONTH TOTAL CHANGES & SPENDING TRENDS
        trend_insights = cls._generate_trend_insights(db, user_id, year, month, period)
        insights.extend(trend_insights)

        # 4. BUDGET INSIGHTS
        budget_insights = cls._generate_budget_insights(db, user_id, year, month, period)
        insights.extend(budget_insights)

        # 5. SAVINGS GOAL INSIGHTS
        goal_insights = cls._generate_goal_insights(db, user_id, period)
        insights.extend(goal_insights)

        # 6. RECURRING EXPENSE PATTERN DETECTION
        recurring_insights = cls._generate_recurring_patterns(db, user_id, period)
        insights.extend(recurring_insights)

        # Summary Counts
        positive_count = sum(1 for i in insights if i.priority == InsightPriority.POSITIVE)
        warning_count = sum(1 for i in insights if i.priority == InsightPriority.WARNING)
        info_count = sum(1 for i in insights if i.priority == InsightPriority.INFO)
        has_sufficient = len(insights) > 0

        summary = InsightsSummaryMetrics(
            total_insights_count=len(insights),
            positive_count=positive_count,
            warning_count=warning_count,
            info_count=info_count,
            has_sufficient_data=has_sufficient,
        )

        return InsightsResponse(
            year=year,
            month=month,
            period=period,
            has_sufficient_data=has_sufficient,
            summary=summary,
            insights=insights,
        )

    # --------------------------------------------------------------------------
    # 1. CASH FLOW
    # --------------------------------------------------------------------------
    @classmethod
    def _generate_cash_flow_insight(
        cls, db: Session, user_id: int, year: int, month: int, period: str
    ) -> Optional[FinancialInsight]:
        monthly_data = AnalyticsService.get_monthly_analytics(db, user_id, year, month)

        if monthly_data.transaction_count == 0 and monthly_data.monthly_income == Decimal("0.00") and monthly_data.monthly_expenses == Decimal("0.00"):
            return None

        income = monthly_data.monthly_income
        expenses = monthly_data.monthly_expenses

        if income > expenses:
            surplus = (income - expenses).quantize(Decimal("0.01"))
            return FinancialInsight(
                id=f"cash_flow_surplus_{period}",
                type=InsightType.CASH_FLOW,
                priority=InsightPriority.POSITIVE,
                category=None,
                title="Positive Monthly Cash Flow",
                description=f"Your income exceeded expenses by ₹{surplus:,.2f} this month.",
                amount=surplus,
                percentage=None,
                period=period,
                metadata={"income": str(income), "expenses": str(expenses), "status": "surplus"},
            )
        elif expenses > income:
            deficit = (expenses - income).quantize(Decimal("0.01"))
            return FinancialInsight(
                id=f"cash_flow_deficit_{period}",
                type=InsightType.CASH_FLOW,
                priority=InsightPriority.WARNING,
                category=None,
                title="Negative Monthly Cash Flow",
                description=f"Your expenses exceeded income by ₹{deficit:,.2f} this month.",
                amount=deficit,
                percentage=None,
                period=period,
                metadata={"income": str(income), "expenses": str(expenses), "status": "deficit"},
            )
        elif income > Decimal("0.00"):
            return FinancialInsight(
                id=f"cash_flow_balanced_{period}",
                type=InsightType.CASH_FLOW,
                priority=InsightPriority.INFO,
                category=None,
                title="Balanced Monthly Cash Flow",
                description="Your monthly income and expenses were exactly equal.",
                amount=income,
                percentage=None,
                period=period,
                metadata={"income": str(income), "expenses": str(expenses), "status": "balanced"},
            )
        return None

    # --------------------------------------------------------------------------
    # 2. TOP CATEGORY & SPENDING CONCENTRATION
    # --------------------------------------------------------------------------
    @classmethod
    def _generate_category_insights(
        cls, db: Session, user_id: int, year: int, month: int, period: str
    ) -> List[FinancialInsight]:
        results: List[FinancialInsight] = []
        cat_data = AnalyticsService.get_category_spending(db, user_id, year, month)

        if cat_data.total_expenses <= Decimal("0.00") or not cat_data.items:
            return results

        items = cat_data.items
        top_item = items[0]

        # Top Spending Category
        results.append(
            FinancialInsight(
                id=f"top_category_{top_item.category}_{period}",
                type=InsightType.TOP_CATEGORY,
                priority=InsightPriority.INFO,
                category=top_item.category,
                title=f"Top Expense: {top_item.category}",
                description=f"{top_item.category} is your highest spending category this month, accounting for {top_item.percentage}% of your total expenses (₹{top_item.amount:,.2f}).",
                amount=top_item.amount,
                percentage=top_item.percentage,
                period=period,
                metadata={"category": top_item.category, "count": top_item.transaction_count},
            )
        )

        # Spending Concentration
        if len(items) >= 2:
            top2_pct = (top_item.percentage + items[1].percentage).quantize(Decimal("0.1"))
            if top2_pct >= SPENDING_CONCENTRATION_THRESHOLD:
                results.append(
                    FinancialInsight(
                        id=f"concentration_{top_item.category}_{items[1].category}_{period}",
                        type=InsightType.SPENDING_CONCENTRATION,
                        priority=InsightPriority.WARNING,
                        category=f"{top_item.category} & {items[1].category}",
                        title="High Spending Concentration",
                        description=f"{top_item.category} and {items[1].category} account for {top2_pct}% of your total expenses this month.",
                        amount=(top_item.amount + items[1].amount).quantize(Decimal("0.01")),
                        percentage=top2_pct,
                        period=period,
                        metadata={
                            "categories": [top_item.category, items[1].category],
                            "concentration_percentage": str(top2_pct),
                        },
                    )
                )
        elif len(items) == 1 and top_item.percentage >= SPENDING_CONCENTRATION_THRESHOLD:
            results.append(
                FinancialInsight(
                    id=f"concentration_{top_item.category}_{period}",
                    type=InsightType.SPENDING_CONCENTRATION,
                    priority=InsightPriority.WARNING,
                    category=top_item.category,
                    title="High Spending Concentration",
                    description=f"{top_item.category} accounts for {top_item.percentage}% of your total expenses this month.",
                    amount=top_item.amount,
                    percentage=top_item.percentage,
                    period=period,
                    metadata={
                        "categories": [top_item.category],
                        "concentration_percentage": str(top_item.percentage),
                    },
                )
            )

        return results

    # --------------------------------------------------------------------------
    # 3. MONTH-OVER-MONTH TRENDS & CATEGORY SPENDING TRENDS
    # --------------------------------------------------------------------------
    @classmethod
    def _generate_trend_insights(
        cls, db: Session, user_id: int, year: int, month: int, period: str
    ) -> List[FinancialInsight]:
        results: List[FinancialInsight] = []
        monthly_data = AnalyticsService.get_monthly_analytics(db, user_id, year, month)

        # Total monthly expenses change
        if monthly_data.previous_month_expenses > Decimal("0.00") and monthly_data.expense_change_percentage is not None:
            pct = monthly_data.expense_change_percentage
            if pct > Decimal("0.0"):
                prio = InsightPriority.WARNING if pct >= Decimal("10.0") else InsightPriority.INFO
                results.append(
                    FinancialInsight(
                        id=f"monthly_expense_increase_{period}",
                        type=InsightType.MONTHLY_CHANGE,
                        priority=prio,
                        category=None,
                        title="Total Expenses Increased",
                        description=f"Total expenses increased by {pct}% compared with last month (from ₹{monthly_data.previous_month_expenses:,.2f} to ₹{monthly_data.monthly_expenses:,.2f}).",
                        amount=monthly_data.monthly_expenses,
                        percentage=pct,
                        period=period,
                        metadata={"previous": str(monthly_data.previous_month_expenses), "current": str(monthly_data.monthly_expenses)},
                    )
                )
            elif pct < Decimal("0.0"):
                results.append(
                    FinancialInsight(
                        id=f"monthly_expense_decrease_{period}",
                        type=InsightType.MONTHLY_CHANGE,
                        priority=InsightPriority.POSITIVE,
                        category=None,
                        title="Total Expenses Decreased",
                        description=f"Total expenses decreased by {abs(pct)}% compared with last month (from ₹{monthly_data.previous_month_expenses:,.2f} to ₹{monthly_data.monthly_expenses:,.2f}).",
                        amount=monthly_data.monthly_expenses,
                        percentage=abs(pct),
                        period=period,
                        metadata={"previous": str(monthly_data.previous_month_expenses), "current": str(monthly_data.monthly_expenses)},
                    )
                )

        # Total monthly income change (if significant)
        if monthly_data.previous_month_income > Decimal("0.00") and monthly_data.income_change_percentage is not None:
            pct = monthly_data.income_change_percentage
            if abs(pct) >= Decimal("10.0"):
                if pct > Decimal("0.0"):
                    results.append(
                        FinancialInsight(
                            id=f"monthly_income_increase_{period}",
                            type=InsightType.MONTHLY_CHANGE,
                            priority=InsightPriority.POSITIVE,
                            category=None,
                            title="Monthly Inflows Increased",
                            description=f"Monthly income increased by {pct}% compared with last month (from ₹{monthly_data.previous_month_income:,.2f} to ₹{monthly_data.monthly_income:,.2f}).",
                            amount=monthly_data.monthly_income,
                            percentage=pct,
                            period=period,
                            metadata={"previous": str(monthly_data.previous_month_income), "current": str(monthly_data.monthly_income)},
                        )
                    )
                else:
                    results.append(
                        FinancialInsight(
                            id=f"monthly_income_decrease_{period}",
                            type=InsightType.MONTHLY_CHANGE,
                            priority=InsightPriority.WARNING,
                            category=None,
                            title="Monthly Inflows Decreased",
                            description=f"Monthly income decreased by {abs(pct)}% compared with last month (from ₹{monthly_data.previous_month_income:,.2f} to ₹{monthly_data.monthly_income:,.2f}).",
                            amount=monthly_data.monthly_income,
                            percentage=abs(pct),
                            period=period,
                            metadata={"previous": str(monthly_data.previous_month_income), "current": str(monthly_data.monthly_income)},
                        )
                    )

        # Category-level spending trends
        prev_year, prev_month = get_previous_month_year(year, month)
        curr_cat_spending = AnalyticsService.get_category_spending(db, user_id, year, month)
        prev_cat_spending = AnalyticsService.get_category_spending(db, user_id, prev_year, prev_month)

        prev_map = {item.category: item.amount for item in prev_cat_spending.items}

        for item in curr_cat_spending.items:
            prev_amt = prev_map.get(item.category, Decimal("0.00"))
            # Only generate trend if baseline in previous month is non-trivial to avoid false alerts
            if prev_amt >= SPENDING_TREND_MIN_PREV_EXPENSE:
                change_pct = calculate_percentage_change(item.amount, prev_amt)
                if change_pct is not None:
                    if change_pct >= SPENDING_TREND_SIGNIFICANT_PCT:
                        results.append(
                            FinancialInsight(
                                id=f"trend_increase_{item.category}_{period}",
                                type=InsightType.SPENDING_TREND,
                                priority=InsightPriority.WARNING,
                                category=item.category,
                                title=f"{item.category} Spending Increased",
                                description=f"{item.category} spending increased {change_pct}% compared with last month (from ₹{prev_amt:,.2f} to ₹{item.amount:,.2f}).",
                                amount=item.amount,
                                percentage=change_pct,
                                period=period,
                                metadata={"previous": str(prev_amt), "current": str(item.amount)},
                            )
                        )
                    elif change_pct <= -SPENDING_TREND_SIGNIFICANT_PCT:
                        results.append(
                            FinancialInsight(
                                id=f"trend_decrease_{item.category}_{period}",
                                type=InsightType.SPENDING_TREND,
                                priority=InsightPriority.POSITIVE,
                                category=item.category,
                                title=f"{item.category} Spending Decreased",
                                description=f"{item.category} spending decreased {abs(change_pct)}% compared with last month (from ₹{prev_amt:,.2f} to ₹{item.amount:,.2f}).",
                                amount=item.amount,
                                percentage=abs(change_pct),
                                period=period,
                                metadata={"previous": str(prev_amt), "current": str(item.amount)},
                            )
                        )

        return results

    # --------------------------------------------------------------------------
    # 4. BUDGET INSIGHTS
    # --------------------------------------------------------------------------
    @classmethod
    def _generate_budget_insights(
        cls, db: Session, user_id: int, year: int, month: int, period: str
    ) -> List[FinancialInsight]:
        results: List[FinancialInsight] = []
        budget_summary = BudgetService.get_summary(db, user_id, year, month)

        if not budget_summary.has_any_budget:
            return results

        # Overall Budget Checks
        if budget_summary.has_overall_budget and budget_summary.overall is not None:
            overall = budget_summary.overall
            if overall.over_budget:
                excess = abs(overall.remaining)
                results.append(
                    FinancialInsight(
                        id=f"budget_overall_exceeded_{period}",
                        type=InsightType.BUDGET,
                        priority=InsightPriority.WARNING,
                        category=None,
                        title="Overall Monthly Budget Exceeded",
                        description=f"Your total spending of ₹{overall.spent:,.2f} has exceeded your overall budget limit by ₹{excess:,.2f} ({overall.utilization}% used).",
                        amount=excess,
                        percentage=overall.utilization,
                        period=period,
                        metadata={"budget": str(overall.budget), "spent": str(overall.spent)},
                    )
                )
            elif overall.utilization >= BUDGET_APPROACHING_THRESHOLD_PCT:
                results.append(
                    FinancialInsight(
                        id=f"budget_overall_approaching_{period}",
                        type=InsightType.BUDGET,
                        priority=InsightPriority.WARNING,
                        category=None,
                        title="Approaching Overall Budget Limit",
                        description=f"You have used {overall.utilization}% of your overall monthly budget. ₹{overall.remaining:,.2f} remains for the month.",
                        amount=overall.remaining,
                        percentage=overall.utilization,
                        period=period,
                        metadata={"budget": str(overall.budget), "spent": str(overall.spent)},
                    )
                )

        # Category Budget Checks
        for cat in budget_summary.category_budgets:
            if cat.over_budget:
                excess = abs(cat.remaining)
                results.append(
                    FinancialInsight(
                        id=f"budget_cat_exceeded_{cat.category}_{period}",
                        type=InsightType.BUDGET,
                        priority=InsightPriority.WARNING,
                        category=cat.category,
                        title=f"{cat.category} Over Budget",
                        description=f"{cat.category} spending (₹{cat.spent:,.2f}) is over budget by ₹{excess:,.2f} ({cat.utilization}% used).",
                        amount=excess,
                        percentage=cat.utilization,
                        period=period,
                        metadata={"category": cat.category, "budget": str(cat.budget), "spent": str(cat.spent)},
                    )
                )
            elif cat.utilization >= BUDGET_APPROACHING_THRESHOLD_PCT:
                results.append(
                    FinancialInsight(
                        id=f"budget_cat_approaching_{cat.category}_{period}",
                        type=InsightType.BUDGET,
                        priority=InsightPriority.WARNING,
                        category=cat.category,
                        title=f"{cat.category} Near Budget Limit",
                        description=f"{cat.category} has reached {cat.utilization}% of its monthly cap. ₹{cat.remaining:,.2f} remains available.",
                        amount=cat.remaining,
                        percentage=cat.utilization,
                        period=period,
                        metadata={"category": cat.category, "budget": str(cat.budget), "spent": str(cat.spent)},
                    )
                )

        return results

    # --------------------------------------------------------------------------
    # 5. SAVINGS GOAL INSIGHTS
    # --------------------------------------------------------------------------
    @classmethod
    def _generate_goal_insights(
        cls, db: Session, user_id: int, period: str
    ) -> List[FinancialInsight]:
        results: List[FinancialInsight] = []
        overview = GoalService.get_overview(db, user_id)

        if overview.total_goals_count == 0:
            return results

        for goal in overview.goals:
            if goal.status == "completed":
                results.append(
                    FinancialInsight(
                        id=f"goal_completed_{goal.id}_{period}",
                        type=InsightType.GOAL,
                        priority=InsightPriority.POSITIVE,
                        category="Savings",
                        title=f"Savings Goal Reached: {goal.name}",
                        description=f"Target achieved! You reached 100% of your target amount (₹{goal.target_amount:,.2f}) for {goal.name}.",
                        amount=goal.current_amount,
                        percentage=Decimal("100.0"),
                        period=period,
                        metadata={"goal_id": goal.id, "target_amount": str(goal.target_amount), "status": "completed"},
                    )
                )
            elif goal.status == "overdue":
                results.append(
                    FinancialInsight(
                        id=f"goal_overdue_{goal.id}_{period}",
                        type=InsightType.GOAL,
                        priority=InsightPriority.WARNING,
                        category="Savings",
                        title=f"Goal Overdue: {goal.name}",
                        description=f"{goal.name} target date was {goal.target_date} and remains underfunded by ₹{goal.remaining_amount:,.2f} ({goal.progress_percentage}% funded).",
                        amount=goal.remaining_amount,
                        percentage=goal.progress_percentage,
                        period=period,
                        metadata={"goal_id": goal.id, "target_date": str(goal.target_date), "status": "overdue"},
                    )
                )
            elif goal.status == "active":
                results.append(
                    FinancialInsight(
                        id=f"goal_active_{goal.id}_{period}",
                        type=InsightType.GOAL,
                        priority=InsightPriority.INFO,
                        category="Savings",
                        title=f"Goal Progress: {goal.name}",
                        description=f"{goal.name} is {goal.progress_percentage}% complete. ₹{goal.remaining_amount:,.2f} remains to reach your target.",
                        amount=goal.remaining_amount,
                        percentage=goal.progress_percentage,
                        period=period,
                        metadata={"goal_id": goal.id, "remaining": str(goal.remaining_amount), "status": "active"},
                    )
                )

        return results

    # --------------------------------------------------------------------------
    # 6. RECURRING EXPENSE PATTERN DETECTION
    # --------------------------------------------------------------------------
    @classmethod
    def _generate_recurring_patterns(
        cls, db: Session, user_id: int, period: str
    ) -> List[FinancialInsight]:
        """
        Conservative deterministic detector for repeated transactions:
        - Same category
        - Approximately similar amount (within +/- 5% tolerance)
        - At least 3 occurrences
        - Regular intervals (approximately weekly: 5-9 days, or monthly: 25-35 days)
        """
        results: List[FinancialInsight] = []

        # Retrieve user expense transactions ordered chronologically
        transactions = (
            db.query(Transaction)
            .filter(
                Transaction.user_id == user_id,
                Transaction.transaction_type == "expense",
            )
            .order_by(Transaction.transaction_date.asc())
            .all()
        )

        if len(transactions) < MIN_RECURRING_OCCURRENCES:
            return results

        # Group by category
        by_category: Dict[str, List[Transaction]] = {}
        for tx in transactions:
            by_category.setdefault(tx.category, []).append(tx)

        for category, tx_list in by_category.items():
            if len(tx_list) < MIN_RECURRING_OCCURRENCES:
                continue

            # Cluster by amount tolerance
            clusters: List[List[Transaction]] = []
            for tx in tx_list:
                placed = False
                for cluster in clusters:
                    base_amt = cluster[0].amount
                    lower_bound = base_amt * (Decimal("1.00") - RECURRING_AMOUNT_TOLERANCE_PCT)
                    upper_bound = base_amt * (Decimal("1.00") + RECURRING_AMOUNT_TOLERANCE_PCT)
                    if lower_bound <= tx.amount <= upper_bound:
                        cluster.append(tx)
                        placed = True
                        break
                if not placed:
                    clusters.append([tx])

            for cluster in clusters:
                if len(cluster) < MIN_RECURRING_OCCURRENCES:
                    continue

                # Ensure sorted by date
                cluster.sort(key=lambda t: t.transaction_date)

                # Calculate intervals in days between successive occurrences
                intervals: List[int] = []
                for i in range(len(cluster) - 1):
                    dt1 = cluster[i].transaction_date
                    dt2 = cluster[i + 1].transaction_date
                    delta_days = (dt2.date() - dt1.date()).days
                    intervals.append(delta_days)

                if not intervals:
                    continue

                # Check if all intervals match weekly interval range
                is_weekly = all(
                    RECURRING_WEEKLY_MIN_DAYS <= d <= RECURRING_WEEKLY_MAX_DAYS for d in intervals
                )
                # Check if all intervals match monthly interval range
                is_monthly = all(
                    RECURRING_MONTHLY_MIN_DAYS <= d <= RECURRING_MONTHLY_MAX_DAYS for d in intervals
                )

                if is_weekly or is_monthly:
                    frequency = "weekly" if is_weekly else "monthly"
                    freq_label = "weekly (~7 days)" if is_weekly else "monthly (~30 days)"
                    avg_amt = (sum((t.amount for t in cluster), Decimal("0.00")) / len(cluster)).quantize(Decimal("0.01"))

                    results.append(
                        FinancialInsight(
                            id=f"recurring_{category}_{frequency}_{cluster[0].id}_{period}",
                            type=InsightType.RECURRING_PATTERN,
                            priority=InsightPriority.INFO,
                            category=category,
                            title=f"Recurring Expense Pattern: {category}",
                            description=f"Detected {len(cluster)} repeated transactions of approximately ₹{avg_amt:,.2f} occurring on a {freq_label} basis in {category}.",
                            amount=avg_amt,
                            percentage=None,
                            period=period,
                            metadata={
                                "category": category,
                                "frequency": frequency,
                                "occurrences": len(cluster),
                                "average_amount": str(avg_amt),
                            },
                        )
                    )

        return results
