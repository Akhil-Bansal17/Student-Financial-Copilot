import datetime
from decimal import Decimal
from typing import List, Optional, Dict, Any, Type
import logging
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.notification import Notification
from app.models.notification_preference import NotificationPreference
from app.models.account import ConnectedAccount
from app.models.recurring_expense import RecurringExpense
from app.schemas.notification import (
    NotificationType,
    NotificationPriority,
    NotificationCategory,
    AlertEvaluationResult,
    NotificationResponse,
)
from app.services.cash_flow_forecast_service import CashFlowForecastService
from app.services.budget_service import BudgetService
from app.services.goal_service import GoalService
from app.services.analytics_service import AnalyticsService
from app.services.financial_health_service import FinancialHealthService

logger = logging.getLogger("smart_alert_service")


class AlertCandidate:
    """Represents an evaluated candidate alert prior to deduplication and persistence."""

    def __init__(
        self,
        notification_type: str,
        priority: str,
        title: str,
        message: str,
        category: NotificationCategory,
        entity_type: Optional[str] = None,
        entity_id: Optional[str] = None,
        action_url: Optional[str] = None,
        dedupe_key: str = "",
        expires_at: Optional[datetime.datetime] = None,
        metadata_json: Optional[Dict[str, Any]] = None,
    ):
        self.notification_type = notification_type
        self.priority = priority
        self.title = title
        self.message = message
        self.category = category
        self.entity_type = entity_type
        self.entity_id = entity_id
        self.action_url = action_url
        self.dedupe_key = dedupe_key
        self.expires_at = expires_at
        self.metadata_json = metadata_json or {}


# ==============================================================================
# MODULAR ALERT RULES
# ==============================================================================

class BaseAlertRule:
    """Base interface for all modular financial alert rules."""
    category: NotificationCategory

    def evaluate(self, db: Session, user: User, now: datetime.datetime) -> List[AlertCandidate]:
        raise NotImplementedError


class ForecastAlertRule(BaseAlertRule):
    """Evaluates cash flow forecasting alerts: negative balance & safety buffer breach."""
    category = NotificationCategory.FORECAST

    def evaluate(self, db: Session, user: User, now: datetime.datetime) -> List[AlertCandidate]:
        candidates: List[AlertCandidate] = []
        try:
            forecast = CashFlowForecastService.compute_cash_flow_forecast(db, user.id, days=30)
            if forecast.data_sufficiency == "INSUFFICIENT" and not forecast.is_negative_projected and not forecast.is_low_balance_projected:
                return candidates

            # 1. Negative balance projected
            if forecast.is_negative_projected and forecast.negative_balance_date:
                proj_min = Decimal(str(forecast.minimum_projected_balance))
                date_str = str(forecast.negative_balance_date)
                candidates.append(
                    AlertCandidate(
                        notification_type=NotificationType.FORECAST_NEGATIVE_BALANCE.value,
                        priority=NotificationPriority.CRITICAL.value,
                        title="Negative Balance Forecasted",
                        message=f"Your cash flow forecast indicates your balance may drop negative to ₹{proj_min:,.2f} on {date_str}.",
                        category=self.category,
                        entity_type="forecast",
                        entity_id=date_str,
                        action_url="/forecast",
                        dedupe_key=f"forecast_negative:{user.id}:{date_str}",
                        expires_at=now + datetime.timedelta(days=30),
                        metadata_json={
                            "projected_minimum": str(proj_min),
                            "date": date_str,
                        },
                    )
                )

            # 2. Low balance below minimum threshold
            elif forecast.is_low_balance_projected and forecast.low_balance_date:
                proj_min = Decimal(str(forecast.minimum_projected_balance))
                threshold = Decimal(str(forecast.minimum_balance_threshold))
                date_str = str(forecast.low_balance_date)
                candidates.append(
                    AlertCandidate(
                        notification_type=NotificationType.FORECAST_LOW_BUFFER.value,
                        priority=NotificationPriority.HIGH.value,
                        title="Projected Low Safety Buffer",
                        message=f"Your projected balance falls to ₹{proj_min:,.2f} on {date_str}, dipping below your ₹{threshold:,.2f} minimum safety threshold.",
                        category=self.category,
                        entity_type="forecast",
                        entity_id=date_str,
                        action_url="/forecast",
                        dedupe_key=f"forecast_low_buffer:{user.id}:{date_str}",
                        expires_at=now + datetime.timedelta(days=30),
                        metadata_json={
                            "projected_minimum": str(proj_min),
                            "threshold": str(threshold),
                            "date": date_str,
                        },
                    )
                )

            # 3. Positive forecast outlook
            elif forecast.net_cash_flow > Decimal("0.00") and not forecast.is_low_balance_projected:
                # Monthly snapshot positive signal
                candidates.append(
                    AlertCandidate(
                        notification_type=NotificationType.POSITIVE_FORECAST.value,
                        priority=NotificationPriority.INFO.value,
                        title="Positive Cash Flow Outlook",
                        message=f"Your 30-day forecast projects a positive cash surplus (+₹{forecast.net_cash_flow:,.2f}) with balances comfortably above your buffer.",
                        category=NotificationCategory.POSITIVE,
                        entity_type="forecast",
                        action_url="/forecast",
                        dedupe_key=f"positive_forecast:{user.id}:{now.year}_{now.month}",
                        expires_at=now + datetime.timedelta(days=14),
                        metadata_json={"net_cash_flow": str(forecast.net_cash_flow)},
                    )
                )

        except Exception as exc:
            logger.warning(f"Error evaluating forecast alerts for user {user.id}: {exc}")

        return candidates


