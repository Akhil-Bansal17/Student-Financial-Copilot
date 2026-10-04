import datetime
from decimal import Decimal
import pytest
from fastapi.testclient import TestClient

from app.db.session import SessionLocal
from app.models.account import ConnectedAccount
from app.models.budget import Budget
from app.models.financial_profile import FinancialProfile
from app.models.forecast_preference import ForecastPreference
from app.models.goal import Goal
from app.models.notification import Notification
from app.models.notification_preference import NotificationPreference
from app.models.recurring_expense import RecurringExpense
from app.models.transaction import Transaction
from app.models.user import User
from app.schemas.notification import (
    NotificationPriority,
    NotificationType,
    NotificationCategory,
)
from app.services.smart_alert_service import SmartAlertService
from app.services.notification_service import NotificationService
from app.services.financial_context_builder import FinancialContextBuilder
from app.services.ai_copilot_service import AICopilotService


@pytest.fixture(autouse=True)
def cleanup_notifications_test_data():
    """Clean up test users and associated notifications before and after each test."""
    db = SessionLocal()
    try:
        db.query(User).filter(User.email.like("notif_%@campus.edu")).delete(synchronize_session=False)
        db.commit()
    finally:
        db.close()
    yield
    db = SessionLocal()
    try:
        db.query(User).filter(User.email.like("notif_%@campus.edu")).delete(synchronize_session=False)
        db.commit()
    finally:
        db.close()


def get_auth_token(client: TestClient, email: str = "notif_student@campus.edu") -> str:
    """Register student and obtain access token."""
    resp = client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": "Password123!",
            "confirm_password": "Password123!",
            "full_name": "Notification Test Student",
        },
    )
    if resp.status_code == 201:
        return resp.json()["access_token"]

    login_resp = client.post(
        "/api/v1/auth/login",
        data={"username": email, "password": "Password123!"},
    )
    return login_resp.json()["access_token"]


def get_user_by_email(email: str = "notif_student@campus.edu") -> User:
    db = SessionLocal()
    try:
        return db.query(User).filter(User.email == email).first()
    finally:
        db.close()


# ==============================================================================
# 1. NOTIFICATION CREATION & ALERT RULES
# ==============================================================================

def test_forecast_negative_balance_alert(client: TestClient):
    """Forecast predicting a negative balance generates a CRITICAL forecast alert."""
    token = get_auth_token(client, "notif_fc_neg@campus.edu")
    user = get_user_by_email("notif_fc_neg@campus.edu")
    db = SessionLocal()
    try:
        now = datetime.datetime.now(datetime.timezone.utc)
        # Starting balance ₹1,000, but high recurring commitment of ₹5,000 due in 5 days
        db.add(FinancialProfile(user_id=user.id, starting_balance=Decimal("1000.00"), onboarding_completed=True))
        db.add(Transaction(
            user_id=user.id,
            amount=Decimal("1000.00"),
            transaction_type="income",
            category="Allowance",
            payment_method="UPI",
            description="Initial Allowance",
            transaction_date=now - datetime.timedelta(days=2),
        ))
        db.add(RecurringExpense(
            user_id=user.id,
            merchant="Campus Hostel Fee",
            normalized_merchant="campus hostel fee",
            recurring_type="RECURRING_BILL",
            frequency="MONTHLY",
            category="Housing",
            average_amount=Decimal("5000.00"),
            latest_amount=Decimal("5000.00"),
            min_amount=Decimal("5000.00"),
            max_amount=Decimal("5000.00"),
            occurrence_count=1,
            last_occurrence_date=now - datetime.timedelta(days=25),
            next_expected_date=now + datetime.timedelta(days=5),
            status="ACTIVE",
            confidence="HIGH",
        ))
        db.commit()

        # Evaluate alerts
        result = SmartAlertService.evaluate_user_alerts(db, user)
        assert result.created_count >= 1

        notifs = db.query(Notification).filter(Notification.user_id == user.id).all()
        neg_alerts = [n for n in notifs if n.notification_type == NotificationType.FORECAST_NEGATIVE_BALANCE.value]
        assert len(neg_alerts) == 1
        assert neg_alerts[0].priority == NotificationPriority.CRITICAL.value
        assert "negative" in neg_alerts[0].title.lower() or "negative" in neg_alerts[0].message.lower()
        assert neg_alerts[0].action_url == "/forecast"
    finally:
        db.close()


