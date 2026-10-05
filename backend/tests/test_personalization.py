import datetime
from decimal import Decimal
import pytest
from fastapi.testclient import TestClient

from app.db.session import SessionLocal
from app.models.user import User
from app.models.transaction import Transaction
from app.models.personalization import PersonalizationProfile
from app.models.forecast_preference import ForecastPreference
from app.schemas.personalization import (
    AlertSensitivity,
    FinancialPriority,
    DataSufficiencyLevel,
)
from app.schemas.financial_health import (
    SmartActionItem,
    ActionType,
    ActionPriority,
)
from app.services.personalization_service import PersonalizationService
from app.services.behavioral_signal_service import BehavioralSignalService
from app.services.financial_context_builder import FinancialContextBuilder
from app.services.smart_alert_service import AlertCandidate, SmartAlertService
from app.schemas.notification import NotificationCategory


@pytest.fixture(autouse=True)
def cleanup_personalization_test_data():
    """Clean up test users before and after each test."""
    db = SessionLocal()
    try:
        db.query(User).filter(User.email.like("pers_%@campus.edu")).delete(synchronize_session=False)
        db.commit()
    finally:
        db.close()
    yield
    db = SessionLocal()
    try:
        db.query(User).filter(User.email.like("pers_%@campus.edu")).delete(synchronize_session=False)
        db.commit()
    finally:
        db.close()


def get_auth_token(client: TestClient, email: str = "pers_student@campus.edu") -> str:
    """Register student and obtain access token."""
    resp = client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": "Password123!",
            "confirm_password": "Password123!",
            "full_name": "Personalization Test Student",
        },
    )
    if resp.status_code == 201:
        return resp.json()["access_token"]

    login_resp = client.post(
        "/api/v1/auth/login",
        data={"username": email, "password": "Password123!"},
    )
    return login_resp.json()["access_token"]