class BudgetAlertRule(BaseAlertRule):
    """Evaluates budget thresholds: budget exceeded and budget approaching cap."""
    category = NotificationCategory.BUDGET

    def evaluate(self, db: Session, user: User, now: datetime.datetime) -> List[AlertCandidate]:
        candidates: List[AlertCandidate] = []
        try:
            summary = BudgetService.get_summary(db, user.id, now.year, now.month)

            # Overall budget check
            if summary.overall is not None:
                if summary.overall.over_budget:
                    candidates.append(
                        AlertCandidate(
                            notification_type=NotificationType.BUDGET_EXCEEDED.value,
                            priority=NotificationPriority.HIGH.value,
                            title="Monthly Overall Budget Exceeded",
                            message=f"You have spent ₹{summary.overall.spent:,.2f} of your ₹{summary.overall.budget:,.2f} monthly overall budget ({summary.overall.utilization}%).",
                            category=self.category,
                            entity_type="budget",
                            action_url="/budgets",
                            dedupe_key=f"budget_exceeded:{user.id}:overall:{now.year}_{now.month}",
                            expires_at=now + datetime.timedelta(days=31),
                            metadata_json={
                                "budget": str(summary.overall.budget),
                                "spent": str(summary.overall.spent),
                                "utilization": str(summary.overall.utilization),
                            },
                        )
                    )
                elif summary.overall.utilization >= Decimal("80.0"):
                    candidates.append(
                        AlertCandidate(
                            notification_type=NotificationType.BUDGET_APPROACHING_LIMIT.value,
                            priority=NotificationPriority.MEDIUM.value,
                            title="Overall Budget Approaching Cap",
                            message=f"Overall spending has reached {summary.overall.utilization}% of your ₹{summary.overall.budget:,.2f} monthly budget.",
                            category=self.category,
                            entity_type="budget",
                            action_url="/budgets",
                            dedupe_key=f"budget_approaching:{user.id}:overall:{now.year}_{now.month}",
                            expires_at=now + datetime.timedelta(days=31),
                            metadata_json={"utilization": str(summary.overall.utilization)},
                        )
                    )
                elif now.day >= 15 and summary.overall.utilization <= Decimal("65.0"):
                    # Positive budget progress
                    candidates.append(
                        AlertCandidate(
                            notification_type=NotificationType.POSITIVE_BUDGET_PROGRESS.value,
                            priority=NotificationPriority.INFO.value,
                            title="Budget Spending on Track",
                            message=f"Great pacing! Past mid-month, you have only utilized {summary.overall.utilization}% of your planned budget.",
                            category=NotificationCategory.POSITIVE,
                            entity_type="budget",
                            action_url="/budgets",
                            dedupe_key=f"positive_budget:{user.id}:overall:{now.year}_{now.month}",
                            expires_at=now + datetime.timedelta(days=15),
                            metadata_json={"utilization": str(summary.overall.utilization)},
                        )
                    )

            # Category budgets check
            for cat in summary.category_budgets:
                clean_cat = cat.category.lower().replace(" ", "_")
                if cat.over_budget:
                    candidates.append(
                        AlertCandidate(
                            notification_type=NotificationType.BUDGET_EXCEEDED.value,
                            priority=NotificationPriority.HIGH.value,
                            title=f"{cat.category} Budget Exceeded",
                            message=f"Spending in {cat.category} (₹{cat.spent:,.2f}) has exceeded your allocated budget of ₹{cat.budget:,.2f} ({cat.utilization}%).",
                            category=self.category,
                            entity_type="budget",
                            entity_id=cat.category,
                            action_url="/budgets",
                            dedupe_key=f"budget_exceeded:{user.id}:{clean_cat}:{now.year}_{now.month}",
                            expires_at=now + datetime.timedelta(days=31),
                            metadata_json={
                                "category": cat.category,
                                "spent": str(cat.spent),
                                "budget": str(cat.budget),
                                "utilization": str(cat.utilization),
                            },
                        )
                    )
                elif cat.utilization >= Decimal("80.0"):
                    candidates.append(
                        AlertCandidate(
                            notification_type=NotificationType.BUDGET_APPROACHING_LIMIT.value,
                            priority=NotificationPriority.MEDIUM.value,
                            title=f"{cat.category} Budget Approaching Limit",
                            message=f"Spending in {cat.category} has reached {cat.utilization}% of your ₹{cat.budget:,.2f} budget limit.",
                            category=self.category,
                            entity_type="budget",
                            entity_id=cat.category,
                            action_url="/budgets",
                            dedupe_key=f"budget_approaching:{user.id}:{clean_cat}:{now.year}_{now.month}",
                            expires_at=now + datetime.timedelta(days=31),
                            metadata_json={
                                "category": cat.category,
                                "utilization": str(cat.utilization),
                            },
                        )
                    )

        except Exception as exc:
            logger.warning(f"Error evaluating budget alerts for user {user.id}: {exc}")

        return candidates


