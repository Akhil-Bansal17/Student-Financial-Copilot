import datetime
from decimal import Decimal
from typing import List, Dict, Optional, Tuple, Any
from sqlalchemy import select, and_, or_, desc
from sqlalchemy.orm import Session

from app.core.constants import (
    RECURRING_FREQUENCIES,
    RECURRING_TYPES,
    RECURRING_STATUSES,
    RECURRING_PREFERENCES,
    RECURRING_INTERVALS,
    MIN_RECURRING_OCCURRENCES,
    RECURRING_GRACE_PERIOD_DAYS,
    POSSIBLY_ENDED_INTERVAL_MULTIPLIER,
    VARIABLE_AMOUNT_THRESHOLD_PCT,
    PRICE_CHANGE_MIN_AMOUNT,
    PRICE_CHANGE_MIN_PERCENTAGE,
    KNOWN_SUBSCRIPTION_MERCHANTS,
    KNOWN_RECURRING_BILL_MERCHANTS,
    KNOWN_RECURRING_EXPENSE_MERCHANTS,
)
from app.models.transaction import Transaction
from app.models.recurring_expense import RecurringExpense
from app.models.recurring_preference import RecurringPreference
from app.services.transaction_normalization_service import TransactionNormalizationService


class RecurringExpenseService:
    """
    Deterministic Recurring Expense & Subscription Intelligence Engine.
    Identifies repeated financial patterns, estimates next payment dates,
    classifies subscriptions vs bills, tracks price changes, and honors user overrides.
    """

    @classmethod
    def get_user_preferences(cls, db: Session, user_id: int) -> Dict[str, RecurringPreference]:
        """Fetch all recurring merchant preferences for the user keyed by normalized_merchant."""
        prefs = db.query(RecurringPreference).filter(RecurringPreference.user_id == user_id).all()
        return {p.normalized_merchant: p for p in prefs}

    @classmethod
    def set_user_preference(
        cls, db: Session, user_id: int, normalized_merchant: str, preference_type: str
    ) -> RecurringPreference:
        """Create or update a user preference override for a normalized merchant."""
        merchant_norm = normalized_merchant.strip().upper()
        pref = (
            db.query(RecurringPreference)
            .filter(
                RecurringPreference.user_id == user_id,
                RecurringPreference.normalized_merchant == merchant_norm,
            )
            .first()
        )
        if pref:
            pref.preference_type = preference_type
            pref.updated_at = datetime.datetime.now(datetime.timezone.utc)
        else:
            pref = RecurringPreference(
                user_id=user_id,
                normalized_merchant=merchant_norm,
                preference_type=preference_type,
            )
            db.add(pref)
        db.commit()
        db.refresh(pref)

        # Trigger re-evaluation of recurring expenses for this user
        cls.detect_and_sync_recurring(db, user_id)
        return pref

    @classmethod
    def delete_user_preference(cls, db: Session, user_id: int, normalized_merchant: str) -> bool:
        """Remove a user preference override."""
        merchant_norm = normalized_merchant.strip().upper()
        pref = (
            db.query(RecurringPreference)
            .filter(
                RecurringPreference.user_id == user_id,
                RecurringPreference.normalized_merchant == merchant_norm,
            )
            .first()
        )
        if pref:
            db.delete(pref)
            db.commit()
            cls.detect_and_sync_recurring(db, user_id)
            return True
        return False

    @classmethod
    def calculate_next_expected_date(
        cls, last_date: datetime.datetime, frequency: str
    ) -> datetime.datetime:
        """Deterministically calculate the next expected payment date."""
        if frequency == "WEEKLY":
            return last_date + datetime.timedelta(days=7)
        elif frequency == "BIWEEKLY":
            return last_date + datetime.timedelta(days=14)
        elif frequency == "MONTHLY":
            # Add approximately 30.5 days or compute next month preserving day-of-month where possible
            year = last_date.year
            month = last_date.month + 1
            if month > 12:
                year += 1
                month = 1
            # Handle variable month lengths safely
            day = min(last_date.day, 28)
            try:
                return last_date.replace(year=year, month=month, day=last_date.day)
            except ValueError:
                return last_date.replace(year=year, month=month, day=day)
        elif frequency == "QUARTERLY":
            year = last_date.year
            month = last_date.month + 3
            if month > 12:
                year += 1
                month -= 12
            day = min(last_date.day, 28)
            try:
                return last_date.replace(year=year, month=month, day=last_date.day)
            except ValueError:
                return last_date.replace(year=year, month=month, day=day)
        elif frequency == "YEARLY":
            try:
                return last_date.replace(year=last_date.year + 1)
            except ValueError:
                return last_date.replace(year=last_date.year + 1, day=28)
        # Default fallback to 30 days
        return last_date + datetime.timedelta(days=30)

    @classmethod
    def classify_recurring_type(
        cls,
        normalized_merchant: str,
        category: str,
        is_variable_amount: bool,
        user_preference: Optional[str] = None,
    ) -> str:
        """Deterministically classify recurring expense as SUBSCRIPTION, RECURRING_BILL, or RECURRING_EXPENSE."""
        if user_preference == "SUBSCRIPTION":
            return "SUBSCRIPTION"
        if user_preference == "BILL":
            return "RECURRING_BILL"
        if user_preference == "RECURRING":
            # User wants it recurring, still choose best specific type
            pass

        norm = normalized_merchant.upper()
        if norm in KNOWN_SUBSCRIPTION_MERCHANTS:
            return "SUBSCRIPTION"
        if norm in KNOWN_RECURRING_BILL_MERCHANTS or category == "Bills":
            return "RECURRING_BILL"
        if norm in KNOWN_RECURRING_EXPENSE_MERCHANTS or category in {"Hostel/Rent", "Food"}:
            return "RECURRING_EXPENSE"
        if category == "Entertainment" and not is_variable_amount:
            return "SUBSCRIPTION"
        return "RECURRING_EXPENSE"

    @classmethod
    def detect_frequency(cls, intervals: List[int]) -> Optional[Tuple[str, str]]:
        """
        Deterministically evaluates chronological interval differences in days.
        Returns (frequency, confidence) or None if no consistent pattern exists.
        """
        if not intervals:
            return None

        avg_interval = sum(intervals) / len(intervals)

        # 1. Weekly: (5 to 9 days)
        weekly_min, weekly_max = RECURRING_INTERVALS["WEEKLY"]
        if weekly_min <= avg_interval <= weekly_max:
            matches = sum(1 for d in intervals if weekly_min <= d <= weekly_max)
            if matches / len(intervals) >= 0.65:
                confidence = "HIGH" if matches == len(intervals) else "MEDIUM"
                return "WEEKLY", confidence

        # 2. Biweekly: (11 to 17 days)
        biweekly_min, biweekly_max = RECURRING_INTERVALS["BIWEEKLY"]
        if biweekly_min <= avg_interval <= biweekly_max:
            matches = sum(1 for d in intervals if biweekly_min <= d <= biweekly_max)
            if matches / len(intervals) >= 0.65:
                confidence = "HIGH" if matches == len(intervals) else "MEDIUM"
                return "BIWEEKLY", confidence

        # 3. Monthly: (25 to 35 days)
        monthly_min, monthly_max = RECURRING_INTERVALS["MONTHLY"]
        if monthly_min <= avg_interval <= monthly_max:
            matches = sum(1 for d in intervals if monthly_min <= d <= monthly_max)
            if matches / len(intervals) >= 0.65:
                confidence = "HIGH" if matches == len(intervals) else "MEDIUM"
                return "MONTHLY", confidence

        # 4. Quarterly: (80 to 100 days)
        quarterly_min, quarterly_max = RECURRING_INTERVALS["QUARTERLY"]
        if quarterly_min <= avg_interval <= quarterly_max:
            matches = sum(1 for d in intervals if quarterly_min <= d <= quarterly_max)
            if matches / len(intervals) >= 0.65:
                confidence = "HIGH" if matches == len(intervals) else "MEDIUM"
                return "QUARTERLY", confidence

        # 5. Yearly: (330 to 400 days)
        yearly_min, yearly_max = RECURRING_INTERVALS["YEARLY"]
        if yearly_min <= avg_interval <= yearly_max:
            matches = sum(1 for d in intervals if yearly_min <= d <= yearly_max)
            if matches / len(intervals) >= 0.65:
                confidence = "HIGH" if matches == len(intervals) else "MEDIUM"
                return "YEARLY", confidence

        return None

    @classmethod
    def detect_and_sync_recurring(cls, db: Session, user_id: int) -> List[RecurringExpense]:
        """
        Runs full deterministic detection across a user's transaction history.
        Safe, idempotent, tenant-isolated. Never fabricates transactions.
        Updates persistent RecurringExpense records.
        """
        # Fetch user preferences
        user_prefs = cls.get_user_preferences(db, user_id)

        # Query all posted expense transactions for the user
        # Exclude: PENDING, REVERSED, DUPLICATE_EXCLUDED
        raw_txs = (
            db.query(Transaction)
            .filter(
                Transaction.user_id == user_id,
                Transaction.transaction_type == "expense",
                Transaction.status == "POSTED",
                Transaction.amount > Decimal("0.00"),
                Transaction.reconciliation_status != "DUPLICATE_EXCLUDED",
            )
            .order_by(Transaction.transaction_date.asc())
            .all()
        )

        # De-duplicate reconciled transactions: if t.reconciled_with_id is present,
        # ensure we only consider one of the pair so bank + manual match doesn't double count.
        reconciled_pairs_seen = set()
        valid_txs: List[Transaction] = []
        for tx in raw_txs:
            if tx.reconciled_with_id is not None:
                pair_key = tuple(sorted([tx.id, tx.reconciled_with_id]))
                if pair_key in reconciled_pairs_seen:
                    continue
                reconciled_pairs_seen.add(pair_key)
            valid_txs.append(tx)

        # Group by normalized_merchant
        by_merchant: Dict[str, List[Transaction]] = {}
        for tx in valid_txs:
            norm_merchant = tx.normalized_merchant
            if not norm_merchant:
                # Extract if not pre-populated
                norm_merchant, _ = TransactionNormalizationService.extract_merchant(
                    raw_description=tx.raw_bank_description,
                    description=tx.description or tx.merchant,
                )
            if not norm_merchant:
                continue
            norm_merchant = norm_merchant.strip().upper()
            by_merchant.setdefault(norm_merchant, []).append(tx)

        now = datetime.datetime.now(datetime.timezone.utc)
        results: List[RecurringExpense] = []

        # Existing persistent recurring records for this user
        existing_records = {
            r.normalized_merchant: r
            for r in db.query(RecurringExpense).filter(RecurringExpense.user_id == user_id).all()
        }

        # Evaluate each merchant group
        for norm_merchant, tx_list in by_merchant.items():
            pref = user_prefs.get(norm_merchant)
            pref_type = pref.preference_type if pref else None

            # Handle explicit IGNORE preference
            if pref_type == "IGNORE":
                if norm_merchant in existing_records:
                    rec = existing_records[norm_merchant]
                    rec.status = "USER_IGNORED"
                    rec.updated_at = now
                    results.append(rec)
                continue

            # Need at least 2 occurrences for interval computation
            if len(tx_list) < 2 and pref_type not in {"RECURRING", "SUBSCRIPTION", "BILL"}:
                continue

            # Sort chronologically
            tx_list.sort(key=lambda t: t.transaction_date)

            # Calculate intervals in days
            intervals = [
                (tx_list[i + 1].transaction_date.date() - tx_list[i].transaction_date.date()).days
                for i in range(len(tx_list) - 1)
            ]

            detection_res = cls.detect_frequency(intervals)
            frequency: Optional[str] = None
            confidence = "MEDIUM"

            if detection_res:
                frequency, confidence = detection_res
            elif pref_type in {"RECURRING", "SUBSCRIPTION", "BILL"}:
                # User marked as recurring override: default to monthly or estimate based on avg interval
                if intervals:
                    avg_int = sum(intervals) / len(intervals)
                    if avg_int <= 10:
                        frequency = "WEEKLY"
                    elif avg_int <= 18:
                        frequency = "BIWEEKLY"
                    elif avg_int <= 45:
                        frequency = "MONTHLY"
                    elif avg_int <= 120:
                        frequency = "QUARTERLY"
                    else:
                        frequency = "YEARLY"
                else:
                    frequency = "MONTHLY"
                confidence = "HIGH"

            if not frequency:
                continue

            # Minimum evidence threshold check
            min_required = MIN_RECURRING_OCCURRENCES.get(frequency, 3)
            if len(tx_list) < min_required and pref_type not in {"RECURRING", "SUBSCRIPTION", "BILL"}:
                continue

            # Financial metrics
            amounts = [t.amount for t in tx_list]
            latest_amount = amounts[-1]
            previous_amount = amounts[-2] if len(amounts) >= 2 else None
            min_amount = min(amounts)
            max_amount = max(amounts)
            average_amount = (sum(amounts) / Decimal(str(len(amounts)))).quantize(Decimal("0.01"))

            # Amount variation
            variation_pct = (
                ((max_amount - min_amount) / average_amount * Decimal("100.0")).quantize(Decimal("0.01"))
                if average_amount > Decimal("0.00")
                else Decimal("0.00")
            )
            is_variable = variation_pct > VARIABLE_AMOUNT_THRESHOLD_PCT

            # Price change detection
            amount_change = None
            amount_change_pct = None
            if previous_amount is not None:
                diff = latest_amount - previous_amount
                if previous_amount > Decimal("0.00"):
                    diff_pct = ((diff / previous_amount) * Decimal("100.0")).quantize(Decimal("0.01"))
                else:
                    diff_pct = Decimal("0.00")

                if (
                    abs(diff) >= PRICE_CHANGE_MIN_AMOUNT
                    and abs(diff_pct) >= PRICE_CHANGE_MIN_PERCENTAGE
                ):
                    amount_change = diff
                    amount_change_pct = diff_pct

            # Category & Display merchant
            # Pick most recent non-empty merchant display name
            display_merchant = norm_merchant.title()
            for t in reversed(tx_list):
                if t.merchant:
                    display_merchant = t.merchant.strip()
                    break

            category = tx_list[-1].category or "Other"

            # Classification
            recurring_type = cls.classify_recurring_type(
                normalized_merchant=norm_merchant,
                category=category,
                is_variable_amount=is_variable,
                user_preference=pref_type,
            )

            # Dates
            last_occurrence_date = tx_list[-1].transaction_date
            next_expected_date = cls.calculate_next_expected_date(last_occurrence_date, frequency)

            # Status determination based on date
            grace_days = RECURRING_GRACE_PERIOD_DAYS.get(frequency, 10)
            overdue_boundary = next_expected_date + datetime.timedelta(days=grace_days)
            interval_nominal = (
                7 if frequency == "WEEKLY" else
                14 if frequency == "BIWEEKLY" else
                30 if frequency == "MONTHLY" else
                90 if frequency == "QUARTERLY" else 365
            )
            possibly_ended_boundary = next_expected_date + datetime.timedelta(days=int(interval_nominal * 2))

            status = "ACTIVE"
            if now > possibly_ended_boundary:
                status = "POSSIBLY_ENDED"
            elif now > overdue_boundary:
                status = "OVERDUE_EXPECTED"

            # Check existing record
            existing = existing_records.get(norm_merchant)
            if existing:
                # If paused by user, preserve PAUSED
                if existing.status == "PAUSED":
                    status = "PAUSED"
                elif existing.status == "USER_IGNORED" and pref_type == "IGNORE":
                    status = "USER_IGNORED"

                existing.merchant = display_merchant
                existing.category = category
                existing.recurring_type = recurring_type
                existing.frequency = frequency
                existing.is_variable_amount = is_variable
                existing.confidence = confidence
                existing.status = status
                existing.average_amount = average_amount
                existing.latest_amount = latest_amount
                existing.previous_amount = previous_amount
                existing.min_amount = min_amount
                existing.max_amount = max_amount
                existing.amount_change = amount_change
                existing.amount_change_percentage = amount_change_pct
                existing.occurrence_count = len(tx_list)
                existing.last_occurrence_date = last_occurrence_date
                existing.next_expected_date = next_expected_date
                existing.updated_at = now
                results.append(existing)
            else:
                new_rec = RecurringExpense(
                    user_id=user_id,
                    merchant=display_merchant,
                    normalized_merchant=norm_merchant,
                    category=category,
                    recurring_type=recurring_type,
                    frequency=frequency,
                    is_variable_amount=is_variable,
                    confidence=confidence,
                    status=status,
                    average_amount=average_amount,
                    latest_amount=latest_amount,
                    previous_amount=previous_amount,
                    min_amount=min_amount,
                    max_amount=max_amount,
                    amount_change=amount_change,
                    amount_change_percentage=amount_change_pct,
                    occurrence_count=len(tx_list),
                    last_occurrence_date=last_occurrence_date,
                    next_expected_date=next_expected_date,
                )
                db.add(new_rec)
                results.append(new_rec)

        db.commit()
        for r in results:
            db.refresh(r)
        return results

    @classmethod
    def get_recurring_expenses(
        cls,
        db: Session,
        user_id: int,
        status: Optional[str] = None,
        recurring_type: Optional[str] = None,
        category: Optional[str] = None,
        frequency: Optional[str] = None,
    ) -> List[RecurringExpense]:
        """Fetch recurring expenses with optional filtering. Guaranteed user isolation."""
        query = db.query(RecurringExpense).filter(RecurringExpense.user_id == user_id)
        if status:
            query = query.filter(RecurringExpense.status == status)
        if recurring_type:
            query = query.filter(RecurringExpense.recurring_type == recurring_type)
        if category:
            query = query.filter(RecurringExpense.category == category)
        if frequency:
            query = query.filter(RecurringExpense.frequency == frequency)

        # Default order by next expected date
        return query.order_by(RecurringExpense.next_expected_date.asc()).all()

    @classmethod
    def get_recurring_expense_by_id(
        cls, db: Session, user_id: int, recurring_id: int
    ) -> Optional[RecurringExpense]:
        """Get single recurring expense guaranteeing user isolation."""
        return (
            db.query(RecurringExpense)
            .filter(
                RecurringExpense.id == recurring_id,
                RecurringExpense.user_id == user_id,
            )
            .first()
        )

    @classmethod
    def update_recurring_expense(
        cls,
        db: Session,
        user_id: int,
        recurring_id: int,
        status: Optional[str] = None,
        recurring_type: Optional[str] = None,
        frequency: Optional[str] = None,
        category: Optional[str] = None,
        notes: Optional[str] = None,
    ) -> Optional[RecurringExpense]:
        """Update recurring expense status, type, notes, or category with user isolation."""
        rec = cls.get_recurring_expense_by_id(db, user_id, recurring_id)
        if not rec:
            return None

        if status is not None:
            rec.status = status
            # If user pauses or ignores, record corresponding state
            if status == "USER_IGNORED":
                cls.set_user_preference(db, user_id, rec.normalized_merchant, "IGNORE")
        if recurring_type is not None:
            rec.recurring_type = recurring_type
            if recurring_type == "SUBSCRIPTION":
                cls.set_user_preference(db, user_id, rec.normalized_merchant, "SUBSCRIPTION")
            elif recurring_type == "RECURRING_BILL":
                cls.set_user_preference(db, user_id, rec.normalized_merchant, "BILL")
        if frequency is not None:
            rec.frequency = frequency
            rec.next_expected_date = cls.calculate_next_expected_date(
                rec.last_occurrence_date, frequency
            )
        if category is not None:
            rec.category = category
        if notes is not None:
            rec.notes = notes

        rec.updated_at = datetime.datetime.now(datetime.timezone.utc)
        db.commit()
        db.refresh(rec)
        return rec

    @classmethod
    def get_recurring_summary(cls, db: Session, user_id: int) -> Dict[str, Any]:
        """
        Calculate authoritative summary metrics for dashboard and recurring page:
        - Monthly recurring estimate
        - Subscriptions count
        - Fixed vs variable breakdown
        - Upcoming payments
        - Price changes
        - Overdue/ended items
        """
        # Ensure fresh records exist
        all_items = cls.get_recurring_expenses(db, user_id)
        if not all_items:
            all_items = cls.detect_and_sync_recurring(db, user_id)

        now = datetime.datetime.now(datetime.timezone.utc)
        thirty_days_later = now + datetime.timedelta(days=30)

        total_monthly = Decimal("0.00")
        fixed_monthly = Decimal("0.00")
        variable_monthly = Decimal("0.00")
        sub_monthly = Decimal("0.00")
        bill_monthly = Decimal("0.00")
        other_monthly = Decimal("0.00")

        subscription_count = 0
        recurring_count = 0

        upcoming_payments: List[RecurringExpense] = []
        recently_changed: List[RecurringExpense] = []
        needs_attention: List[RecurringExpense] = []

        for item in all_items:
            if item.status in {"USER_IGNORED", "PAUSED"}:
                continue

            # Monthly equivalent multiplier
            amount = item.latest_amount
            freq = item.frequency
            monthly_equiv = amount
            if freq == "WEEKLY":
                monthly_equiv = (amount * Decimal("4.33")).quantize(Decimal("0.01"))
            elif freq == "BIWEEKLY":
                monthly_equiv = (amount * Decimal("2.17")).quantize(Decimal("0.01"))
            elif freq == "MONTHLY":
                monthly_equiv = amount
            elif freq == "QUARTERLY":
                monthly_equiv = (amount / Decimal("3.0")).quantize(Decimal("0.01"))
            elif freq == "YEARLY":
                monthly_equiv = (amount / Decimal("12.0")).quantize(Decimal("0.01"))

            # Only active & overdue contribute to current estimated monthly spend
            if item.status in {"ACTIVE", "OVERDUE_EXPECTED"}:
                total_monthly += monthly_equiv
                if item.is_variable_amount:
                    variable_monthly += monthly_equiv
                else:
                    fixed_monthly += monthly_equiv

                if item.recurring_type == "SUBSCRIPTION":
                    subscription_count += 1
                    sub_monthly += monthly_equiv
                elif item.recurring_type == "RECURRING_BILL":
                    recurring_count += 1
                    bill_monthly += monthly_equiv
                else:
                    recurring_count += 1
                    other_monthly += monthly_equiv

                # Upcoming payments: active items with next expected date within next 30 days
                if item.status == "ACTIVE" and item.next_expected_date >= (now - datetime.timedelta(days=1)):
                    upcoming_payments.append(item)

            if item.status in {"OVERDUE_EXPECTED", "POSSIBLY_ENDED"}:
                needs_attention.append(item)

            if item.amount_change is not None and item.amount_change != Decimal("0.00"):
                recently_changed.append(item)

        # Sort upcoming by next date
        upcoming_payments.sort(key=lambda x: x.next_expected_date)

        return {
            "total_monthly_recurring_spend": total_monthly.quantize(Decimal("0.01")),
            "subscription_count": subscription_count,
            "recurring_expense_count": recurring_count,
            "fixed_recurring_spend": fixed_monthly.quantize(Decimal("0.01")),
            "variable_recurring_spend": variable_monthly.quantize(Decimal("0.01")),
            "subscription_monthly_spend": sub_monthly.quantize(Decimal("0.01")),
            "bill_monthly_spend": bill_monthly.quantize(Decimal("0.01")),
            "other_monthly_spend": other_monthly.quantize(Decimal("0.01")),
            "upcoming_payments": upcoming_payments[:10],
            "recently_changed": recently_changed[:10],
            "needs_attention": needs_attention[:10],
            "total_detected_count": len(all_items),
        }

    @classmethod
    def get_merchant_transaction_history(
        cls, db: Session, user_id: int, normalized_merchant: str, limit: int = 20
    ) -> List[Transaction]:
        """Fetch past transactions for a normalized merchant to display in detail sheet."""
        norm_merchant = normalized_merchant.strip().upper()
        # Query matching normalized_merchant or merchant
        txs = (
            db.query(Transaction)
            .filter(
                Transaction.user_id == user_id,
                Transaction.transaction_type == "expense",
                or_(
                    Transaction.normalized_merchant == norm_merchant,
                    Transaction.merchant.ilike(f"%{norm_merchant}%"),
                ),
            )
            .order_by(Transaction.transaction_date.desc())
            .limit(limit)
            .all()
        )
        return txs
