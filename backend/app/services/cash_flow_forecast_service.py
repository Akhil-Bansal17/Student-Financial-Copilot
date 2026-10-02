import calendar
import datetime
from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, List, Optional, Tuple, Set
import sqlalchemy as sa
from sqlalchemy import func, and_, or_
from sqlalchemy.orm import Session

from app.core.constants import (
    DEFAULT_FORECAST_HORIZON_DAYS,
    DEFAULT_MINIMUM_BALANCE_THRESHOLD,
    FORECAST_HORIZONS,
    RECURRING_INCOME_CATEGORIES,
)
from app.models.account import ConnectedAccount
from app.models.budget import Budget
from app.models.financial_profile import FinancialProfile
from app.models.forecast_preference import ForecastPreference
from app.models.goal import Goal
from app.models.recurring_expense import RecurringExpense
from app.models.transaction import Transaction
from app.schemas.forecast import (
    CashFlowForecastResponse,
    ForecastBudgetPressure,
    ForecastDailyPointResponse,
    ForecastEventResponse,
    ForecastGoalPlanning,
    ForecastSummaryResponse,
    ForecastTimelineResponse,
    ForecastPreferenceUpdate,
    ForecastPreferenceResponse,
)


def _add_months_clamped(orig_date: datetime.date, months_to_add: int, preferred_day: int) -> datetime.date:
    """
    Safely step forward by months_to_add while preserving the preferred_day of the month,
    clamped to the maximum number of days in the target month (e.g. Jan 31 -> Feb 28/29).
    """
    month_val = orig_date.month - 1 + months_to_add
    year_val = orig_date.year + month_val // 12
    new_month = month_val % 12 + 1
    max_days = calendar.monthrange(year_val, new_month)[1]
    new_day = min(preferred_day, max_days)
    return datetime.date(year_val, new_month, new_day)