class GoalAlertRule(BaseAlertRule):
    """Evaluates goal progress, milestone completions, and at-risk deadlines."""
    category = NotificationCategory.GOALS

    def evaluate(self, db: Session, user: User, now: datetime.datetime) -> List[AlertCandidate]:
        candidates: List[AlertCandidate] = []
        try:
            goals = GoalService.get_goals(db, user.id)

            for g in goals:
                # 1. Goal Completed
                if g.current_amount >= g.target_amount or g.status == "completed":
                    candidates.append(
                        AlertCandidate(
                            notification_type=NotificationType.GOAL_COMPLETED.value,
                            priority=NotificationPriority.INFO.value,
                            title=f"Goal Completed: {g.name} 🎉",
                            message=f"Congratulations! You reached your savings target of ₹{g.target_amount:,.2f} for {g.name}.",
                            category=NotificationCategory.POSITIVE,
                            entity_type="goal",
                            entity_id=str(g.id),
                            action_url="/goals",
                            dedupe_key=f"goal_completed:{user.id}:{g.id}",
                            metadata_json={"target_amount": str(g.target_amount)},
                        )
                    )
                    continue

                # 2. Overdue / At risk
                if g.status == "overdue":
                    candidates.append(
                        AlertCandidate(
                            notification_type=NotificationType.GOAL_AT_RISK.value,
                            priority=NotificationPriority.HIGH.value,
                            title=f"Savings Goal Overdue: {g.name}",
                            message=f"The target date for {g.name} has passed. You have saved ₹{g.current_amount:,.2f} of ₹{g.target_amount:,.2f}.",
                            category=self.category,
                            entity_type="goal",
                            entity_id=str(g.id),
                            action_url="/goals",
                            dedupe_key=f"goal_overdue:{user.id}:{g.id}",
                            metadata_json={
                                "current_amount": str(g.current_amount),
                                "target_amount": str(g.target_amount),
                            },
                        )
                    )

                # 3. Milestones (25%, 50%, 75%)
                if g.target_amount > Decimal("0.00"):
                    pct = ((g.current_amount / g.target_amount) * Decimal("100")).quantize(Decimal("1.0"))
                    for milestone in [75, 50, 25]:
                        if pct >= milestone:
                            candidates.append(
                                AlertCandidate(
                                    notification_type=NotificationType.GOAL_MILESTONE.value,
                                    priority=NotificationPriority.INFO.value,
                                    title=f"Savings Milestone: {g.name} ({milestone}%)",
                                    message=f"You have reached {milestone}% of your target for {g.name} (₹{g.current_amount:,.2f} saved).",
                                    category=NotificationCategory.POSITIVE,
                                    entity_type="goal",
                                    entity_id=str(g.id),
                                    action_url="/goals",
                                    dedupe_key=f"goal_milestone:{user.id}:{g.id}:{milestone}",
                                    metadata_json={
                                        "milestone": milestone,
                                        "current_amount": str(g.current_amount),
                                    },
                                )
                            )
                            # Only record highest un-alerted milestone in single evaluation
                            break

        except Exception as exc:
            logger.warning(f"Error evaluating goal alerts for user {user.id}: {exc}")

        return candidates