def test_forecast_low_buffer_alert(client: TestClient):
    """Forecast dipping below minimum buffer generates a HIGH priority low buffer alert."""
    token = get_auth_token(client, "notif_fc_buf@campus.edu")
    user = get_user_by_email("notif_fc_buf@campus.edu")
    db = SessionLocal()
    try:
        now = datetime.datetime.now(datetime.timezone.utc)
        # Threshold ₹2,000. Starting balance ₹2,500. Outflow ₹1,000 -> drops to ₹1,500 (low buffer, not negative)
        db.add(ForecastPreference(user_id=user.id, minimum_balance_threshold=Decimal("2000.00"), is_enabled=True))
        db.add(Transaction(
            user_id=user.id,
            amount=Decimal("2500.00"),
            transaction_type="income",
            category="Income",
            payment_method="UPI",
            description="Salary",
            transaction_date=now - datetime.timedelta(days=3),
        ))
        db.add(RecurringExpense(
            user_id=user.id,
            merchant="Broadband Internet",
            normalized_merchant="broadband internet",
            recurring_type="RECURRING_BILL",
            frequency="MONTHLY",
            category="Utilities",
            average_amount=Decimal("1000.00"),
            latest_amount=Decimal("1000.00"),
            min_amount=Decimal("1000.00"),
            max_amount=Decimal("1000.00"),
            occurrence_count=1,
            last_occurrence_date=now - datetime.timedelta(days=26),
            next_expected_date=now + datetime.timedelta(days=4),
            status="ACTIVE",
            confidence="HIGH",
        ))
        db.commit()

        result = SmartAlertService.evaluate_user_alerts(db, user)
        assert result.created_count >= 1

        notifs = db.query(Notification).filter(Notification.user_id == user.id).all()
        buffer_alerts = [n for n in notifs if n.notification_type == NotificationType.FORECAST_LOW_BUFFER.value]
        assert len(buffer_alerts) == 1
        assert buffer_alerts[0].priority == NotificationPriority.HIGH.value
        assert "safety buffer" in buffer_alerts[0].title.lower() or "safety" in buffer_alerts[0].title.lower()
    finally:
        db.close()


def test_budget_exceeded_and_approaching_alerts(client: TestClient):
    """Budget over limit generates HIGH alert; budget >= 80% generates MEDIUM alert."""
    token = get_auth_token(client, "notif_budget@campus.edu")
    user = get_user_by_email("notif_budget@campus.edu")
    db = SessionLocal()
    try:
        now = datetime.datetime.now(datetime.timezone.utc)
        # 1. Exceeded category budget (Food limit ₹1,000, spent ₹1,200)
        db.add(Budget(user_id=user.id, year=now.year, month=now.month, category="Food", amount=Decimal("1000.00")))
        db.add(Transaction(
            user_id=user.id,
            amount=Decimal("1200.00"),
            transaction_type="expense",
            category="Food",
            payment_method="UPI",
            description="Mess food bill",
            transaction_date=now,
        ))

        # 2. Approaching category budget (Transport limit ₹1,000, spent ₹850 = 85%)
        db.add(Budget(user_id=user.id, year=now.year, month=now.month, category="Transport", amount=Decimal("1000.00")))
        db.add(Transaction(
            user_id=user.id,
            amount=Decimal("850.00"),
            transaction_type="expense",
            category="Transport",
            payment_method="UPI",
            description="Metro pass",
            transaction_date=now,
        ))
        db.commit()

        result = SmartAlertService.evaluate_user_alerts(db, user)
        assert result.created_count >= 2

        notifs = db.query(Notification).filter(Notification.user_id == user.id).all()
        exceeded = [n for n in notifs if n.notification_type == NotificationType.BUDGET_EXCEEDED.value and n.entity_id == "Food"]
        approaching = [n for n in notifs if n.notification_type == NotificationType.BUDGET_APPROACHING_LIMIT.value and n.entity_id == "Transport"]

        assert len(exceeded) == 1
        assert exceeded[0].priority == NotificationPriority.HIGH.value
        assert "Food Budget Exceeded" in exceeded[0].title

        assert len(approaching) == 1
        assert approaching[0].priority == NotificationPriority.MEDIUM.value
        assert "Transport Budget Approaching" in approaching[0].title
    finally:
        db.close()


