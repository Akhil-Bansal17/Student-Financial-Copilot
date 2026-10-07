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
from app.models.budget import Budget
from app.models.goal import Goal
from app.models.recurring_expense import RecurringExpense
from app.models.account import ConnectedAccount
from app.models.notification import Notification
from app.models.merchant_preference import MerchantCategoryPreference
from app.services.merchant_preference_service import MerchantPreferenceService
from app.services.personalization_service import PersonalizationService
from app.services.behavioral_signal_service import BehavioralSignalService
from app.services.financial_context_builder import FinancialContextBuilder
from app.services.smart_alert_service import AlertCandidate, SmartAlertService
from app.schemas.notification import NotificationCategory, NotificationType, NotificationPriority


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


def test_reset_personalization_profile_restores_defaults_without_data_loss(client: TestClient):
    """
    SECTION 15 AUDIT:
    set custom preferences -> reset -> defaults restored.
    Verify reset does NOT delete transactions, budgets, goals, recurring expenses, bank accounts, or notifications.
    """
    token = get_auth_token(client, "pers_reset@campus.edu")
    headers = {"Authorization": f"Bearer {token}"}

    db = SessionLocal()
    user_id = None
    try:
        user = db.query(User).filter(User.email == "pers_reset@campus.edu").first()
        assert user is not None
        user_id = user.id

        # Populate user data across other subsystems
        tx = Transaction(
            user_id=user.id,
            amount=Decimal("250.00"),
            transaction_type="expense",
            category="Food",
            payment_method="UPI",
            description="Lunch",
            transaction_date=datetime.date.today(),
        )
        bg = Budget(
            user_id=user.id,
            category="Food",
            amount=Decimal("5000.00"),
            month=datetime.date.today().month,
            year=datetime.date.today().year,
        )
        gl = Goal(
            user_id=user.id,
            name="Emergency Fund",
            target_amount=Decimal("10000.00"),
            current_amount=Decimal("2000.00"),
            target_date=datetime.date.today() + datetime.timedelta(days=90),
        )
        now_dt = datetime.datetime.now(datetime.timezone.utc)
        rec = RecurringExpense(
            user_id=user.id,
            merchant="Netflix",
            normalized_merchant="Netflix",
            category="Entertainment",
            latest_amount=Decimal("499.00"),
            average_amount=Decimal("499.00"),
            min_amount=Decimal("499.00"),
            max_amount=Decimal("499.00"),
            frequency="MONTHLY",
            last_occurrence_date=now_dt - datetime.timedelta(days=30),
            next_expected_date=now_dt + datetime.timedelta(days=3),
        )
        acc = ConnectedAccount(
            user_id=user.id,
            institution_name="Test Bank",
            provider="sandbox",
            provider_account_id=f"acc_{user.id}_9999",
            masked_account_number="xxxx9999",
            account_type="savings",
            current_balance=Decimal("15000.00"),
        )
        notif = Notification(
            user_id=user.id,
            notification_type="general",
            priority="LOW",
            title="Welcome",
            message="Welcome test",
            dedupe_key=f"welcome:{user.id}",
        )
        db.add_all([tx, bg, gl, rec, acc, notif])
        db.commit()
    finally:
        db.close()

    # 1. Mutate personalization preferences to custom values
    custom_payload = {
        "is_personalization_enabled": False,
        "alert_sensitivity": "CONSERVATIVE",
        "financial_priority": "SAVE_MORE",
        "large_transaction_threshold": "6000.00",
        "recurring_alert_days_before": 7,
    }
    update_resp = client.patch("/api/v1/personalization", json=custom_payload, headers=headers)
    assert update_resp.status_code == 200
    u_data = update_resp.json()
    assert u_data["is_personalization_enabled"] is False
    assert u_data["financial_priority"] == "SAVE_MORE"
    assert u_data["alert_sensitivity"] == "CONSERVATIVE"
    assert Decimal(u_data["large_transaction_threshold"]) == Decimal("6000.00")
    assert u_data["recurring_alert_days_before"] == 7

    # 2. Call Reset endpoint
    reset_resp = client.post("/api/v1/personalization/reset", headers=headers)
    assert reset_resp.status_code == 200
    r_data = reset_resp.json()
    assert r_data["is_personalization_enabled"] is True
    assert r_data["alert_sensitivity"] == "BALANCED"
    assert r_data["financial_priority"] == "BALANCED"
    assert r_data["large_transaction_threshold"] is None
    assert r_data["recurring_alert_days_before"] == 3

    # 3. Verify ALL existing records remain completely untouched!
    db = SessionLocal()
    try:
        assert db.query(Transaction).filter(Transaction.user_id == user_id).count() == 1
        assert db.query(Budget).filter(Budget.user_id == user_id).count() == 1
        assert db.query(Goal).filter(Goal.user_id == user_id).count() == 1
        assert db.query(RecurringExpense).filter(RecurringExpense.user_id == user_id).count() == 1
        assert db.query(ConnectedAccount).filter(ConnectedAccount.user_id == user_id).count() == 1
        assert db.query(Notification).filter(Notification.user_id == user_id).count() == 1
    finally:
        db.close()