class RecurringAlertRule(BaseAlertRule):
    """Evaluates upcoming recurring payment bills and overdue renewals."""
    category = NotificationCategory.RECURRING

    def evaluate(self, db: Session, user: User, now: datetime.datetime) -> List[AlertCandidate]:
        candidates: List[AlertCandidate] = []
        try:
            recurring_list = (
                db.query(RecurringExpense)
                .filter(
                    RecurringExpense.user_id == user.id,
                    RecurringExpense.status == "ACTIVE",
                )
                .all()
            )

            today_date = now.date()
            upcoming_horizon = today_date + datetime.timedelta(days=3)

            for rec in recurring_list:
                if not rec.next_expected_date:
                    continue

                rec_date = (
                    rec.next_expected_date.date()
                    if isinstance(rec.next_expected_date, datetime.datetime)
                    else rec.next_expected_date
                )

                # 1. Upcoming payment within 3 days
                if today_date <= rec_date <= upcoming_horizon:
                    date_str = str(rec_date)
                    amt = Decimal(str(rec.latest_amount or rec.average_amount))
                    candidates.append(
                        AlertCandidate(
                            notification_type=NotificationType.RECURRING_PAYMENT_UPCOMING.value,
                            priority=NotificationPriority.MEDIUM.value,
                            title=f"Upcoming Recurring Bill: {rec.merchant}",
                            message=f"Expected recurring commitment of ₹{amt:,.2f} for {rec.merchant} is due on {date_str}.",
                            category=self.category,
                            entity_type="recurring",
                            entity_id=str(rec.id),
                            action_url="/recurring",
                            dedupe_key=f"recurring_upcoming:{user.id}:{rec.id}:{date_str}",
                            expires_at=datetime.datetime.combine(
                                rec_date + datetime.timedelta(days=1),
                                datetime.time.max,
                                tzinfo=datetime.timezone.utc,
                            ),
                            metadata_json={
                                "merchant": rec.merchant,
                                "amount": str(amt),
                                "due_date": date_str,
                            },
                        )
                    )

                # 2. Overdue payment (missed renewal)
                elif rec_date < today_date:
                    date_str = str(rec_date)
                    amt = Decimal(str(rec.latest_amount or rec.average_amount))
                    candidates.append(
                        AlertCandidate(
                            notification_type=NotificationType.RECURRING_PAYMENT_MISSED.value,
                            priority=NotificationPriority.HIGH.value,
                            title=f"Overdue Bill Expected: {rec.merchant}",
                            message=f"Recurring payment of ₹{amt:,.2f} for {rec.merchant} was expected on {date_str} but has not yet been detected.",
                            category=self.category,
                            entity_type="recurring",
                            entity_id=str(rec.id),
                            action_url="/recurring",
                            dedupe_key=f"recurring_missed:{user.id}:{rec.id}:{date_str}",
                            expires_at=now + datetime.timedelta(days=14),
                            metadata_json={
                                "merchant": rec.merchant,
                                "amount": str(amt),
                                "expected_date": date_str,
                            },
                        )
                    )

                # 3. Price change detection
                if rec.max_amount and rec.min_amount and rec.max_amount > rec.min_amount:
                    diff_pct = ((rec.max_amount - rec.min_amount) / rec.min_amount) * Decimal("100")
                    if diff_pct >= Decimal("10.0"):
                        candidates.append(
                            AlertCandidate(
                                notification_type=NotificationType.RECURRING_PRICE_CHANGE.value,
                                priority=NotificationPriority.HIGH.value,
                                title=f"Price Change Detected: {rec.merchant}",
                                message=f"Recurring cost for {rec.merchant} changed by {diff_pct:.1f}% (now ₹{rec.latest_amount:,.2f}).",
                                category=self.category,
                                entity_type="recurring",
                                entity_id=str(rec.id),
                                action_url="/recurring",
                                dedupe_key=f"recurring_price_change:{user.id}:{rec.id}:{rec.latest_amount}",
                                expires_at=now + datetime.timedelta(days=30),
                                metadata_json={
                                    "merchant": rec.merchant,
                                    "latest_amount": str(rec.latest_amount),
                                    "percentage_change": str(diff_pct.quantize(Decimal("0.1"))),
                                },
                            )
                        )

        except Exception as exc:
            logger.warning(f"Error evaluating recurring alerts for user {user.id}: {exc}")

        return candidates