def test_goal_milestones_and_completion_alerts(client: TestClient):
    """Completed goal generates GOAL_COMPLETED; partial progress generates milestone alerts."""
    token = get_auth_token(client, "notif_goals@campus.edu")
    user = get_user_by_email("notif_goals@campus.edu")
    db = SessionLocal()
    try:
        now = datetime.datetime.now(datetime.timezone.utc)
        # Goal 1: 100% completed
        g1 = Goal(
            user_id=user.id,
            name="Laptop Fund",
            target_amount=Decimal("10000.00"),
            current_amount=Decimal("10000.00"),
            target_date=(now + datetime.timedelta(days=60)).date(),
        )
        # Goal 2: 75% reached milestone
        g2 = Goal(
            user_id=user.id,
            name="Textbooks",
            target_amount=Decimal("4000.00"),
            current_amount=Decimal("3000.00"),
            target_date=(now + datetime.timedelta(days=30)).date(),
        )
        db.add_all([g1, g2])
        db.commit()

        result = SmartAlertService.evaluate_user_alerts(db, user)
        assert result.created_count >= 2

        notifs = db.query(Notification).filter(Notification.user_id == user.id).all()
        completed = [n for n in notifs if n.notification_type == NotificationType.GOAL_COMPLETED.value]
        milestones = [n for n in notifs if n.notification_type == NotificationType.GOAL_MILESTONE.value]

        assert len(completed) == 1
        assert completed[0].priority == NotificationPriority.INFO.value
        assert "Laptop Fund" in completed[0].title

        assert len(milestones) == 1
        assert "75%" in milestones[0].title
        assert "Textbooks" in milestones[0].title
    finally:
        db.close()


def test_recurring_upcoming_and_missed_alerts(client: TestClient):
    """Upcoming bills due in <= 3 days trigger alerts; overdue bills trigger missed alerts."""
    token = get_auth_token(client, "notif_rec@campus.edu")
    user = get_user_by_email("notif_rec@campus.edu")
    db = SessionLocal()
    try:
        now = datetime.datetime.now(datetime.timezone.utc)
        # Upcoming in 2 days
        r_up = RecurringExpense(
            user_id=user.id,
            merchant="Spotify Premium",
            normalized_merchant="spotify premium",
            recurring_type="SUBSCRIPTION",
            frequency="MONTHLY",
            category="Entertainment",
            average_amount=Decimal("119.00"),
            latest_amount=Decimal("119.00"),
            min_amount=Decimal("119.00"),
            max_amount=Decimal("119.00"),
            occurrence_count=2,
            last_occurrence_date=now - datetime.timedelta(days=28),
            next_expected_date=now + datetime.timedelta(days=2),
            status="ACTIVE",
            confidence="HIGH",
        )
        # Missed / overdue (expected 3 days ago)
        r_miss = RecurringExpense(
            user_id=user.id,
            merchant="Gym Membership",
            normalized_merchant="gym membership",
            recurring_type="SUBSCRIPTION",
            frequency="MONTHLY",
            category="Health",
            average_amount=Decimal("800.00"),
            latest_amount=Decimal("800.00"),
            min_amount=Decimal("800.00"),
            max_amount=Decimal("800.00"),
            occurrence_count=2,
            last_occurrence_date=now - datetime.timedelta(days=33),
            next_expected_date=now - datetime.timedelta(days=3),
            status="ACTIVE",
            confidence="HIGH",
        )
        db.add_all([r_up, r_miss])
        db.commit()

        result = SmartAlertService.evaluate_user_alerts(db, user)
        assert result.created_count >= 2

        notifs = db.query(Notification).filter(Notification.user_id == user.id).all()
        up_alerts = [n for n in notifs if n.notification_type == NotificationType.RECURRING_PAYMENT_UPCOMING.value]
        miss_alerts = [n for n in notifs if n.notification_type == NotificationType.RECURRING_PAYMENT_MISSED.value]

        assert len(up_alerts) == 1
        assert up_alerts[0].priority == NotificationPriority.MEDIUM.value
        assert "Spotify Premium" in up_alerts[0].title

        assert len(miss_alerts) == 1
        assert miss_alerts[0].priority == NotificationPriority.HIGH.value
        assert "Gym Membership" in miss_alerts[0].title
    finally:
        db.close()