def test_all_financial_focus_priorities(client: TestClient):
    """Verify all valid Financial Priorities persist, and invalid inputs fail gracefully."""
    token = get_auth_token(client, "pers_priorities@campus.edu")
    headers = {"Authorization": f"Bearer {token}"}

    valid_priorities = [
        "SAVE_MORE",
        "CONTROL_SPENDING",
        "STAY_WITHIN_BUDGET",
        "BUILD_BUFFER",
        "REACH_GOALS",
        "UNDERSTAND_SPENDING",
        "BALANCED",
    ]

    for p in valid_priorities:
        resp = client.patch("/api/v1/personalization", json={"financial_priority": p}, headers=headers)
        assert resp.status_code == 200
        assert resp.json()["financial_priority"] == p

    # Invalid priority
    bad_resp = client.patch("/api/v1/personalization", json={"financial_priority": "CRYPTO_YOLO"}, headers=headers)
    assert bad_resp.status_code == 422


def test_alert_sensitivity_low_balanced_high_and_critical_protection(client: TestClient):
    """
    SECTION 4 & 14 AUDIT:
    Verify LOW, BALANCED, HIGH are supported, and LOW sensitivity NEVER suppresses CRITICAL events.
    """
    token = get_auth_token(client, "pers_sensitivity@campus.edu")
    headers = {"Authorization": f"Bearer {token}"}

    # LOW sensitivity
    resp_low = client.patch("/api/v1/personalization", json={"alert_sensitivity": "LOW"}, headers=headers)
    assert resp_low.status_code == 200
    assert resp_low.json()["alert_sensitivity"] == "LOW"

    # HIGH sensitivity
    resp_high = client.patch("/api/v1/personalization", json={"alert_sensitivity": "HIGH"}, headers=headers)
    assert resp_high.status_code == 200
    assert resp_high.json()["alert_sensitivity"] == "HIGH"

    # BALANCED sensitivity
    resp_bal = client.patch("/api/v1/personalization", json={"alert_sensitivity": "BALANCED"}, headers=headers)
    assert resp_bal.status_code == 200
    assert resp_bal.json()["alert_sensitivity"] == "BALANCED"

    # Now verify CRITICAL alert protection under LOW sensitivity
    client.patch("/api/v1/personalization", json={"alert_sensitivity": "LOW"}, headers=headers)

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == "pers_sensitivity@campus.edu").first()
        candidates = [
            AlertCandidate(
                notification_type="forecast_negative",
                priority="CRITICAL",
                title="Negative balance alert",
                message="Critical deficit warning",
                category=NotificationCategory.FORECAST,
            ),
            AlertCandidate(
                notification_type="spending_growth",
                priority="LOW",
                title="Spending grew 20%",
                message="Notice",
                category=NotificationCategory.SPENDING,
            ),
        ]
        filtered = PersonalizationService.filter_alert_candidates(db, user.id, candidates)
        filtered_types = [c.notification_type for c in filtered]
        # CRITICAL event MUST remain visible even under LOW sensitivity!
        assert "forecast_negative" in filtered_types
        # LOW notice is suppressed
        assert "spending_growth" not in filtered_types
    finally:
        db.close()


