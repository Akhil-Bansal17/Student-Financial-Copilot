import datetime
from decimal import Decimal
from typing import List, Dict, Any, Optional
from collections import defaultdict
import statistics
from sqlalchemy.orm import Session

from app.models.transaction import Transaction
from app.schemas.personalization import (
    DataSufficiencyLevel,
    FrequentMerchantSignal,
    FrequentCategorySignal,
    SpendingTimingSignal,
    BehavioralSignalsResponse,
)
from app.services.transaction_normalization_service import TransactionNormalizationService


class BehavioralSignalService:
    """
    Deterministic behavioral signal intelligence.
    Extracts verified patterns from user transaction history without LLM hallucinations.
    Enforces strict data sufficiency criteria.
    """

    @classmethod
    def calculate_behavioral_signals(
        cls,
        db: Session,
        user_id: int,
        lookback_days: int = 90,
    ) -> BehavioralSignalsResponse:
        now = datetime.datetime.now(datetime.timezone.utc)
        since_date = now - datetime.timedelta(days=lookback_days)

        # Query all verified transactions in lookback period
        transactions: List[Transaction] = (
            db.query(Transaction)
            .filter(
                Transaction.user_id == user_id,
                Transaction.transaction_date >= since_date,
            )
            .order_by(Transaction.transaction_date.desc())
            .all()
        )

        total_tx_count = len(transactions)

        # 1. Determine Data Sufficiency
        if total_tx_count < 5:
            sufficiency = DataSufficiencyLevel.INSUFFICIENT
        elif total_tx_count < 15:
            sufficiency = DataSufficiencyLevel.LIMITED
        elif total_tx_count < 45:
            sufficiency = DataSufficiencyLevel.MODERATE
        else:
            sufficiency = DataSufficiencyLevel.STRONG

        # Expense transactions only for spending signals
        expense_txs = [t for t in transactions if str(t.transaction_type).lower() == "expense"]
        expense_amounts: List[Decimal] = [Decimal(str(t.amount)) for t in expense_txs if t.amount is not None]

        # 2. Typical and Baseline Amounts (Median & Outlier Fence)
        if expense_amounts:
            float_amounts = [float(a) for a in expense_amounts]
            typical_amount = Decimal(str(round(statistics.median(float_amounts), 2)))
            average_amount = Decimal(str(round(statistics.mean(float_amounts), 2)))

            # Calculate robust large transaction baseline using median & IQR
            if len(float_amounts) >= 4:
                float_amounts_sorted = sorted(float_amounts)
                q1 = float_amounts_sorted[len(float_amounts_sorted) // 4]
                q3 = float_amounts_sorted[(3 * len(float_amounts_sorted)) // 4]
                iqr = q3 - q1
                calculated_large = max(q3 + 1.5 * iqr, float(typical_amount) * 2.5, 1000.0)
            else:
                calculated_large = max(float(typical_amount) * 2.5, 1500.0)

            calculated_large_threshold = Decimal(str(round(calculated_large, 2)))
        else:
            typical_amount = Decimal("0.00")
            average_amount = Decimal("0.00")
            calculated_large_threshold = Decimal("2000.00")

        # 3. Frequent Merchants
        merchant_stats: Dict[str, Dict[str, Any]] = defaultdict(
            lambda: {"count": 0, "total": Decimal("0.00"), "category": "General"}
        )
        total_expense_spend = sum(expense_amounts, Decimal("0.00"))

        for t in expense_txs:
            raw_merchant = t.normalized_merchant or t.merchant or t.description or "Unknown Merchant"
            norm_merch, disp_merch = TransactionNormalizationService.extract_merchant(raw_merchant)
            clean_merchant = norm_merch or disp_merch or TransactionNormalizationService.clean_text(raw_merchant) or "Unknown Merchant"
            amt = Decimal(str(t.amount))
            merchant_stats[clean_merchant]["count"] += 1
            merchant_stats[clean_merchant]["total"] += amt
            if t.category:
                merchant_stats[clean_merchant]["category"] = t.category

        frequent_merchants: List[FrequentMerchantSignal] = []
        min_occurrences = 2 if sufficiency in (DataSufficiencyLevel.LIMITED, DataSufficiencyLevel.MODERATE) else 3

        for merch_name, stats in merchant_stats.items():
            if stats["count"] >= min_occurrences and total_expense_spend > Decimal("0.00"):
                share = float((stats["total"] / total_expense_spend) * Decimal("100.0"))
                avg = stats["total"] / Decimal(str(stats["count"]))
                frequent_merchants.append(
                    FrequentMerchantSignal(
                        merchant_name=merch_name,
                        transaction_count=stats["count"],
                        total_spend=stats["total"],
                        average_amount=Decimal(str(round(avg, 2))),
                        category=stats["category"],
                        frequency_share_pct=round(share, 1),
                    )
                )

        frequent_merchants.sort(key=lambda m: (m.transaction_count, m.total_spend), reverse=True)
        top_merchants = frequent_merchants[:5]

        # 4. Frequent / Major Categories
        cat_totals: Dict[str, Dict[str, Any]] = defaultdict(lambda: {"total": Decimal("0.00"), "count": 0})
        for t in expense_txs:
            cat = t.category or "Uncategorized"
            amt = Decimal(str(t.amount))
            cat_totals[cat]["total"] += amt
            cat_totals[cat]["count"] += 1

        frequent_categories: List[FrequentCategorySignal] = []
        for cat, data in cat_totals.items():
            pct = (
                float((data["total"] / total_expense_spend) * Decimal("100.0"))
                if total_expense_spend > Decimal("0.00")
                else 0.0
            )
            frequent_categories.append(
                FrequentCategorySignal(
                    category=cat,
                    total_spend=data["total"],
                    percentage=round(pct, 1),
                    transaction_count=data["count"],
                )
            )

        frequent_categories.sort(key=lambda c: c.total_spend, reverse=True)
        top_categories = frequent_categories[:5]

        # 5. Spending Timing Patterns
        weekend_spend = Decimal("0.00")
        weekday_spend = Decimal("0.00")
        start_spend = Decimal("0.00")
        mid_spend = Decimal("0.00")
        end_spend = Decimal("0.00")

        for t in expense_txs:
            amt = Decimal(str(t.amount))
            tx_dt = t.transaction_date
            # Weekday (0-4) vs Weekend (5-6)
            if tx_dt.weekday() in (5, 6):
                weekend_spend += amt
            else:
                weekday_spend += amt

            # Month phase
            day = tx_dt.day
            if day <= 10:
                start_spend += amt
            elif day <= 20:
                mid_spend += amt
            else:
                end_spend += amt

        if total_expense_spend > Decimal("0.00"):
            weekend_pct = round(float((weekend_spend / total_expense_spend) * Decimal("100.0")), 1)
            weekday_pct = round(float((weekday_spend / total_expense_spend) * Decimal("100.0")), 1)
            start_pct = round(float((start_spend / total_expense_spend) * Decimal("100.0")), 1)
            mid_pct = round(float((mid_spend / total_expense_spend) * Decimal("100.0")), 1)
            end_pct = round(float((end_spend / total_expense_spend) * Decimal("100.0")), 1)
        else:
            weekend_pct = 0.0
            weekday_pct = 0.0
            start_pct = 0.0
            mid_pct = 0.0
            end_pct = 0.0

        if sufficiency == DataSufficiencyLevel.INSUFFICIENT:
            timing_observation = "Insufficient transaction records to determine reliable timing patterns."
        elif weekend_pct > 40.0:
            timing_observation = f"Higher proportion of discretionary spend occurs during weekends ({weekend_pct}%)."
        elif start_pct > 50.0:
            timing_observation = f"Spending is front-loaded in the first 10 days of the month ({start_pct}%)."
        else:
            timing_observation = f"Spending is distributed steadily throughout the week ({weekday_pct}% weekday, {weekend_pct}% weekend)."

        spending_timing = SpendingTimingSignal(
            weekend_spend_percentage=weekend_pct,
            weekday_spend_percentage=weekday_pct,
            month_start_spend_percentage=start_pct,
            month_mid_spend_percentage=mid_pct,
            month_end_spend_percentage=end_pct,
            timing_observation=timing_observation,
        )

        # 6. Signals Summary Narrative
        if sufficiency == DataSufficiencyLevel.INSUFFICIENT:
            signals_summary = (
                f"Data sufficiency is {sufficiency.value} ({total_tx_count} transactions recorded). "
                "Add more transactions to unlock deeper behavioral personalization."
            )
        elif top_categories and top_merchants:
            signals_summary = (
                f"Evaluated {total_tx_count} transactions ({sufficiency.value} data). "
                f"Typical transaction amount is ₹{typical_amount:,.2f}. "
                f"Primary expense category is {top_categories[0].category} ({top_categories[0].percentage}%). "
                f"Most frequent merchant is {top_merchants[0].merchant_name}."
            )
        elif top_categories:
            signals_summary = (
                f"Evaluated {total_tx_count} transactions ({sufficiency.value} data). "
                f"Typical transaction amount is ₹{typical_amount:,.2f}. "
                f"Primary category is {top_categories[0].category}."
            )
        else:
            signals_summary = (
                f"Evaluated {total_tx_count} transactions ({sufficiency.value} data). "
                "Baseline spending patterns are emerging."
            )

        return BehavioralSignalsResponse(
            data_sufficiency=sufficiency,
            transaction_count=total_tx_count,
            analyzed_period_months=max(1, lookback_days // 30),
            typical_transaction_amount=typical_amount,
            average_transaction_amount=average_amount,
            calculated_large_threshold=calculated_large_threshold,
            frequent_merchants=top_merchants,
            frequent_categories=top_categories,
            spending_timing=spending_timing,
            signals_summary=signals_summary,
            generated_at=now,
        )