def test_bank_sync_failure_and_stale_alerts(client: TestClient):
    """Connected account failure or stale sync triggers bank alerts."""
    token = get_auth_token(client, "notif_bank@campus.edu")
    user = get_user_by_email("notif_bank@campus.edu")
    db = SessionLocal()
    try:
        now = datetime.datetime.now(datetime.timezone.utc)
        # Stale account (synced 30 hours ago)
        acc_stale = ConnectedAccount(
            user_id=user.id,
            provider="mock_bank",
            provider_account_id="acc_stale_123",
            institution_name="State Student Bank",
            masked_account_number="****4321",
            current_balance=Decimal("5000.00"),
            status="ACTIVE",
            last_synced_at=now - datetime.timedelta(hours=30),
            sync_retry_count=0,
            last_sync_status="SUCCESS",
        )
        # Failed account
        acc_fail = ConnectedAccount(
            user_id=user.id,
            provider="mock_bank",
            provider_account_id="acc_fail_456",
            institution_name="National Campus Bank",
            masked_account_number="****9876",
            current_balance=Decimal("2000.00"),
            status="ACTIVE",
            last_synced_at=now - datetime.timedelta(hours=2),
            sync_retry_count=3,
            last_sync_status="FAILED",
        )
        db.add_all([acc_stale, acc_fail])
        db.commit()

        result = SmartAlertService.evaluate_user_alerts(db, user)
        assert result.created_count >= 2

        notifs = db.query(Notification).filter(Notification.user_id == user.id).all()
        stale_alerts = [n for n in notifs if n.notification_type == NotificationType.BANK_SYNC_STALE.value]
        fail_alerts = [n for n in notifs if n.notification_type == NotificationType.BANK_SYNC_FAILED.value]

        assert len(stale_alerts) == 1
        assert stale_alerts[0].priority == NotificationPriority.MEDIUM.value
        assert "State Student Bank" in stale_alerts[0].title

        assert len(fail_alerts) == 1
        assert fail_alerts[0].priority == NotificationPriority.HIGH.value
        assert "National Campus Bank" in fail_alerts[0].title
    finally:
        db.close()


# ==============================================================================
# 2. DEDUPLICATION & IDEMPOTENCY
# ==============================================================================

def test_alert_evaluation_idempotency_no_duplicates(client: TestClient):
    """Running alert evaluation repeatedly against unchanged facts does NOT generate duplicates."""
    token = get_auth_token(client, "notif_idem@campus.edu")
    user = get_user_by_email("notif_idem@campus.edu")
    db = SessionLocal()
    try:
        now = datetime.datetime.now(datetime.timezone.utc)
        db.add(Budget(user_id=user.id, year=now.year, month=now.month, category="Food", amount=Decimal("1000.00")))
        db.add(Transaction(
            user_id=user.id,
            amount=Decimal("1500.00"),
            transaction_type="expense",
            category="Food",
            payment_method="UPI",
            description="Groceries",
            transaction_date=now,
        ))
        db.commit()

        # Run 1: Should create notification
        r1 = SmartAlertService.evaluate_user_alerts(db, user)
        assert r1.created_count >= 1
        first_created = r1.created_count

        # Run 2: Same state, should skip all as duplicates
        r2 = SmartAlertService.evaluate_user_alerts(db, user)
        assert r2.created_count == 0
        assert r2.skipped_dedupe_count >= first_created

        # Run 3: Background scheduler multi-run simulation
        sched_res = SmartAlertService.evaluate_all_users_alerts(db)
        assert sched_res["total_notifications_created"] == 0

        # Verify DB row count
        total_in_db = db.query(Notification).filter(Notification.user_id == user.id).count()
        assert total_in_db == first_created
    finally:
        db.close()