class CashFlowForecastService:
    """
    Authoritative deterministic financial forecasting service.
    Estimates future cash position using verified ledger balance, connected bank accounts,
    Phase 12 recurring expense intelligence, recurring income patterns, and discretionary spending baseline.
    """

    @staticmethod
    def get_or_create_preference(db: Session, user_id: int) -> ForecastPreference:
        """Fetch user's forecast preference or initialize with default minimum threshold."""
        pref = (
            db.query(ForecastPreference)
            .filter(ForecastPreference.user_id == user_id)
            .first()
        )
        if not pref:
            pref = ForecastPreference(
                user_id=user_id,
                minimum_balance_threshold=DEFAULT_MINIMUM_BALANCE_THRESHOLD,
                is_enabled=True,
            )
            db.add(pref)
            db.commit()
            db.refresh(pref)
        return pref

    @staticmethod
    def update_preference(
        db: Session, user_id: int, payload: ForecastPreferenceUpdate
    ) -> ForecastPreference:
        """Update user's forecast preference with strict user isolation."""
        pref = CashFlowForecastService.get_or_create_preference(db, user_id)
        if payload.minimum_balance_threshold is not None:
            pref.minimum_balance_threshold = Decimal(str(payload.minimum_balance_threshold)).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_UP
            )
        if payload.is_enabled is not None:
            pref.is_enabled = payload.is_enabled

        db.commit()
        db.refresh(pref)
        return pref

    @classmethod
    def compute_cash_flow_forecast(
        cls,
        db: Session,
        user_id: int,
        days: int = DEFAULT_FORECAST_HORIZON_DAYS,
        as_of_date: Optional[datetime.date] = None,
    ) -> CashFlowForecastResponse:
        """
        Compute deterministic cash flow forecast over horizon (7, 30, or 90 days).
        """
        if days not in FORECAST_HORIZONS:
            if days <= 7:
                days = 7
            elif days <= 30:
                days = 30
            else:
                days = 90

        today = as_of_date or datetime.datetime.now(datetime.timezone.utc).date()
        horizon_end_date = today + datetime.timedelta(days=days)

        # 1. Fetch user forecast preference
        pref = cls.get_or_create_preference(db, user_id)
        min_threshold = (
            Decimal(str(pref.minimum_balance_threshold)).quantize(Decimal("0.01"))
            if pref and pref.minimum_balance_threshold is not None
            else DEFAULT_MINIMUM_BALANCE_THRESHOLD
        )

        # 2. Starting Balances
        profile = (
            db.query(FinancialProfile)
            .filter(FinancialProfile.user_id == user_id)
            .first()
        )
        starting_ledger = (
            Decimal(str(profile.starting_balance)).quantize(Decimal("0.01"))
            if profile and profile.starting_balance is not None
            else Decimal("0.00")
        )

        # Query all posted transactions to determine authoritative ledger balance & history
        # Exclude REVERSED transactions; pending transactions do not modify posted ledger balance
        tx_rows = (
            db.query(Transaction)
            .filter(
                Transaction.user_id == user_id,
                Transaction.status == "POSTED",
            )
            .order_by(Transaction.transaction_date.asc())
            .all()
        )

        hist_income = Decimal("0.00")
        hist_expense = Decimal("0.00")
        for tx in tx_rows:
            amt = Decimal(str(tx.amount)).quantize(Decimal("0.01"))
            if tx.transaction_type == "income":
                hist_income += amt
            elif tx.transaction_type == "expense":
                hist_expense += amt

        current_ledger_balance = (starting_ledger + hist_income - hist_expense).quantize(Decimal("0.01"))

        # Connected bank balance & freshness
        connected_accounts = (
            db.query(ConnectedAccount)
            .filter(
                ConnectedAccount.user_id == user_id,
                ConnectedAccount.status == "ACTIVE",
            )
            .all()
        )

        current_connected_bank_balance: Optional[Decimal] = None
        latest_bank_sync: Optional[datetime.datetime] = None
        bank_freshness_desc: Optional[str] = None

        if connected_accounts:
            total_bank_bal = Decimal("0.00")
            for acc in connected_accounts:
                if acc.current_balance is not None:
                    total_bank_bal += Decimal(str(acc.current_balance)).quantize(Decimal("0.01"))
                if acc.last_synced_at is not None:
                    if latest_bank_sync is None or acc.last_synced_at > latest_bank_sync:
                        latest_bank_sync = acc.last_synced_at
            current_connected_bank_balance = total_bank_bal.quantize(Decimal("0.01"))

            if latest_bank_sync is not None:
                now_utc = datetime.datetime.now(datetime.timezone.utc)
                diff = now_utc - latest_bank_sync
                diff_hours = int(diff.total_seconds() // 3600)
                if diff_hours < 1:
                    bank_freshness_desc = "Bank data was synchronized less than an hour ago."
                elif diff_hours < 24:
                    bank_freshness_desc = f"Bank data was last synchronized {diff_hours} hours ago."
                else:
                    diff_days = int(diff.total_seconds() // 86400)
                    bank_freshness_desc = f"Bank data was last synchronized {diff_days} days ago."
            else:
                bank_freshness_desc = "Bank account connected but not yet synchronized."

        # By default, authoritative starting balance for forecast is current_ledger_balance
        starting_forecast_balance = current_ledger_balance

        # 3. Data Sufficiency & History Evaluation
        tx_count = len(tx_rows)
        history_span_days = 0
        if tx_rows:
            earliest_dt = tx_rows[0].transaction_date
            latest_dt = tx_rows[-1].transaction_date
            history_span_days = max(1, (latest_dt.date() - earliest_dt.date()).days + 1)

        if tx_count < 5 or history_span_days < 14:
            data_sufficiency = "INSUFFICIENT"
        elif tx_count < 15 or history_span_days < 30:
            data_sufficiency = "LIMITED"
        elif tx_count < 45 and history_span_days < 60:
            data_sufficiency = "MODERATE"
        else:
            data_sufficiency = "STRONG"

        # 4. Phase 12 Recurring Expenses Projection
        # Only ACTIVE and OVERDUE_EXPECTED recurrences are projected
        active_recurring = (
            db.query(RecurringExpense)
            .filter(
                RecurringExpense.user_id == user_id,
                RecurringExpense.status.in_(["ACTIVE", "OVERDUE_EXPECTED"]),
            )
            .all()
        )

        recurring_events: List[ForecastEventResponse] = []
        expected_recurring_total = Decimal("0.00")
        recurring_merchant_names: Set[str] = set()

        for rec in active_recurring:
            if rec.normalized_merchant:
                recurring_merchant_names.add(rec.normalized_merchant.upper())

            amt = Decimal(str(rec.latest_amount or rec.average_amount)).quantize(Decimal("0.01"))
            next_date = rec.next_expected_date.date()
            if next_date < today:
                # If overdue, place at today or next date
                next_date = today

            preferred_day = rec.next_expected_date.day
            curr_event_date = next_date

            # Step forward through the horizon
            while curr_event_date <= horizon_end_date:
                if curr_event_date >= today:
                    rec_type_label = (
                        "RECURRING_SUBSCRIPTION"
                        if rec.recurring_type == "SUBSCRIPTION"
                        else "RECURRING_BILL"
                        if rec.recurring_type == "RECURRING_BILL"
                        else "RECURRING_EXPENSE"
                    )
                    event_id = f"rec-{rec.id}-{curr_event_date.isoformat()}"
                    recurring_events.append(
                        ForecastEventResponse(
                            id=event_id,
                            date=curr_event_date,
                            type=rec_type_label,
                            name=rec.merchant,
                            amount=amt,
                            is_inflow=False,
                            category=rec.category,
                            source="RECURRING_EXPENSE",
                            is_known_commitment=True,
                            projected_balance_after=Decimal("0.00"),  # calculated later
                        )
                    )
                    expected_recurring_total += amt

                # Advance to next occurrence
                if rec.frequency == "WEEKLY":
                    curr_event_date += datetime.timedelta(days=7)
                elif rec.frequency == "BIWEEKLY":
                    curr_event_date += datetime.timedelta(days=14)
                elif rec.frequency == "MONTHLY":
                    curr_event_date = _add_months_clamped(curr_event_date, 1, preferred_day)
                elif rec.frequency == "QUARTERLY":
                    curr_event_date = _add_months_clamped(curr_event_date, 3, preferred_day)
                elif rec.frequency == "YEARLY":
                    curr_event_date = _add_months_clamped(curr_event_date, 12, preferred_day)
                else:
                    curr_event_date += datetime.timedelta(days=30)

        # 5. Predictable Recurring Income Pattern Detection & Projection
        income_events: List[ForecastEventResponse] = []
        expected_income_total = Decimal("0.00")

        # Cluster historical income transactions
        income_txs = [tx for tx in tx_rows if tx.transaction_type == "income"]
        income_clusters: Dict[str, List[Transaction]] = {}
        for itx in income_txs:
            # Group by normalized_merchant if available, else category if in RECURRING_INCOME_CATEGORIES
            cluster_key = None
            if itx.normalized_merchant:
                cluster_key = f"M:{itx.normalized_merchant.upper()}"
            elif itx.category in RECURRING_INCOME_CATEGORIES:
                cluster_key = f"C:{itx.category}"

            if cluster_key:
                income_clusters.setdefault(cluster_key, []).append(itx)

        for c_key, c_txs in income_clusters.items():
            if len(c_txs) < 2:
                continue

            # Sort by date
            c_txs.sort(key=lambda t: t.transaction_date)
            # Calculate intervals between consecutive occurrences
            intervals = [
                (c_txs[i + 1].transaction_date.date() - c_txs[i].transaction_date.date()).days
                for i in range(len(c_txs) - 1)
            ]
            if not intervals:
                continue

            avg_interval = sum(intervals) / len(intervals)
            # Check amount consistency (mean and std dev)
            amounts = [Decimal(str(t.amount)) for t in c_txs]
            avg_amount = sum(amounts) / Decimal(str(len(amounts)))
            if avg_amount <= Decimal("0.00"):
                continue

            variance = sum((a - avg_amount) ** 2 for a in amounts) / Decimal(str(len(amounts)))
            std_dev = Decimal(str(float(variance) ** 0.5))
            cv = (std_dev / avg_amount) if avg_amount > Decimal("0.00") else Decimal("1.0")

            # We treat income as recurring ONLY if cv <= 0.35 and avg_interval is reasonably regular (~30, ~14, ~7 days)
            is_regular = False
            cadence_days = 30
            is_monthly = False
            if 24 <= avg_interval <= 35:
                is_regular = True
                cadence_days = 30
                is_monthly = True
            elif 11 <= avg_interval <= 17:
                is_regular = True
                cadence_days = 14
            elif 5 <= avg_interval <= 9:
                is_regular = True
                cadence_days = 7

            if is_regular and cv <= Decimal("0.35"):
                last_income_tx = c_txs[-1]
                last_date = last_income_tx.transaction_date.date()
                preferred_day = last_date.day

                # Next occurrence date
                if is_monthly:
                    next_income_date = _add_months_clamped(last_date, 1, preferred_day)
                else:
                    next_income_date = last_date + datetime.timedelta(days=cadence_days)

                # Catch up to today if needed
                while next_income_date < today:
                    if is_monthly:
                        next_income_date = _add_months_clamped(next_income_date, 1, preferred_day)
                    else:
                        next_income_date += datetime.timedelta(days=cadence_days)

                source_name = last_income_tx.merchant or last_income_tx.category or "Predictable Income"
                income_amt = avg_amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

                while next_income_date <= horizon_end_date:
                    if next_income_date >= today:
                        ev_id = f"inc-{c_key}-{next_income_date.isoformat()}"
                        income_events.append(
                            ForecastEventResponse(
                                id=ev_id,
                                date=next_income_date,
                                type="EXPECTED_INCOME",
                                name=f"Expected {source_name}",
                                amount=income_amt,
                                is_inflow=True,
                                category=last_income_tx.category,
                                source="RECURRING_INCOME",
                                is_known_commitment=False,
                                projected_balance_after=Decimal("0.00"),
                            )
                        )
                        expected_income_total += income_amt

                    if is_monthly:
                        next_income_date = _add_months_clamped(next_income_date, 1, preferred_day)
                    else:
                        next_income_date += datetime.timedelta(days=cadence_days)

        # 6. Discretionary Spending Baseline
        # Separate non-recurring expenses from active recurring merchants
        discretionary_spend_hist = Decimal("0.00")
        for tx in tx_rows:
            if tx.transaction_type == "expense":
                norm_m = (tx.normalized_merchant or "").upper()
                if norm_m not in recurring_merchant_names:
                    discretionary_spend_hist += Decimal(str(tx.amount))

        estimated_discretionary_spending = Decimal("0.00")
        daily_discretionary_burn = Decimal("0.00")

        if data_sufficiency != "INSUFFICIENT" and history_span_days > 0:
            daily_discretionary_burn = (
                discretionary_spend_hist / Decimal(str(history_span_days))
            ).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            estimated_discretionary_spending = (
                daily_discretionary_burn * Decimal(str(days))
            ).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

        # Distribute discretionary spending as timeline checkpoints (e.g. weekly or midpoint)
        discretionary_events: List[ForecastEventResponse] = []
        if estimated_discretionary_spending > Decimal("0.00"):
            # Break down discretionary spending into weekly milestones across the horizon
            chunk_days = 7 if days >= 14 else days
            num_chunks = max(1, days // chunk_days)
            chunk_amount = (estimated_discretionary_spending / Decimal(str(num_chunks))).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_UP
            )
            for i in range(1, num_chunks + 1):
                chunk_date = min(today + datetime.timedelta(days=i * chunk_days), horizon_end_date)
                discretionary_events.append(
                    ForecastEventResponse(
                        id=f"disc-spending-{chunk_date.isoformat()}-{i}",
                        date=chunk_date,
                        type="ESTIMATED_SPENDING",
                        name="Estimated Discretionary Spending",
                        amount=chunk_amount,
                        is_inflow=False,
                        category="Other",
                        source="ESTIMATED_SPENDING",
                        is_known_commitment=False,
                        projected_balance_after=Decimal("0.00"),
                    )
                )

        # 7. Merge all discrete events into sorted timeline
        all_discrete_events = recurring_events + income_events
        all_discrete_events.sort(key=lambda e: (e.date, not e.is_inflow, e.name))

        # 8. Build Daily Points and Calculate Running Balances
        daily_points: List[ForecastDailyPointResponse] = []
        running_balance = starting_forecast_balance

        # Group discrete events by day
        events_by_date: Dict[datetime.date, List[ForecastEventResponse]] = {}
        for ev in all_discrete_events:
            events_by_date.setdefault(ev.date, []).append(ev)

        min_projected_balance = running_balance
        min_balance_date: Optional[datetime.date] = today
        is_negative_projected = running_balance < Decimal("0.00")
        negative_balance_date: Optional[datetime.date] = today if is_negative_projected else None
        is_low_balance_projected = running_balance < min_threshold
        low_balance_date: Optional[datetime.date] = today if is_low_balance_projected else None

        # Build day-by-day trajectory
        curr_d = today
        while curr_d <= horizon_end_date:
            day_inflow = Decimal("0.00")
            day_outflow = Decimal("0.00")

            # Apply discrete events for this day
            if curr_d in events_by_date:
                for ev in events_by_date[curr_d]:
                    if ev.is_inflow:
                        day_inflow += ev.amount
                        running_balance += ev.amount
                    else:
                        day_outflow += ev.amount
                        running_balance -= ev.amount
                    ev.projected_balance_after = running_balance.quantize(Decimal("0.01"))

            # Apply daily discretionary burn (if past starting day)
            if curr_d > today and daily_discretionary_burn > Decimal("0.00"):
                day_outflow += daily_discretionary_burn
                running_balance -= daily_discretionary_burn

            running_balance = running_balance.quantize(Decimal("0.01"))

            # Track minimums and alerts
            if running_balance < min_projected_balance:
                min_projected_balance = running_balance
                min_balance_date = curr_d

            if running_balance < Decimal("0.00") and not is_negative_projected:
                is_negative_projected = True
                negative_balance_date = curr_d

            if running_balance < min_threshold and not is_low_balance_projected:
                is_low_balance_projected = True
                low_balance_date = curr_d

            daily_points.append(
                ForecastDailyPointResponse(
                    date=curr_d,
                    projected_balance=running_balance,
                    is_actual=(curr_d == today),
                    events_count=len(events_by_date.get(curr_d, [])),
                    daily_inflow=day_inflow.quantize(Decimal("0.01")),
                    daily_outflow=day_outflow.quantize(Decimal("0.01")),
                    is_below_minimum=(running_balance < min_threshold),
                    is_negative=(running_balance < Decimal("0.00")),
                )
            )

            curr_d += datetime.timedelta(days=1)

        final_projected_balance = running_balance
        projected_total_outflow = (expected_recurring_total + estimated_discretionary_spending).quantize(
            Decimal("0.01")
        )
        net_cash_flow = (expected_income_total - projected_total_outflow).quantize(Decimal("0.01"))

        # 9. Forecast Confidence Rating
        # Deterministic scoring: data sufficiency, recurring data presence, bank freshness
        if data_sufficiency == "INSUFFICIENT":
            confidence = "LOW"
        elif data_sufficiency == "LIMITED":
            confidence = "LOW" if not active_recurring else "MEDIUM"
        elif data_sufficiency == "MODERATE":
            confidence = "MEDIUM"
        else:  # STRONG
            confidence = "HIGH"

        # Downgrade confidence if bank data exists but is stale > 48 hours
        if connected_accounts and latest_bank_sync is not None:
            now_utc = datetime.datetime.now(datetime.timezone.utc)
            if (now_utc - latest_bank_sync).total_seconds() > 172800:  # 48 hours
                if confidence == "HIGH":
                    confidence = "MEDIUM"

        # 10. Goal Planning Integration
        active_goals = (
            db.query(Goal)
            .filter(
                Goal.user_id == user_id,
                Goal.current_amount < Goal.target_amount,
            )
            .all()
        )

        goal_planning: List[ForecastGoalPlanning] = []
        # Cash available for goals = min(final_projected_balance, min_projected_balance) - min_threshold
        safe_surplus = max(Decimal("0.00"), min_projected_balance - min_threshold)

        for g in active_goals:
            rem_amt = (Decimal(str(g.target_amount)) - Decimal(str(g.current_amount))).quantize(
                Decimal("0.01")
            )
            sugg_alloc: Optional[Decimal] = None
            if g.target_date and g.target_date > today:
                months_left = max(
                    1, (g.target_date.year - today.year) * 12 + (g.target_date.month - today.month)
                )
                sugg_alloc = (rem_amt / Decimal(str(months_left))).quantize(
                    Decimal("0.01"), rounding=ROUND_HALF_UP
                )
            else:
                sugg_alloc = (rem_amt / Decimal("6.0")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

            is_afford = (sugg_alloc <= safe_surplus) if sugg_alloc is not None else False

            goal_planning.append(
                ForecastGoalPlanning(
                    goal_id=g.id,
                    goal_name=g.name,
                    target_amount=Decimal(str(g.target_amount)).quantize(Decimal("0.01")),
                    current_amount=Decimal(str(g.current_amount)).quantize(Decimal("0.01")),
                    remaining_amount=rem_amt,
                    target_date=g.target_date,
                    suggested_monthly_allocation=sugg_alloc,
                    is_affordable=is_afford,
                )
            )

        # 11. Budget Pressure Integration (Current Month)
        current_year = today.year
        current_month = today.month
        month_budgets = (
            db.query(Budget)
            .filter(
                Budget.user_id == user_id,
                Budget.year == current_year,
                Budget.month == current_month,
            )
            .all()
        )

        # Spending in current month by category
        start_curr_month = datetime.datetime(current_year, current_month, 1, 0, 0, 0, tzinfo=datetime.timezone.utc)
        curr_month_txs = (
            db.query(
                Transaction.category,
                func.coalesce(func.sum(Transaction.amount), Decimal("0.00")).label("spent"),
            )
            .filter(
                Transaction.user_id == user_id,
                Transaction.transaction_type == "expense",
                Transaction.status == "POSTED",
                Transaction.transaction_date >= start_curr_month,
            )
            .group_by(Transaction.category)
            .all()
        )
        spent_map = {row.category: Decimal(str(row.spent)).quantize(Decimal("0.01")) for row in curr_month_txs}

        # Upcoming recurring in current month by category
        days_in_month = calendar.monthrange(current_year, current_month)[1]
        end_curr_month_date = datetime.date(current_year, current_month, days_in_month)

        recurring_month_map: Dict[str, Decimal] = {}
        for ev in recurring_events:
            if ev.date <= end_curr_month_date and ev.category:
                recurring_month_map[ev.category] = (
                    recurring_month_map.get(ev.category, Decimal("0.00")) + ev.amount
                )

        budget_pressure: List[ForecastBudgetPressure] = []
        for b in month_budgets:
            cat = b.category or "Overall"
            alloc_amt = Decimal(str(b.amount)).quantize(Decimal("0.01"))
            actual_spent = spent_map.get(cat, Decimal("0.00"))
            proj_rec = recurring_month_map.get(cat, Decimal("0.00"))
            proj_tot = (actual_spent + proj_rec).quantize(Decimal("0.01"))
            util_pct = (
                ((proj_tot / alloc_amt) * Decimal("100")).quantize(Decimal("0.1"))
                if alloc_amt > Decimal("0.00")
                else Decimal("0.0")
            )
            is_over = proj_tot > alloc_amt

            budget_pressure.append(
                ForecastBudgetPressure(
                    budget_id=b.id,
                    category=cat,
                    allocated_amount=alloc_amt,
                    spent_amount=actual_spent,
                    projected_recurring_spend=proj_rec,
                    projected_total_spend=proj_tot,
                    utilization_percentage=util_pct,
                    projected_over_budget=is_over,
                )
            )

        # 12. Warnings and Contributing Factors
        warnings: List[str] = []
        contributing_factors: List[str] = []

        if is_negative_projected and negative_balance_date:
            warnings.append(
                f"Your projected balance becomes negative around {negative_balance_date.strftime('%b %d, %Y')} "
                f"based on current recurring commitments and spending patterns."
            )
        elif is_low_balance_projected and low_balance_date:
            warnings.append(
                f"Your projected balance may fall below your minimum balance threshold (₹{min_threshold:,.2f}) "
                f"around {low_balance_date.strftime('%b %d, %Y')}."
            )

        if data_sufficiency == "INSUFFICIENT":
            warnings.append(
                "Limited transaction history available. Forecast is based primarily on verified starting balance and any active recurring commitments."
            )

        if expected_recurring_total > Decimal("0.00"):
            contributing_factors.append(
                f"₹{expected_recurring_total:,.2f} in verified recurring commitments across {len(recurring_events)} scheduled payment(s)."
            )

        if expected_income_total > Decimal("0.00"):
            contributing_factors.append(
                f"₹{expected_income_total:,.2f} in predictable recurring income."
            )

        if estimated_discretionary_spending > Decimal("0.00"):
            contributing_factors.append(
                f"₹{estimated_discretionary_spending:,.2f} estimated discretionary spending baseline (₹{daily_discretionary_burn:,.2f}/day)."
            )

        # Assemble unified timeline
        unified_timeline = sorted(
            all_discrete_events + discretionary_events,
            key=lambda e: (e.date, not e.is_inflow, e.name),
        )

        return CashFlowForecastResponse(
            current_ledger_balance=current_ledger_balance,
            current_connected_bank_balance=current_connected_bank_balance,
            starting_balance=starting_forecast_balance,
            projected_balance=final_projected_balance,
            net_cash_flow=net_cash_flow,
            forecast_days=days,
            expected_income=expected_income_total,
            expected_recurring_expenses=expected_recurring_total,
            estimated_discretionary_spending=estimated_discretionary_spending,
            projected_total_outflow=projected_total_outflow,
            minimum_projected_balance=min_projected_balance,
            minimum_balance_date=min_balance_date,
            is_negative_projected=is_negative_projected,
            negative_balance_date=negative_balance_date,
            is_low_balance_projected=is_low_balance_projected,
            low_balance_date=low_balance_date,
            minimum_balance_threshold=min_threshold,
            data_sufficiency=data_sufficiency,
            confidence=confidence,
            bank_data_freshness=bank_freshness_desc,
            bank_last_synced_at=latest_bank_sync,
            timeline=unified_timeline,
            daily_points=daily_points,
            goal_planning=goal_planning,
            budget_pressure=budget_pressure,
            contributing_factors=contributing_factors,
            warnings=warnings,
        )

    @classmethod
    def get_summary(
        cls,
        db: Session,
        user_id: int,
        days: int = DEFAULT_FORECAST_HORIZON_DAYS,
    ) -> ForecastSummaryResponse:
        """Return high-level summary of the cash flow forecast."""
        full_forecast = cls.compute_cash_flow_forecast(db, user_id, days=days)
        return ForecastSummaryResponse(
            current_ledger_balance=full_forecast.current_ledger_balance,
            current_connected_bank_balance=full_forecast.current_connected_bank_balance,
            starting_balance=full_forecast.starting_balance,
            projected_balance=full_forecast.projected_balance,
            net_cash_flow=full_forecast.net_cash_flow,
            forecast_days=full_forecast.forecast_days,
            expected_income=full_forecast.expected_income,
            expected_recurring_expenses=full_forecast.expected_recurring_expenses,
            estimated_discretionary_spending=full_forecast.estimated_discretionary_spending,
            projected_total_outflow=full_forecast.projected_total_outflow,
            minimum_projected_balance=full_forecast.minimum_projected_balance,
            minimum_balance_date=full_forecast.minimum_balance_date,
            is_negative_projected=full_forecast.is_negative_projected,
            negative_balance_date=full_forecast.negative_balance_date,
            is_low_balance_projected=full_forecast.is_low_balance_projected,
            low_balance_date=full_forecast.low_balance_date,
            minimum_balance_threshold=full_forecast.minimum_balance_threshold,
            data_sufficiency=full_forecast.data_sufficiency,
            confidence=full_forecast.confidence,
            bank_data_freshness=full_forecast.bank_data_freshness,
            bank_last_synced_at=full_forecast.bank_last_synced_at,
        )

    @classmethod
    def get_timeline(
        cls,
        db: Session,
        user_id: int,
        days: int = DEFAULT_FORECAST_HORIZON_DAYS,
    ) -> ForecastTimelineResponse:
        """Return chronological timeline of projected cash flow events."""
        full_forecast = cls.compute_cash_flow_forecast(db, user_id, days=days)
        return ForecastTimelineResponse(
            forecast_days=full_forecast.forecast_days,
            timeline=full_forecast.timeline,
        )