class BankAlertRule(BaseAlertRule):
    """Evaluates connected bank accounts for synchronization failures and staleness."""
    category = NotificationCategory.BANK

    def evaluate(self, db: Session, user: User, now: datetime.datetime) -> List[AlertCandidate]:
        candidates: List[AlertCandidate] = []
        try:
            accounts = (
                db.query(ConnectedAccount)
                .filter(ConnectedAccount.user_id == user.id)
                .all()
            )

            for acc in accounts:
                # 1. Sync failed
                if acc.last_sync_status == "FAILED" or acc.sync_retry_count >= 3:
                    candidates.append(
                        AlertCandidate(
                            notification_type=NotificationType.BANK_SYNC_FAILED.value,
                            priority=NotificationPriority.HIGH.value,
                            title=f"Bank Sync Issue: {acc.institution_name}",
                            message=f"Automated synchronization with {acc.institution_name} failed. Manual ledger records remain authoritative.",
                            category=self.category,
                            entity_type="bank_account",
                            entity_id=str(acc.id),
                            action_url="/connected-accounts",
                            dedupe_key=f"bank_sync_failed:{user.id}:{acc.id}:{acc.sync_retry_count}",
                            expires_at=now + datetime.timedelta(days=7),
                            metadata_json={"bank_name": acc.institution_name},
                        )
                    )

                # 2. Sync stale (> 24 hours without sync)
                elif acc.last_synced_at and (now - acc.last_synced_at) > datetime.timedelta(hours=24):
                    date_str = str(acc.last_synced_at.date())
                    candidates.append(
                        AlertCandidate(
                            notification_type=NotificationType.BANK_SYNC_STALE.value,
                            priority=NotificationPriority.MEDIUM.value,
                            title=f"Bank Connection Delayed: {acc.institution_name}",
                            message=f"Data for {acc.institution_name} has not synchronized recently (last sync: {date_str}). Tap to refresh connection.",
                            category=self.category,
                            entity_type="bank_account",
                            entity_id=str(acc.id),
                            action_url="/connected-accounts",
                            dedupe_key=f"bank_sync_stale:{user.id}:{acc.id}:{date_str}",
                            expires_at=now + datetime.timedelta(days=7),
                            metadata_json={"bank_name": acc.institution_name, "last_synced_at": date_str},
                        )
                    )

        except Exception as exc:
            logger.warning(f"Error evaluating bank alerts for user {user.id}: {exc}")

        return candidates