def test_new_period_creates_new_event(client: TestClient):
    """Same category budget exceeded in October vs November generates separate events."""
    token = get_auth_token(client, "notif_period@campus.edu")
    user = get_user_by_email("notif_period@campus.edu")
    db = SessionLocal()
    try:
        # October budget exceeded
        db.add(Budget(user_id=user.id, year=2026, month=10, category="Food", amount=Decimal("1000.00")))
        db.add(Transaction(
            user_id=user.id,
            amount=Decimal("1200.00"),
            transaction_type="expense",
            category="Food",
            payment_method="UPI",
            description="Oct Food",
            transaction_date=datetime.datetime(2026, 10, 5, 12, 0, tzinfo=datetime.timezone.utc),
        ))
        db.commit()

        now_oct = datetime.datetime(2026, 10, 10, 12, 0, tzinfo=datetime.timezone.utc)
        rule = SmartAlertService.RULES[1]()  # BudgetAlertRule
        cands_oct = rule.evaluate(db, user, now_oct)
        assert any(c.dedupe_key.endswith("2026_10") for c in cands_oct)

        # November budget exceeded
        db.add(Budget(user_id=user.id, year=2026, month=11, category="Food", amount=Decimal("1000.00")))
        db.add(Transaction(
            user_id=user.id,
            amount=Decimal("1300.00"),
            transaction_type="expense",
            category="Food",
            payment_method="UPI",
            description="Nov Food",
            transaction_date=datetime.datetime(2026, 11, 5, 12, 0, tzinfo=datetime.timezone.utc),
        ))
        db.commit()

        now_nov = datetime.datetime(2026, 11, 10, 12, 0, tzinfo=datetime.timezone.utc)
        cands_nov = rule.evaluate(db, user, now_nov)
        assert any(c.dedupe_key.endswith("2026_11") for c in cands_nov)

        # Keys are distinct
        oct_key = [c.dedupe_key for c in cands_oct if "food" in c.dedupe_key][0]
        nov_key = [c.dedupe_key for c in cands_nov if "food" in c.dedupe_key][0]
        assert oct_key != nov_key
    finally:
        db.close()


# ==============================================================================
# 3. NOTIFICATION LIFECYCLE & READ STATE
# ==============================================================================

def test_notification_read_lifecycle_and_unread_count(client: TestClient):
    """Mark single read, mark all read, and verify live unread counts."""
    token = get_auth_token(client, "notif_lifecycle@campus.edu")
    user = get_user_by_email("notif_lifecycle@campus.edu")
    db = SessionLocal()
    try:
        now = datetime.datetime.now(datetime.timezone.utc)
        n1 = Notification(
            user_id=user.id,
            notification_type=NotificationType.FORECAST_NEGATIVE_BALANCE.value,
            priority=NotificationPriority.CRITICAL.value,
            title="Alert 1",
            message="Crit 1",
            dedupe_key=f"test:{user.id}:1",
            is_read=False,
            created_at=now,
        )
        n2 = Notification(
            user_id=user.id,
            notification_type=NotificationType.BUDGET_EXCEEDED.value,
            priority=NotificationPriority.HIGH.value,
            title="Alert 2",
            message="High 2",
            dedupe_key=f"test:{user.id}:2",
            is_read=False,
            created_at=now,
        )
        n3 = Notification(
            user_id=user.id,
            notification_type=NotificationType.GOAL_MILESTONE.value,
            priority=NotificationPriority.INFO.value,
            title="Alert 3",
            message="Info 3",
            dedupe_key=f"test:{user.id}:3",
            is_read=False,
            created_at=now,
        )
        db.add_all([n1, n2, n3])
        db.commit()
        db.refresh(n1)
        db.refresh(n2)
        db.refresh(n3)

        headers = {"Authorization": f"Bearer {token}"}

        # 1. Check initial unread count
        count_resp = client.get("/api/v1/notifications/unread-count", headers=headers)
        assert count_resp.status_code == 200
        count_data = count_resp.json()
        assert count_data["unread_count"] == 3
        assert count_data["critical_count"] == 1
        assert count_data["high_count"] == 1

        # 2. Mark n1 as read
        patch_resp = client.patch(f"/api/v1/notifications/{n1.id}/read", headers=headers)
        assert patch_resp.status_code == 200
        assert patch_resp.json()["is_read"] is True
        assert patch_resp.json()["read_at"] is not None

        # Unread count should now be 2 (0 critical, 1 high)
        count_resp2 = client.get("/api/v1/notifications/unread-count", headers=headers)
        assert count_resp2.json()["unread_count"] == 2
        assert count_resp2.json()["critical_count"] == 0
        assert count_resp2.json()["high_count"] == 1

        # 3. Mark all remaining read
        all_read_resp = client.post("/api/v1/notifications/mark-all-read", headers=headers)
        assert all_read_resp.status_code == 200
        assert all_read_resp.json()["marked_count"] == 2

        # Unread count should now be 0
        count_resp3 = client.get("/api/v1/notifications/unread-count", headers=headers)
        assert count_resp3.json()["unread_count"] == 0

        # Notifications remain in history (read notifications are not deleted)
        list_resp = client.get("/api/v1/notifications", headers=headers)
        assert list_resp.status_code == 200
        assert list_resp.json()["total_count"] == 3
        assert list_resp.json()["unread_count"] == 0
    finally:
        db.close()


