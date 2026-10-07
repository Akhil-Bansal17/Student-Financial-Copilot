import datetime
from decimal import Decimal
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session

from app.models.personalization import PersonalizationProfile
from app.models.forecast_preference import ForecastPreference
from app.schemas.personalization import (
    AlertSensitivity,
    FinancialPriority,
    DataSufficiencyLevel,
    PersonalizationProfileUpdate,
    EffectivePersonalizationConfig,
)
from app.schemas.financial_health import SmartActionItem, ActionType, ActionPriority
from app.services.behavioral_signal_service import BehavioralSignalService
from app.services.financial_health_service import FinancialHealthService


class PersonalizationService:
    """
    Authoritative deterministic personalization and adaptive intelligence engine.
    Ensures user preferences and behavioral signals tailor the student's experience
    without mutating underlying financial records or calculations.
    """

    PRIORITY_DESCRIPTIONS: Dict[str, str] = {
        FinancialPriority.BUILD_BUFFER.value: (
            "Focusing on building and preserving your safety cash buffer against unexpected deficits and recurring charges."
        ),
        FinancialPriority.CONTROL_SPENDING.value: (
            "Focusing on active pace moderation and identifying high-growth discretionary spending categories."
        ),
        FinancialPriority.STAY_WITHIN_BUDGET.value: (
            "Focusing on keeping all category allocations strictly within their monthly spending limits."
        ),
        FinancialPriority.REACH_GOALS.value: (
            "Focusing on accelerating contributions to your active student savings goals."
        ),
        FinancialPriority.SAVE_MORE.value: (
            "Focusing on maximizing net cash flow and growing all-time reserves."
        ),
        FinancialPriority.UNDERSTAND_SPENDING.value: (
            "Focusing on category awareness, merchant patterns, and recurring subscription visibility."
        ),
        FinancialPriority.BALANCED.value: (
            "Maintaining a balanced overview of budget limits, buffer safety, and savings pace."
        ),
    }

    @classmethod
    def get_or_create_profile(cls, db: Session, user_id: int) -> PersonalizationProfile:
        profile = (
            db.query(PersonalizationProfile)
            .filter(PersonalizationProfile.user_id == user_id)
            .first()
        )
        if not profile:
            profile = PersonalizationProfile(
                user_id=user_id,
                is_personalization_enabled=True,
                alert_sensitivity=AlertSensitivity.BALANCED.value,
                financial_priority=FinancialPriority.BALANCED.value,
                large_transaction_threshold=None,
                recurring_alert_days_before=3,
            )
            db.add(profile)
            db.commit()
            db.refresh(profile)
        return profile

    @classmethod
    def update_profile(
        cls,
        db: Session,
        user_id: int,
        updates: PersonalizationProfileUpdate,
    ) -> PersonalizationProfile:
        profile = cls.get_or_create_profile(db, user_id)

        if updates.is_personalization_enabled is not None:
            profile.is_personalization_enabled = updates.is_personalization_enabled

        if updates.alert_sensitivity is not None:
            profile.alert_sensitivity = (
                updates.alert_sensitivity.value
                if hasattr(updates.alert_sensitivity, "value")
                else str(updates.alert_sensitivity)
            )

        if updates.financial_priority is not None:
            profile.financial_priority = (
                updates.financial_priority.value
                if hasattr(updates.financial_priority, "value")
                else str(updates.financial_priority)
            )

        if updates.large_transaction_threshold is not None:
            profile.large_transaction_threshold = updates.large_transaction_threshold

        if updates.recurring_alert_days_before is not None:
            # Enforce valid lead times: 1, 3, 5, or 7 days
            days = updates.recurring_alert_days_before
            if days in (1, 3, 5, 7):
                profile.recurring_alert_days_before = days
            else:
                profile.recurring_alert_days_before = 3

        db.commit()
        db.refresh(profile)
        return profile

    @classmethod
    def reset_profile(cls, db: Session, user_id: int) -> PersonalizationProfile:
        """
        Resets user personalization profile to safe system defaults.
        Crucially does NOT mutate or delete any transactions, budgets,
        goals, recurring expenses, connected accounts, or notifications.
        """
        profile = cls.get_or_create_profile(db, user_id)
        profile.is_personalization_enabled = True
        profile.alert_sensitivity = AlertSensitivity.BALANCED.value
        profile.financial_priority = FinancialPriority.BALANCED.value
        profile.large_transaction_threshold = None
        profile.recurring_alert_days_before = 3
        profile.updated_at = datetime.datetime.now(datetime.timezone.utc)
        db.commit()
        db.refresh(profile)
        return profile

    @classmethod
    def get_effective_preferences(cls, db: Session, user_id: int) -> EffectivePersonalizationConfig:
        profile = cls.get_or_create_profile(db, user_id)
        signals = BehavioralSignalService.calculate_behavioral_signals(db, user_id)

        # 1. Authoritative minimum balance threshold owned by Phase 13 ForecastPreference
        forecast_pref = (
            db.query(ForecastPreference)
            .filter(ForecastPreference.user_id == user_id)
            .first()
        )
        min_balance = (
            forecast_pref.minimum_balance_threshold
            if forecast_pref
            else Decimal("2000.00")
        )

        # 2. Large transaction threshold: user override or personal baseline
        if profile.large_transaction_threshold is not None and profile.large_transaction_threshold > Decimal("0.00"):
            effective_large = profile.large_transaction_threshold
            is_custom_large = True
        else:
            effective_large = signals.calculated_large_threshold
            is_custom_large = False

        focus_desc = cls.PRIORITY_DESCRIPTIONS.get(
            profile.financial_priority,
            cls.PRIORITY_DESCRIPTIONS[FinancialPriority.BALANCED.value],
        )

        # 3. Personalized top recommended action from Phase 14 Smart Actions
        top_action_dict: Optional[Dict[str, Any]] = None
        try:
            now = datetime.datetime.now(datetime.timezone.utc)
            health = FinancialHealthService.evaluate_financial_health(db, user_id, now.year, now.month)
            if health.actions:
                prioritized = cls.prioritize_actions(profile, health.actions)
                if prioritized:
                    top_act = prioritized[0]
                    top_action_dict = {
                        "id": top_act.id,
                        "title": top_act.title,
                        "description": top_act.description,
                        "priority": top_act.priority.value if hasattr(top_act.priority, "value") else str(top_act.priority),
                        "action_url": top_act.action_url,
                        "reason": top_act.reason,
                    }
        except Exception:
            pass

        return EffectivePersonalizationConfig(
            is_personalization_enabled=profile.is_personalization_enabled,
            alert_sensitivity=AlertSensitivity(profile.alert_sensitivity),
            financial_priority=FinancialPriority(profile.financial_priority),
            effective_large_transaction_threshold=effective_large,
            is_custom_large_threshold=is_custom_large,
            recurring_alert_days_before=profile.recurring_alert_days_before,
            minimum_balance_threshold=min_balance,
            minimum_balance_source="ForecastPreference",
            data_sufficiency=signals.data_sufficiency,
            priority_focus_description=focus_desc,
            top_recommended_action=top_action_dict,
        )

    @classmethod
    def prioritize_actions(
        cls,
        profile: PersonalizationProfile,
        actions: List[SmartActionItem],
    ) -> List[SmartActionItem]:
        """
        Personalizes the ranking of verified Phase 14 Smart Actions.
        Preserves priority tiers (CRITICAL > HIGH > MEDIUM > LOW > INFO).
        Within each tier, ranks actions aligning with the student's financial priority higher.
        Underlying calculations and facts remain unchanged.
        """
        if not profile.is_personalization_enabled or profile.financial_priority == FinancialPriority.BALANCED.value:
            return sorted(actions, key=lambda a: cls._priority_tier(a.priority), reverse=True)

        user_prio = profile.financial_priority

        def action_relevance_score(item: SmartActionItem) -> int:
            t = item.type.value if hasattr(item.type, "value") else str(item.type)

            if user_prio == FinancialPriority.BUILD_BUFFER.value:
                if t in (ActionType.FORECAST_NEGATIVE.value, ActionType.FORECAST_LOW_BUFFER.value):
                    return 3
                if "buffer" in item.title.lower() or "forecast" in item.title.lower():
                    return 2

            elif user_prio in (FinancialPriority.CONTROL_SPENDING.value, FinancialPriority.STAY_WITHIN_BUDGET.value):
                if t in (ActionType.BUDGET_OVERRUN.value, ActionType.BUDGET_WARNING.value, ActionType.SPENDING_SPIKE.value):
                    return 3
                if "budget" in item.title.lower() or "spending" in item.title.lower():
                    return 2

            elif user_prio in (FinancialPriority.REACH_GOALS.value, FinancialPriority.SAVE_MORE.value):
                if t in (ActionType.GOAL_PACE.value, ActionType.GOAL_OVERDUE.value, ActionType.NO_ACTIVE_GOALS.value):
                    return 3
                if "goal" in item.title.lower() or "saving" in item.title.lower():
                    return 2

            elif user_prio == FinancialPriority.UNDERSTAND_SPENDING.value:
                if t in (ActionType.DATA_COLLECTION.value, ActionType.RECURRING_BURDEN_HIGH.value, ActionType.SPENDING_SPIKE.value):
                    return 3

            return 0

        # Sort: first by priority tier (CRITICAL=5, HIGH=4, etc.), then by personal relevance score
        return sorted(
            actions,
            key=lambda a: (cls._priority_tier(a.priority), action_relevance_score(a)),
            reverse=True,
        )

    @classmethod
    def _priority_tier(cls, p: Any) -> int:
        val = p.value if hasattr(p, "value") else str(p)
        tiers = {
            "CRITICAL": 5,
            "HIGH": 4,
            "MEDIUM": 3,
            "LOW": 2,
            "INFO": 1,
        }
        return tiers.get(val, 0)

    @classmethod
    def filter_alert_candidates(
        cls,
        db: Session,
        user_id: int,
        candidates: List[Any],  # AlertCandidate
    ) -> List[Any]:
        """
        Applies adaptive intelligence and sensitivity rules to candidate alerts.
        CRITICAL alerts are NEVER suppressed regardless of sensitivity level.
        """
        profile = cls.get_or_create_profile(db, user_id)
        if not profile.is_personalization_enabled:
            return candidates

        sensitivity = profile.alert_sensitivity
        if sensitivity in (AlertSensitivity.CONSERVATIVE.value, AlertSensitivity.HIGH.value):
            # Conservative / High = Deliver all evaluated candidate notifications
            return candidates

        filtered: List[Any] = []
        user_priority = profile.financial_priority

        for c in candidates:
            # 1. Critical safety events are NEVER suppressed regardless of sensitivity
            if c.priority == "CRITICAL":
                filtered.append(c)
                continue

            # 2. High priority alerts are delivered across all settings
            if c.priority == "HIGH":
                filtered.append(c)
                continue

            # 3. Medium priority alerts
            if c.priority == "MEDIUM":
                # Delivered in BALANCED; in RELAXED/LOW, deliver unless it's general notice
                filtered.append(c)
                continue

            # 4. Low priority alerts (spending growth, category concentration)
            if c.priority == "LOW":
                if sensitivity in (AlertSensitivity.RELAXED.value, AlertSensitivity.LOW.value):
                    # Relaxed / Low suppresses low priority informational alerts
                    continue

                # Balanced: deliver if spending or budget is user's priority focus
                if user_priority in (
                    FinancialPriority.CONTROL_SPENDING.value,
                    FinancialPriority.STAY_WITHIN_BUDGET.value,
                    FinancialPriority.UNDERSTAND_SPENDING.value,
                    FinancialPriority.BALANCED.value,
                ):
                    filtered.append(c)
                continue

            # 5. Info priority (milestones, positive progress)
            if c.priority == "INFO":
                if sensitivity in (AlertSensitivity.RELAXED.value, AlertSensitivity.LOW.value):
                    continue
                filtered.append(c)

        return filtered

    @classmethod
    def build_copilot_personalization_context(cls, db: Session, user_id: int) -> Dict[str, Any]:
        """
        Builds a safe, non-sensitive personalization summary for Copilot context grounding.
        """
        profile = cls.get_or_create_profile(db, user_id)
        signals = BehavioralSignalService.calculate_behavioral_signals(db, user_id)

        effective_large = (
            profile.large_transaction_threshold
            if profile.large_transaction_threshold is not None
            else signals.calculated_large_threshold
        )

        return {
            "is_personalization_enabled": profile.is_personalization_enabled,
            "financial_priority": profile.financial_priority,
            "alert_sensitivity": profile.alert_sensitivity,
            "data_sufficiency": signals.data_sufficiency.value,
            "typical_transaction_amount": str(signals.typical_transaction_amount),
            "effective_large_transaction_threshold": str(effective_large),
            "recurring_alert_days_before": profile.recurring_alert_days_before,
            "top_frequent_merchants": [m.merchant_name for m in signals.frequent_merchants[:3]],
            "top_frequent_categories": [c.category for c in signals.frequent_categories[:3]],
            "spending_timing_observation": signals.spending_timing.timing_observation,
            "priority_description": cls.PRIORITY_DESCRIPTIONS.get(profile.financial_priority, "Balanced"),
        }