def test_threshold_validation_and_precision(client: TestClient):
    """Verify threshold boundary validation: valid Decimal precision, zero, negative, and lead times."""
    token = get_auth_token(client, "pers_thresholds@campus.edu")
    headers = {"Authorization": f"Bearer {token}"}

    # Valid threshold with two decimal places
    resp_valid = client.patch(
        "/api/v1/personalization",
        json={"large_transaction_threshold": "1234.56", "recurring_alert_days_before": 1},
        headers=headers,
    )
    assert resp_valid.status_code == 200
    assert Decimal(resp_valid.json()["large_transaction_threshold"]) == Decimal("1234.56")
    assert resp_valid.json()["recurring_alert_days_before"] == 1

    # Negative threshold -> 422
    resp_neg = client.patch(
        "/api/v1/personalization",
        json={"large_transaction_threshold": "-10.00"},
        headers=headers,
    )
    assert resp_neg.status_code == 422

    # Invalid recurring alert days before -> 422
    resp_days_bad = client.patch(
        "/api/v1/personalization",
        json={"recurring_alert_days_before": 0},
        headers=headers,
    )
    assert resp_days_bad.status_code == 422

    resp_days_excessive = client.patch(
        "/api/v1/personalization",
        json={"recurring_alert_days_before": 30},
        headers=headers,
    )
    assert resp_days_excessive.status_code == 422


def test_large_transaction_alert_evaluation_deduplication_and_isolation(client: TestClient):
    """
    SECTION 13 AUDIT:
    Verify large transaction detection:
    - below threshold: no alert
    - exactly threshold: no alert
    - above threshold: alert created
    - duplicate event / re-evaluation: deduplicated (no duplicate notification)
    - different transaction: new notification
    - different user: tenant isolation
    """
    token_a = get_auth_token(client, "pers_large_a@campus.edu")
    token_b = get_auth_token(client, "pers_large_b@campus.edu")
    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # Set User A custom threshold = 1000.00
    client.patch("/api/v1/personalization", json={"large_transaction_threshold": "1000.00"}, headers=headers_a)
    # Set User B custom threshold = 1000.00
    client.patch("/api/v1/personalization", json={"large_transaction_threshold": "1000.00"}, headers=headers_b)

    db = SessionLocal()
    try:
        user_a = db.query(User).filter(User.email == "pers_large_a@campus.edu").first()
        user_b = db.query(User).filter(User.email == "pers_large_b@campus.edu").first()
        today = datetime.date.today()

        # 1. Transaction below threshold (500.00) for User A
        tx_below = Transaction(
            user_id=user_a.id,
            amount=Decimal("500.00"),
            transaction_type="expense",
            category="Food",
            payment_method="UPI",
            description="Below threshold meal",
            transaction_date=today,
        )
        # 2. Transaction exactly threshold (1000.00) for User A
        tx_exact = Transaction(
            user_id=user_a.id,
            amount=Decimal("1000.00"),
            transaction_type="expense",
            category="Shopping",
            payment_method="UPI",
            description="Exact threshold purchase",
            transaction_date=today,
        )
        db.add_all([tx_below, tx_exact])
        db.commit()

        # Evaluate alerts: neither below nor exact threshold should trigger large transaction alert
        res1 = SmartAlertService.evaluate_user_alerts(db, user_a)
        large_notifs1 = [n for n in res1.created_notifications if n.notification_type == NotificationType.SPENDING_LARGE_TRANSACTION.value]
        assert len(large_notifs1) == 0

        # 3. Transaction strictly above threshold (1500.00) for User A
        tx_above = Transaction(
            user_id=user_a.id,
            amount=Decimal("1500.00"),
            transaction_type="expense",
            category="Gadgets",
            payment_method="UPI",
            description="Above threshold headphones",
            transaction_date=today,
        )
        db.add(tx_above)
        db.commit()
        db.refresh(tx_above)

        res2 = SmartAlertService.evaluate_user_alerts(db, user_a)
        large_notifs2 = [n for n in res2.created_notifications if n.notification_type == NotificationType.SPENDING_LARGE_TRANSACTION.value]
        assert len(large_notifs2) == 1
        assert "Above threshold headphones" in large_notifs2[0].title or "Gadgets" in large_notifs2[0].title

        # 4. Same transaction re-evaluation: must deduplicate and NOT generate repeated alert
        res3 = SmartAlertService.evaluate_user_alerts(db, user_a)
        large_notifs3 = [n for n in res3.created_notifications if n.notification_type == NotificationType.SPENDING_LARGE_TRANSACTION.value]
        assert len(large_notifs3) == 0
        assert res3.skipped_dedupe_count >= 1

        # 5. Different transaction above threshold (2500.00) for User A: generates new alert
        tx_above2 = Transaction(
            user_id=user_a.id,
            amount=Decimal("2500.00"),
            transaction_type="expense",
            category="Travel",
            payment_method="UPI",
            description="Train ticket",
            transaction_date=today,
        )
        db.add(tx_above2)
        db.commit()

        res4 = SmartAlertService.evaluate_user_alerts(db, user_a)
        large_notifs4 = [n for n in res4.created_notifications if n.notification_type == NotificationType.SPENDING_LARGE_TRANSACTION.value]
        assert len(large_notifs4) == 1

        # 6. Tenant isolation: User B with same transaction amount (1500.00) generates User B's alert independently
        tx_b = Transaction(
            user_id=user_b.id,
            amount=Decimal("1500.00"),
            transaction_type="expense",
            category="Gadgets",
            payment_method="UPI",
            description="User B headphones",
            transaction_date=today,
        )
        db.add(tx_b)
        db.commit()

        res_b = SmartAlertService.evaluate_user_alerts(db, user_b)
        large_notifs_b = [n for n in res_b.created_notifications if n.notification_type == NotificationType.SPENDING_LARGE_TRANSACTION.value]
        assert len(large_notifs_b) == 1
        assert large_notifs_b[0].user_id == user_b.id

    finally:
        db.close()