class SpendingAlertRule(BaseAlertRule):
    """Evaluates spending trends: month-over-month growth and extreme category concentration."""
    category = NotificationCategory.SPENDING

    def evaluate(self, db: Session, user: User, now: datetime.datetime) -> List[AlertCandidate]:
        candidates: List[AlertCandidate] = []
        try:
            monthly = AnalyticsService.get_monthly_analytics(db, user.id, now.year, now.month)
            if monthly.expense_change_percentage is not None and monthly.expense_change_percentage > 35.0:
                candidates.append(
                    AlertCandidate(
                        notification_type=NotificationType.SPENDING_HIGH_GROWTH.value,
                        priority=NotificationPriority.LOW.value,
                        title="Notable Increase in Spending",
                        message=f"Monthly spending has increased by {monthly.expense_change_percentage:.1f}% compared with last month.",
                        category=self.category,
                        entity_type="analytics",
                        action_url="/insights",
                        dedupe_key=f"spending_growth:{user.id}:{now.year}_{now.month}",
                        expires_at=now + datetime.timedelta(days=30),
                        metadata_json={"expense_change_pct": str(monthly.expense_change_percentage)},
                    )
                )

            # Concentration
            cat_spending = AnalyticsService.get_category_spending(db, user.id, now.year, now.month)
            if cat_spending and len(cat_spending.items) > 0:
                top_item = cat_spending.items[0]
                if top_item.percentage is not None and top_item.percentage >= Decimal("55.0") and top_item.amount > Decimal("1000.00"):
                    clean_cat = top_item.category.lower().replace(" ", "_")
                    candidates.append(
                        AlertCandidate(
                            notification_type=NotificationType.SPENDING_CONCENTRATION.value,
                            priority=NotificationPriority.LOW.value,
                            title=f"High Spending in {top_item.category}",
                            message=f"{top_item.category} accounts for {top_item.percentage:.1f}% of your monthly expenses (₹{top_item.amount:,.2f}).",
                            category=self.category,
                            entity_type="analytics",
                            entity_id=top_item.category,
                            action_url="/insights",
                            dedupe_key=f"spending_concentration:{user.id}:{clean_cat}:{now.year}_{now.month}",
                            expires_at=now + datetime.timedelta(days=30),
                            metadata_json={
                                "category": top_item.category,
                                "percentage": str(top_item.percentage),
                                "amount": str(top_item.amount),
                            },
                        )
                    )

        except Exception as exc:
            logger.warning(f"Error evaluating spending alerts for user {user.id}: {exc}")

        return candidates


class FinancialHealthAlertRule(BaseAlertRule):
    """Consumes Phase 14 verified Smart Actions with CRITICAL or HIGH priority."""
    category = NotificationCategory.FINANCIAL_HEALTH

    def evaluate(self, db: Session, user: User, now: datetime.datetime) -> List[AlertCandidate]:
        candidates: List[AlertCandidate] = []
        try:
            assessment = FinancialHealthService.evaluate_financial_health(db, user.id, now.year, now.month)
            if assessment.data_sufficiency == "INSUFFICIENT":
                return candidates

            for act in assessment.actions:
                p_val = act.priority.value if hasattr(act.priority, "value") else str(act.priority)
                if p_val in ("CRITICAL", "HIGH"):
                    notif_type = (
                        NotificationType.FINANCIAL_HEALTH_CRITICAL.value
                        if p_val == "CRITICAL"
                        else NotificationType.FINANCIAL_HEALTH_HIGH_PRIORITY.value
                    )
                    candidates.append(
                        AlertCandidate(
                            notification_type=notif_type,
                            priority=p_val,
                            title=act.title,
                            message=f"{act.description} {act.reason}".strip(),
                            category=self.category,
                            entity_type="financial_health",
                            entity_id=act.id,
                            action_url=act.action_url or "/financial-health",
                            dedupe_key=f"health_action:{user.id}:{act.id}",
                            expires_at=now + datetime.timedelta(days=14),
                            metadata_json={
                                "action_id": act.id,
                                "action_type": act.type.value if hasattr(act.type, "value") else str(act.type),
                                "supporting_metric": act.supporting_metric,
                                "recommended_next_step": act.recommended_next_step,
                            },
                        )
                    )

        except Exception as exc:
            logger.warning(f"Error evaluating financial health alerts for user {user.id}: {exc}")

        return candidates


# ==============================================================================
# SMART ALERT SERVICE ENGINE
# ==============================================================================