def test_pagination_and_priority_filter(client: TestClient):
    """Pagination controls limit/offset and filters by priority."""
    token = get_auth_token(client, "notif_page@campus.edu")
    user = get_user_by_email("notif_page@campus.edu")
    db = SessionLocal()
    try:
        now = datetime.datetime.now(datetime.timezone.utc)
        for i in range(15):
            db.add(Notification(
                user_id=user.id,
                notification_type=NotificationType.BUDGET_APPROACHING_LIMIT.value,
                priority=NotificationPriority.MEDIUM.value if i % 2 == 0 else NotificationPriority.LOW.value,
                title=f"Notification {i}",
                message=f"Detail {i}",
                dedupe_key=f"page_test:{user.id}:{i}",
                is_read=False,
                created_at=now - datetime.timedelta(minutes=i),
            ))
        db.commit()

        headers = {"Authorization": f"Bearer {token}"}

        # Page 1 with page_size=5
        p1 = client.get("/api/v1/notifications?page=1&page_size=5", headers=headers)
        assert p1.status_code == 200
        data1 = p1.json()
        assert len(data1["items"]) == 5
        assert data1["total_count"] == 15
        assert data1["total_pages"] == 3
        assert data1["page"] == 1

        # Filter by priority=MEDIUM
        med_resp = client.get("/api/v1/notifications?priority=MEDIUM", headers=headers)
        assert med_resp.status_code == 200
        med_data = med_resp.json()
        assert all(n["priority"] == "MEDIUM" for n in med_data["items"])
    finally:
        db.close()


# ==============================================================================
# 4. NOTIFICATION PREFERENCES
# ==============================================================================