def test_merchant_preference_integration_and_precedence(client: TestClient):
    """
    SECTION 2 AUDIT:
    Verify existing Phase 11 merchant preference architecture:
    precedence, update, delete, and tenant isolation.
    """
    token_a = get_auth_token(client, "pers_merch_a@campus.edu")
    token_b = get_auth_token(client, "pers_merch_b@campus.edu")
    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # User A creates merchant preference for "Swiggy" -> "Food"
    resp_create = client.post(
        "/api/v1/merchant-preferences",
        json={"normalized_merchant": "swiggy", "category": "Food"},
        headers=headers_a,
    )
    assert resp_create.status_code == 201
    pref_id = resp_create.json()["id"]
    assert resp_create.json()["category"] == "Food"

    # User A updates preference to "Other"
    resp_update = client.put(
        f"/api/v1/merchant-preferences/{pref_id}",
        json={"category": "Other"},
        headers=headers_a,
    )
    assert resp_update.status_code == 200
    assert resp_update.json()["category"] == "Other"

    # User B should NOT see User A's merchant preferences (tenant isolation)
    resp_b_list = client.get("/api/v1/merchant-preferences", headers=headers_b)
    assert resp_b_list.status_code == 200
    user_b_prefs = resp_b_list.json()
    assert not any(p["id"] == pref_id for p in user_b_prefs)

    # User A deletes preference
    resp_del = client.delete(f"/api/v1/merchant-preferences/{pref_id}", headers=headers_a)
    assert resp_del.status_code == 200

    # Verify deletion
    resp_a_list = client.get("/api/v1/merchant-preferences", headers=headers_a)
    assert not any(p["id"] == pref_id for p in resp_a_list.json())


def test_security_unauthenticated_and_cross_user(client: TestClient):
    """
    SECTION 10 AUDIT:
    Verify that unauthenticated requests to all Phase 16 endpoints return 401 Unauthorized,
    and malformed payloads return 422 Unprocessable Content.
    """
    # 1. Unauthenticated endpoints
    assert client.get("/api/v1/personalization").status_code == 401
    assert client.patch("/api/v1/personalization", json={"financial_priority": "SAVE_MORE"}).status_code == 401
    assert client.post("/api/v1/personalization/reset").status_code == 401
    assert client.get("/api/v1/personalization/signals").status_code == 401
    assert client.get("/api/v1/personalization/effective").status_code == 401

    # 2. Malformed payload
    token = get_auth_token(client, "pers_sec@campus.edu")
    headers = {"Authorization": f"Bearer {token}"}
    bad_payload = client.patch("/api/v1/personalization", json={"large_transaction_threshold": "not-a-number"}, headers=headers)
    assert bad_payload.status_code == 422