class SmartAlertService:
    """
    Coordinates modular alert rules, verifies user preferences, guarantees idempotency,
    and deduplicates notifications before database insertion.
    """

    RULES: List[Type[BaseAlertRule]] = [
        ForecastAlertRule,
        BudgetAlertRule,
        GoalAlertRule,
        RecurringAlertRule,
        BankAlertRule,
        SpendingAlertRule,
        FinancialHealthAlertRule,
    ]

    @classmethod
    def get_or_create_preference(cls, db: Session, user_id: int) -> NotificationPreference:
        pref = db.query(NotificationPreference).filter(NotificationPreference.user_id == user_id).first()
        if not pref:
            pref = NotificationPreference(user_id=user_id)
            db.add(pref)
            db.commit()
            db.refresh(pref)
        return pref

    @classmethod
    def is_category_enabled(cls, pref: NotificationPreference, category: NotificationCategory) -> bool:
        if not pref.smart_alerts_enabled:
            return False

        if category == NotificationCategory.FORECAST:
            return pref.forecast_alerts_enabled
        if category == NotificationCategory.BUDGET:
            return pref.budget_alerts_enabled
        if category == NotificationCategory.GOALS:
            return pref.goal_alerts_enabled
        if category == NotificationCategory.RECURRING:
            return pref.recurring_alerts_enabled
        if category == NotificationCategory.BANK:
            return pref.bank_alerts_enabled
        if category == NotificationCategory.SPENDING:
            return pref.spending_alerts_enabled
        if category == NotificationCategory.POSITIVE:
            return pref.positive_alerts_enabled
        if category == NotificationCategory.FINANCIAL_HEALTH:
            return pref.smart_alerts_enabled

        return True

    @classmethod
    def evaluate_user_alerts(cls, db: Session, user: User) -> AlertEvaluationResult:
        """
        Idempotently evaluates all alert rules for a specific user.
        Suppresses alerts if disabled by user preferences.
        Deduplicates against existing active notifications.
        """
        now = datetime.datetime.now(datetime.timezone.utc)
        pref = cls.get_or_create_preference(db, user.id)

        all_candidates: List[AlertCandidate] = []
        for rule_cls in cls.RULES:
            rule_instance = rule_cls()
            candidates = rule_instance.evaluate(db, user, now)
            all_candidates.extend(candidates)

        total_evaluated = len(all_candidates)
        created_count = 0
        skipped_dedupe = 0
        suppressed_count = 0
        created_responses: List[NotificationResponse] = []

        if not all_candidates:
            return AlertEvaluationResult(
                evaluated_count=0,
                created_count=0,
                skipped_dedupe_count=0,
                suppressed_count=0,
                created_notifications=[],
            )

        # Batch query existing dedupe keys to eliminate redundant individual lookups
        candidate_dedupes = [c.dedupe_key for c in all_candidates]
        existing_keys = set(
            row[0]
            for row in db.query(Notification.dedupe_key)
            .filter(
                Notification.user_id == user.id,
                Notification.dedupe_key.in_(candidate_dedupes),
            )
            .all()
        )

        for candidate in all_candidates:
            # Check user preference suppression
            if not cls.is_category_enabled(pref, candidate.category):
                suppressed_count += 1
                continue

            # Check deduplication
            if candidate.dedupe_key in existing_keys:
                skipped_dedupe += 1
                continue

            # Create new persistent notification
            notif = Notification(
                user_id=user.id,
                notification_type=candidate.notification_type,
                priority=candidate.priority,
                title=candidate.title,
                message=candidate.message,
                entity_type=candidate.entity_type,
                entity_id=candidate.entity_id,
                action_url=candidate.action_url,
                dedupe_key=candidate.dedupe_key,
                is_read=False,
                read_at=None,
                created_at=now,
                expires_at=candidate.expires_at,
                metadata_json=candidate.metadata_json,
            )
            db.add(notif)
            existing_keys.add(candidate.dedupe_key)
            created_count += 1

        if created_count > 0:
            db.commit()
            # Fetch newly created notifications for the response
            new_notifs = (
                db.query(Notification)
                .filter(Notification.user_id == user.id)
                .order_by(Notification.created_at.desc())
                .limit(created_count)
                .all()
            )
            created_responses = [NotificationResponse.model_validate(n) for n in new_notifs]

        return AlertEvaluationResult(
            evaluated_count=total_evaluated,
            created_count=created_count,
            skipped_dedupe_count=skipped_dedupe,
            suppressed_count=suppressed_count,
            created_notifications=created_responses,
        )

    @classmethod
    def evaluate_all_users_alerts(cls, db: Session) -> Dict[str, Any]:
        """
        Evaluate smart alerts for all active students.
        Invoked periodically by background scheduler or bank synchronization triggers.
        """
        active_users = db.query(User).filter(User.is_active.is_(True)).all()
        total_created = 0
        total_evaluated = 0
        for u in active_users:
            try:
                res = cls.evaluate_user_alerts(db, u)
                total_created += res.created_count
                total_evaluated += res.evaluated_count
            except Exception as exc:
                logger.warning(f"Error evaluating smart alerts for user {u.id}: {exc}")

        return {
            "users_evaluated": len(active_users),
            "total_candidates_evaluated": total_evaluated,
            "total_notifications_created": total_created,
        }