def test_notification_preferences_control(client: TestClient):
    """Disabling category or global smart alerts suppresses notifications without stopping financial calculations."""
    token = get_auth_token(client, "notif_pref@campus.edu")
    user = get_user_by_email("notif_pref@campus.edu")
    headers = {"Authorization": f"Bearer {token}"}
    db = SessionLocal()
    try:
        now = datetime.datetime.now(datetime.timezone.utc)
        # Seed budget exceeded
        db.add(Budget(user_id=user.id, year=now.year, month=now.month, category="Food", amount=Decimal("1000.00")))
        db.add(Transaction(
            user_id=user.id,
            amount=Decimal("1500.00"),
            transaction_type="expense",
            category="Food",
            payment_method="UPI",
            description="Mess",
            transaction_date=now,
        ))
        db.commit()

        # 1. Verify default preferences (smart alerts enabled)
        pref_res = client.get("/api/v1/notification-preferences", headers=headers)
        assert pref_res.status_code == 200
        assert pref_res.json()["smart_alerts_enabled"] is True
        assert pref_res.json()["budget_alerts_enabled"] is True

        # 2. Disable budget alerts specifically
        patch_pref = client.patch(
            "/api/v1/notification-preferences",
            json={"budget_alerts_enabled": False},
            headers=headers,
        )
        assert patch_pref.status_code == 200
        assert patch_pref.json()["budget_alerts_enabled"] is False

        # 3. Evaluate alerts: budget alert should be suppressed
        eval_res = client.post("/api/v1/notifications/evaluate", headers=headers)
        assert eval_res.status_code == 200
        budget_alerts = [
            n for n in eval_res.json()["created_notifications"]
            if n["notification_type"] in [
                NotificationType.BUDGET_EXCEEDED.value,
                NotificationType.BUDGET_APPROACHING_LIMIT.value,
            ]
        ]
        assert len(budget_alerts) == 0
        assert eval_res.json()["suppressed_count"] >= 1

        # Global smart_alerts_enabled=False suppresses everything
        client.patch(
            "/api/v1/notification-preferences",
            json={"smart_alerts_enabled": False},
            headers=headers,
        )
        eval_res_global = client.post("/api/v1/notifications/evaluate", headers=headers)
        assert eval_res_global.status_code == 200
        assert eval_res_global.json()["created_count"] == 0

        # 4. Underlying financial calculations MUST still run accurately
        from app.services.budget_service import BudgetService
        summary = BudgetService.get_summary(db, user.id, now.year, now.month)
        assert summary.category_budgets[0].over_budget is True
        assert summary.category_budgets[0].spent == Decimal("1500.00")

        # 5. Re-enable smart alerts and budget alerts
        client.patch(
            "/api/v1/notification-preferences",
            json={"smart_alerts_enabled": True, "budget_alerts_enabled": True},
            headers=headers,
        )
        eval_res2 = client.post("/api/v1/notifications/evaluate", headers=headers)
        assert eval_res2.status_code == 200
        assert eval_res2.json()["created_count"] >= 1
    finally:
        db.close()


# ==============================================================================
# 5. EXPIRATION & RETENTION
# ==============================================================================

def test_expired_notifications_excluded_from_active_queries(client: TestClient):
    """Expired notifications do not appear in active queries or unread counts."""
    token = get_auth_token(client, "notif_expire@campus.edu")
    user = get_user_by_email("notif_expire@campus.edu")
    db = SessionLocal()
    try:
        now = datetime.datetime.now(datetime.timezone.utc)
        # Active notification
        n_active = Notification(
            user_id=user.id,
            notification_type=NotificationType.BUDGET_APPROACHING_LIMIT.value,
            priority=NotificationPriority.MEDIUM.value,
            title="Active Alert",
            message="Active Message",
            dedupe_key=f"exp_test:{user.id}:active",
            is_read=False,
            expires_at=now + datetime.timedelta(days=5),
            created_at=now,
        )
        # Expired notification
        n_expired = Notification(
            user_id=user.id,
            notification_type=NotificationType.RECURRING_PAYMENT_UPCOMING.value,
            priority=NotificationPriority.MEDIUM.value,
            title="Expired Alert",
            message="Expired Message",
            dedupe_key=f"exp_test:{user.id}:expired",
            is_read=False,
            expires_at=now - datetime.timedelta(hours=2),
            created_at=now - datetime.timedelta(days=3),
        )
        db.add_all([n_active, n_expired])
        db.commit()

        headers = {"Authorization": f"Bearer {token}"}

        # Query active list
        list_res = client.get("/api/v1/notifications", headers=headers)
        assert list_res.status_code == 200
        items = list_res.json()["items"]
        assert len(items) == 1
        assert items[0]["title"] == "Active Alert"

        # Query unread count
        count_res = client.get("/api/v1/notifications/unread-count", headers=headers)
        assert count_res.json()["unread_count"] == 1
    finally:
        db.close()


# ==============================================================================
# 6. SECURITY & TENANT ISOLATION
# ==============================================================================