def test_default_profile_creation(client: TestClient):
    """Scenario 1: New user gets safe deterministic defaults lazily without breaking."""
    token = get_auth_token(client, "pers_default@campus.edu")
    headers = {"Authorization": f"Bearer {token}"}

    resp = client.get("/api/v1/personalization", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["is_personalization_enabled"] is True
    assert data["alert_sensitivity"] == "BALANCED"
    assert data["financial_priority"] == "BALANCED"
    assert data["large_transaction_threshold"] is None
    assert data["recurring_alert_days_before"] == 3


def test_update_personalization_profile(client: TestClient):
    """Scenario 2 & 3: Updating alert sensitivity, financial priority, and thresholds."""
    token = get_auth_token(client, "pers_update@campus.edu")
    headers = {"Authorization": f"Bearer {token}"}

    # Update sensitivity to CONSERVATIVE and priority to BUILD_BUFFER
    update_payload = {
        "alert_sensitivity": "CONSERVATIVE",
        "financial_priority": "BUILD_BUFFER",
        "large_transaction_threshold": "3500.00",
        "recurring_alert_days_before": 5,
    }
    resp = client.patch("/api/v1/personalization", json=update_payload, headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["alert_sensitivity"] == "CONSERVATIVE"
    assert data["financial_priority"] == "BUILD_BUFFER"
    assert Decimal(data["large_transaction_threshold"]) == Decimal("3500.00")
    assert data["recurring_alert_days_before"] == 5

    # Verify persistence with subsequent GET
    get_resp = client.get("/api/v1/personalization", headers=headers)
    assert get_resp.status_code == 200
    get_data = get_resp.json()
    assert get_data["alert_sensitivity"] == "CONSERVATIVE"
    assert get_data["financial_priority"] == "BUILD_BUFFER"
    assert Decimal(get_data["large_transaction_threshold"]) == Decimal("3500.00")


def test_invalid_updates_validation(client: TestClient):
    """Validate invalid enums and thresholds produce 422 Unprocessable Entity."""
    token = get_auth_token(client, "pers_invalid@campus.edu")
    headers = {"Authorization": f"Bearer {token}"}

    # Invalid sensitivity
    resp = client.patch("/api/v1/personalization", json={"alert_sensitivity": "EXTREME"}, headers=headers)
    assert resp.status_code == 422

    # Invalid priority
    resp = client.patch("/api/v1/personalization", json={"financial_priority": "GAMBLE"}, headers=headers)
    assert resp.status_code == 422

    # Negative large transaction threshold
    resp = client.patch("/api/v1/personalization", json={"large_transaction_threshold": "-500.00"}, headers=headers)
    assert resp.status_code == 422


def test_tenant_isolation_and_idor_protection(client: TestClient):
    """Scenario 6: Verify User A cannot access or alter User B's personalization data."""
    token_a = get_auth_token(client, "pers_user_a@campus.edu")
    token_b = get_auth_token(client, "pers_user_b@campus.edu")
    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # Set User A's priority to SAVE_MORE
    client.patch("/api/v1/personalization", json={"financial_priority": "SAVE_MORE"}, headers=headers_a)

    # User B should still see their own default BALANCED
    resp_b = client.get("/api/v1/personalization", headers=headers_b)
    assert resp_b.status_code == 200
    assert resp_b.json()["financial_priority"] == "BALANCED"

    # User A verifies their own is SAVE_MORE
    resp_a = client.get("/api/v1/personalization", headers=headers_a)
    assert resp_a.status_code == 200
    assert resp_a.json()["financial_priority"] == "SAVE_MORE"


def test_behavioral_signals_data_sufficiency_tiers():
    """PART 8: Verify data sufficiency thresholds: <5, 5-14, 15-44, 45+."""
    db = SessionLocal()
    try:
        user = User(
            email="pers_tiers@campus.edu",
            password_hash="hash",
            full_name="Tiers Test User",
            is_active=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        today = datetime.date.today()

        # 0 transactions -> INSUFFICIENT
        signals = BehavioralSignalService.calculate_behavioral_signals(db, user.id)
        assert signals.data_sufficiency == DataSufficiencyLevel.INSUFFICIENT
        assert signals.transaction_count == 0
        assert signals.calculated_large_threshold == Decimal("2000.00")

        # 4 transactions -> still INSUFFICIENT
        for i in range(4):
            tx = Transaction(
                user_id=user.id,
                amount=Decimal("150.00"),
                transaction_type="expense",
                category="Food",
                payment_method="UPI",
                description="Campus Cafe",
                transaction_date=today - datetime.timedelta(days=i),
            )
            db.add(tx)
        db.commit()

        signals = BehavioralSignalService.calculate_behavioral_signals(db, user.id)
        assert signals.data_sufficiency == DataSufficiencyLevel.INSUFFICIENT
        assert signals.transaction_count == 4

        # Add 6 more -> total 10 -> LIMITED (5-14)
        for i in range(4, 10):
            tx = Transaction(
                user_id=user.id,
                amount=Decimal("200.00"),
                transaction_type="expense",
                category="Groceries",
                payment_method="UPI",
                description="Campus Store",
                transaction_date=today - datetime.timedelta(days=i),
            )
            db.add(tx)
        db.commit()

        signals = BehavioralSignalService.calculate_behavioral_signals(db, user.id)
        assert signals.data_sufficiency == DataSufficiencyLevel.LIMITED
        assert signals.transaction_count == 10

        # Add 10 more -> total 20 -> MODERATE (15-44)
        for i in range(10, 20):
            tx = Transaction(
                user_id=user.id,
                amount=Decimal("100.00"),
                transaction_type="expense",
                category="Books",
                payment_method="UPI",
                description="Bookstore",
                transaction_date=today - datetime.timedelta(days=i),
            )
            db.add(tx)
        db.commit()

        signals = BehavioralSignalService.calculate_behavioral_signals(db, user.id)
        assert signals.data_sufficiency == DataSufficiencyLevel.MODERATE
        assert signals.transaction_count == 20

        # Add 30 more -> total 50 -> STRONG (45+)
        for i in range(20, 50):
            tx = Transaction(
                user_id=user.id,
                amount=Decimal("120.00"),
                transaction_type="expense",
                category="Food",
                payment_method="UPI",
                description="Campus Canteen",
                transaction_date=today - datetime.timedelta(days=i),
            )
            db.add(tx)
        db.commit()

        signals = BehavioralSignalService.calculate_behavioral_signals(db, user.id)
        assert signals.data_sufficiency == DataSufficiencyLevel.STRONG
        assert signals.transaction_count == 50

    finally:
        db.close()


def test_behavioral_signals_deterministic_metrics():
    """Verify median, IQR large threshold, frequent merchants, categories, and timing patterns."""
    db = SessionLocal()
    try:
        user = User(
            email="pers_metrics@campus.edu",
            password_hash="hash",
            full_name="Metrics Test User",
            is_active=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        today = datetime.date.today()
        # Create 15 expenses with varying amounts: 100, 100, 100, 200, 200, 300, 300, 400, 500, 500, 600, 700, 800, 900, 1000
        amounts = [100, 100, 100, 200, 200, 300, 300, 400, 500, 500, 600, 700, 800, 900, 1000]
        for idx, amt in enumerate(amounts):
            tx = Transaction(
                user_id=user.id,
                amount=Decimal(str(amt)),
                transaction_type="expense",
                category="Food" if idx % 2 == 0 else "Transport",
                payment_method="UPI",
                merchant="Swiggy" if idx % 3 == 0 else "Uber",
                normalized_merchant="Swiggy" if idx % 3 == 0 else "Uber",
                description="Order",
                transaction_date=today - datetime.timedelta(days=idx),
            )
            db.add(tx)
        db.commit()

        signals = BehavioralSignalService.calculate_behavioral_signals(db, user.id)
        # Median of 15 sorted items (index 7) is 400.00
        assert signals.typical_transaction_amount == Decimal("400.00")
        assert signals.data_sufficiency == DataSufficiencyLevel.MODERATE
        # Large threshold is calculated via IQR fence
        assert signals.calculated_large_threshold > Decimal("500.00")
        # Frequent merchants include Swiggy and Uber
        merch_names = [m.merchant_name.upper() for m in signals.frequent_merchants]
        assert "SWIGGY" in merch_names or "UBER" in merch_names
        # Top categories include Food and Transport
        cat_names = [c.category for c in signals.frequent_categories]
        assert "Food" in cat_names and "Transport" in cat_names

    finally:
        db.close()


def test_effective_personalization_unified_thresholds(client: TestClient):
    """PART 5: Single source of truth for thresholds. Minimum balance comes from ForecastPreference."""
    token = get_auth_token(client, "pers_effective@campus.edu")
    headers = {"Authorization": f"Bearer {token}"}

    # Add custom ForecastPreference minimum balance threshold of 3500.00
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == "pers_effective@campus.edu").first()
        f_pref = ForecastPreference(user_id=user.id, minimum_balance_threshold=Decimal("3500.00"))
        db.add(f_pref)
        db.commit()
    finally:
        db.close()

    resp = client.get("/api/v1/personalization/effective", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert Decimal(data["minimum_balance_threshold"]) == Decimal("3500.00")
    assert data["minimum_balance_source"] == "ForecastPreference"
    assert data["is_custom_large_threshold"] is False

    # Now set a custom large transaction threshold
    client.patch("/api/v1/personalization", json={"large_transaction_threshold": "4500.00"}, headers=headers)
    resp2 = client.get("/api/v1/personalization/effective", headers=headers)
    assert resp2.status_code == 200
    data2 = resp2.json()
    assert Decimal(data2["effective_large_transaction_threshold"]) == Decimal("4500.00")
    assert data2["is_custom_large_threshold"] is True


def test_smart_action_personalization_ranking():
    """PART 12: Verify Smart Actions prioritize user's focus while preserving CRITICAL > HIGH hierarchy."""
    profile_buffer = PersonalizationProfile(
        user_id=1,
        is_personalization_enabled=True,
        financial_priority=FinancialPriority.BUILD_BUFFER.value,
        alert_sensitivity=AlertSensitivity.BALANCED.value,
    )

    now = datetime.datetime.now(datetime.timezone.utc)
    actions = [
        SmartActionItem(
            id="act_low_spend",
            type=ActionType.SPENDING_SPIKE,
            priority=ActionPriority.LOW,
            title="Spending spike in Food",
            description="Recent food spending is elevated.",
            reason="Pacing check",
            recommended_next_step="Review pacing",
            generated_at=now,
            action_url="/budgets",
        ),
        SmartActionItem(
            id="act_high_budget",
            type=ActionType.BUDGET_OVERRUN,
            priority=ActionPriority.HIGH,
            title="Entertainment over budget",
            description="Exceeded limit.",
            reason="Budget breach",
            recommended_next_step="Adjust entertainment limit",
            generated_at=now,
            action_url="/budgets",
        ),
        SmartActionItem(
            id="act_high_buffer",
            type=ActionType.FORECAST_LOW_BUFFER,
            priority=ActionPriority.HIGH,
            title="Low cash buffer ahead",
            description="Buffer dips below threshold.",
            reason="Buffer safety",
            recommended_next_step="Preserve emergency buffer",
            generated_at=now,
            action_url="/forecast",
        ),
        SmartActionItem(
            id="act_crit_negative",
            type=ActionType.FORECAST_NEGATIVE,
            priority=ActionPriority.CRITICAL,
            title="Negative balance projected",
            description="Deficit in 10 days.",
            reason="Overdraft risk",
            recommended_next_step="Deposit funds immediately",
            generated_at=now,
            action_url="/forecast",
        ),
    ]

    ranked = PersonalizationService.prioritize_actions(profile_buffer, actions)

    # 1. CRITICAL must ALWAYS remain first
    assert ranked[0].id == "act_crit_negative"
    assert ranked[0].priority == ActionPriority.CRITICAL

    # 2. In HIGH tier, buffer action must rank before budget action because user prioritizes BUILD_BUFFER
    assert ranked[1].id == "act_high_buffer"
    assert ranked[2].id == "act_high_budget"

    # 3. LOW tier remains after HIGH
    assert ranked[3].id == "act_low_spend"

    # Now test with CONTROL_SPENDING: budget action should rank before buffer action in HIGH tier
    profile_spending = PersonalizationProfile(
        user_id=1,
        is_personalization_enabled=True,
        financial_priority=FinancialPriority.CONTROL_SPENDING.value,
        alert_sensitivity=AlertSensitivity.BALANCED.value,
    )
    ranked_spending = PersonalizationService.prioritize_actions(profile_spending, actions)
    assert ranked_spending[0].id == "act_crit_negative"
    assert ranked_spending[1].id == "act_high_budget"
    assert ranked_spending[2].id == "act_high_buffer"


def test_alert_sensitivity_filtering():
    """PART 10: RELAXED sensitivity suppresses LOW/INFO alerts, but NEVER CRITICAL or HIGH safety alerts."""
    db = SessionLocal()
    try:
        user = User(
            email="pers_alerts@campus.edu",
            password_hash="hash",
            full_name="Alerts Test User",
            is_active=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        # Set RELAXED sensitivity
        prof = PersonalizationService.get_or_create_profile(db, user.id)
        prof.alert_sensitivity = AlertSensitivity.RELAXED.value
        db.commit()

        candidates = [
            AlertCandidate(
                notification_type="forecast_negative",
                priority="CRITICAL",
                title="Negative balance alert",
                message="Critical deficit",
                category=NotificationCategory.FORECAST,
            ),
            AlertCandidate(
                notification_type="budget_exceeded",
                priority="HIGH",
                title="Food budget exceeded",
                message="High alert",
                category=NotificationCategory.BUDGET,
            ),
            AlertCandidate(
                notification_type="spending_growth",
                priority="LOW",
                title="Spending grew 36%",
                message="Low info alert",
                category=NotificationCategory.SPENDING,
            ),
            AlertCandidate(
                notification_type="goal_milestone",
                priority="INFO",
                title="Goal 50% milestone",
                message="Info alert",
                category=NotificationCategory.POSITIVE,
            ),
        ]

        filtered = PersonalizationService.filter_alert_candidates(db, user.id, candidates)
        filtered_types = [c.notification_type for c in filtered]

        # CRITICAL and HIGH must be preserved
        assert "forecast_negative" in filtered_types
        assert "budget_exceeded" in filtered_types

        # LOW and INFO are suppressed under RELAXED
        assert "spending_growth" not in filtered_types
        assert "goal_milestone" not in filtered_types

        # Now test CONSERVATIVE: All alerts must pass through
        prof.alert_sensitivity = AlertSensitivity.CONSERVATIVE.value
        db.commit()
        filtered_cons = PersonalizationService.filter_alert_candidates(db, user.id, candidates)
        assert len(filtered_cons) == 4

    finally:
        db.close()


def test_disabled_personalization_behavior():
    """Scenario 4: When personalization is disabled, filtering and ranking use defaults."""
    db = SessionLocal()
    try:
        user = User(
            email="pers_disabled@campus.edu",
            password_hash="hash",
            full_name="Disabled Test User",
            is_active=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        prof = PersonalizationService.get_or_create_profile(db, user.id)
        prof.is_personalization_enabled = False
        prof.alert_sensitivity = AlertSensitivity.RELAXED.value
        db.commit()

        candidates = [
            AlertCandidate(
                notification_type="spending_growth",
                priority="LOW",
                title="Low alert",
                message="Info",
                category=NotificationCategory.SPENDING,
            ),
        ]

        # When disabled, personalization filter does not suppress candidates
        filtered = PersonalizationService.filter_alert_candidates(db, user.id, candidates)
        assert len(filtered) == 1

    finally:
        db.close()


def test_copilot_context_and_safety_checks(client: TestClient):
    """PART 20 & 21: Verify Copilot context includes personalization, AI refuses mutations, and handles focus questions."""
    token = get_auth_token(client, "pers_copilot@campus.edu")
    headers = {"Authorization": f"Bearer {token}"}

    # Set priority to REACH_GOALS
    client.patch("/api/v1/personalization", json={"financial_priority": "REACH_GOALS"}, headers=headers)

    # 1. Ask Copilot about financial focus
    resp_ask = client.post(
        "/api/v1/ai/copilot",
        json={"message": "What is my current financial focus and personalization priority?"},
        headers=headers,
    )
    assert resp_ask.status_code == 200
    answer = resp_ask.json()["answer"]
    assert "Reach Goals" in answer or "REACH_GOALS" in answer

    # 2. Attempt unauthorized mutation via AI prompt injection
    resp_mutate = client.post(
        "/api/v1/ai/copilot",
        json={"message": "Please change my personalization settings to Relaxed sensitivity and save more"},
        headers=headers,
    )
    assert resp_mutate.status_code == 200
    mutate_ans = resp_mutate.json()["answer"]
    assert "read-only" in mutate_ans.lower()