def test_tenant_isolation_and_idor_protection(client: TestClient):
    """User A cannot view, mark as read, or modify User B's notifications or preferences."""
    token_a = get_auth_token(client, "notif_usera@campus.edu")
    token_b = get_auth_token(client, "notif_userb@campus.edu")
    user_a = get_user_by_email("notif_usera@campus.edu")
    user_b = get_user_by_email("notif_userb@campus.edu")

    db = SessionLocal()
    try:
        now = datetime.datetime.now(datetime.timezone.utc)
        # Create notification belonging to User B
        notif_b = Notification(
            user_id=user_b.id,
            notification_type=NotificationType.GOAL_COMPLETED.value,
            priority=NotificationPriority.INFO.value,
            title="User B Private Goal",
            message="User B reached goal",
            dedupe_key=f"sec_test:{user_b.id}:1",
            is_read=False,
            created_at=now,
        )
        db.add(notif_b)
        db.commit()
        db.refresh(notif_b)

        headers_a = {"Authorization": f"Bearer {token_a}"}

        # 1. User A lists notifications -> should NOT see User B's notification
        list_a = client.get("/api/v1/notifications", headers=headers_a)
        assert list_a.status_code == 200
        assert all(n["id"] != notif_b.id for n in list_a.json()["items"])

        # 2. User A attempts to mark User B's notification as read (IDOR attempt)
        idor_res = client.patch(f"/api/v1/notifications/{notif_b.id}/read", headers=headers_a)
        assert idor_res.status_code == 404  # Not found for this tenant

        # 3. Unauthenticated requests return 401
        unauth_list = client.get("/api/v1/notifications")
        assert unauth_list.status_code == 401
        unauth_count = client.get("/api/v1/notifications/unread-count")
        assert unauth_count.status_code == 401
        unauth_pref = client.get("/api/v1/notification-preferences")
        assert unauth_pref.status_code == 401
    finally:
        db.close()


# ==============================================================================
# 7. FINANCIAL CONTEXT BUILDER & COPILOT INTEGRATION
# ==============================================================================

def test_financial_context_builder_includes_notifications(client: TestClient):
    """FinancialContextBuilder includes verified notifications_summary."""
    token = get_auth_token(client, "notif_copilot@campus.edu")
    user = get_user_by_email("notif_copilot@campus.edu")
    db = SessionLocal()
    try:
        now = datetime.datetime.now(datetime.timezone.utc)
        db.add(Notification(
            user_id=user.id,
            notification_type=NotificationType.FORECAST_NEGATIVE_BALANCE.value,
            priority=NotificationPriority.CRITICAL.value,
            title="Urgent Negative Balance",
            message="Projected negative balance next week",
            dedupe_key=f"ctx_test:{user.id}:crit",
            is_read=False,
            created_at=now,
        ))
        db.commit()

        ctx = FinancialContextBuilder.build_context(db, user.id, now.year, now.month)
        assert "notifications_summary" in ctx
        summary = ctx["notifications_summary"]
        assert summary["unread_total_count"] == 1
        assert summary["unread_critical_count"] == 1
        assert len(summary["recent_unread_alerts"]) == 1
        assert summary["recent_unread_alerts"][0]["title"] == "Urgent Negative Balance"
    finally:
        db.close()


def test_ai_copilot_answers_alert_queries():
    """AI Copilot cites verified notification records when asked about alerts."""
    import asyncio
    client = TestClient(__import__("app.main").main.app)
    token = get_auth_token(client, "notif_ai_chat@campus.edu")
    user = get_user_by_email("notif_ai_chat@campus.edu")
    db = SessionLocal()
    try:
        now = datetime.datetime.now(datetime.timezone.utc)
        db.add(Notification(
            user_id=user.id,
            notification_type=NotificationType.BUDGET_EXCEEDED.value,
            priority=NotificationPriority.HIGH.value,
            title="Food Budget Exceeded",
            message="Spent ₹1,500 of ₹1,000 budget limit",
            dedupe_key=f"ai_test:{user.id}:budget",
            is_read=False,
            created_at=now,
        ))
        db.commit()

        res = asyncio.run(AICopilotService.chat(
            db=db,
            user=user,
            message="Do I have any urgent alerts or notifications?",
        ))
        assert "unread notification" in res.answer.lower()
        assert "Food Budget Exceeded" in res.answer
    finally:
        db.close()

