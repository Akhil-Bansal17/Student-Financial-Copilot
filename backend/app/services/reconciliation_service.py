import datetime
from decimal import Decimal
import json
import re
from typing import Dict, List, Optional, Tuple
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.account import ConnectedAccount
from app.models.transaction import Transaction
from app.models.reconciliation import TransactionReconciliation
from app.services.bank_provider.base import ProviderTransactionData
from app.services.transaction_normalization_service import TransactionNormalizationService
from app.services.categorization_service import CategorizationService


class TransactionReconciliationService:
    """
    Deterministic, mathematical financial transaction reconciliation engine.
    Matches incoming bank-synced transactions with manual transactions entered by students.
    Prevents duplicate ledger entries, provides explainable confidence scoring,
    and supports safe user review workflows.
    """

    @staticmethod
    def _extract_tokens(text: Optional[str]) -> set:
        if not text:
            return set()
        clean = re.sub(r"[^a-zA-Z0-9\s]", " ", text.lower())
        return {w for w in clean.split() if len(w) >= 3}

    @classmethod
    def score_match(
        cls,
        manual_tx: Transaction,
        bank_dto: ProviderTransactionData,
    ) -> Tuple[Decimal, str, List[str]]:
        """
        Deterministic match scoring formula:
        1. Type check: income vs income, expense vs expense (Hard gate: mismatch = 0.0)
        2. Amount check: exact match = 40 pts, difference <= 1% and <= Rs 5 = 20 pts (mismatch = 0.0)
        3. Date proximity: same day = 25 pts, 1 day = 18 pts, 2-3 days = 10 pts, > 3 days = 0 pts
        4. Description tokens: keyword/brand match = 15 pts, partial overlap = 8 pts
        5. Category compatibility: exact = 10 pts, compatible = 5 pts
        6. Payment method: compatible = 10 pts, default = 5 pts

        Thresholds:
        - Score >= 0.85: HIGH_CONFIDENCE (AUTO_MATCH eligible)
        - Score >= 0.60: POSSIBLE_MATCH (User review required)
        - Score < 0.60: NO_MATCH
        """
        reasons: List[str] = []

        # 1. Transaction Type Check (Hard gate)
        if manual_tx.transaction_type != bank_dto.transaction_type:
            return Decimal("0.00"), "NO_MATCH", ["type_mismatch"]

        # 2. Amount Check (Weight: 40 points)
        amount_score = 0
        diff = abs(manual_tx.amount - bank_dto.amount)
        if diff == Decimal("0.00"):
            amount_score = 40
            reasons.append("exact_amount")
        elif diff <= Decimal("5.00") and (diff / bank_dto.amount) <= Decimal("0.01"):
            amount_score = 20
            reasons.append("approximate_amount")
        else:
            return Decimal("0.00"), "NO_MATCH", ["amount_mismatch"]

        # 3. Date Proximity Check (Weight: 25 points)
        date_score = 0
        m_date = manual_tx.transaction_date.date() if isinstance(manual_tx.transaction_date, datetime.datetime) else manual_tx.transaction_date
        b_date = bank_dto.transaction_date.date() if isinstance(bank_dto.transaction_date, datetime.datetime) else bank_dto.transaction_date
        day_diff = abs((m_date - b_date).days)

        if day_diff == 0:
            date_score = 25
            reasons.append("same_date")
        elif day_diff == 1:
            date_score = 18
            reasons.append("date_within_1_day")
        elif day_diff <= 3:
            date_score = 10
            reasons.append("date_within_3_days")
        else:
            date_score = 0
            reasons.append("date_greater_than_3_days")

        # 4. Description / Narration Match (Weight: 15 points)
        desc_score = 0
        manual_tokens = cls._extract_tokens(manual_tx.description)
        manual_tokens.update(cls._extract_tokens(manual_tx.category))

        bank_tokens = cls._extract_tokens(bank_dto.description)
        bank_tokens.update(cls._extract_tokens(bank_dto.raw_bank_description))

        common_tokens = manual_tokens.intersection(bank_tokens)
        if common_tokens:
            desc_score = 15
            reasons.append(f"description_match:{','.join(list(common_tokens)[:3])}")
        else:
            # Check substring match
            m_str = (manual_tx.description or "").lower()
            b_str = (bank_dto.description or "").lower() + " " + (bank_dto.raw_bank_description or "").lower()
            if m_str and (m_str in b_str or b_str in m_str):
                desc_score = 15
                reasons.append("description_substring_match")
            else:
                desc_score = 0

        # 5. Category Compatibility (Weight: 10 points)
        cat_score = 0
        m_cat = (manual_tx.category or "").strip().lower()
        b_cat = (bank_dto.category or "").strip().lower()

        if m_cat == b_cat:
            cat_score = 10
            reasons.append("same_category")
        elif m_cat in ("other", "miscellaneous") or b_cat in ("other", "miscellaneous"):
            cat_score = 5
            reasons.append("generic_category")
        elif (
            ("food" in m_cat and "dining" in b_cat)
            or ("bill" in m_cat and "util" in b_cat)
            or ("travel" in m_cat and "transport" in b_cat)
        ):
            cat_score = 8
            reasons.append("compatible_category")
        else:
            cat_score = 0

        # 6. Payment Method Compatibility (Weight: 10 points)
        pm_score = 0
        m_pm = (manual_tx.payment_method or "").strip().lower()
        b_pm = (bank_dto.payment_method or "").strip().lower()

        if m_pm == b_pm or (m_pm in ("upi", "bank transfer") and b_pm in ("upi", "bank transfer")):
            pm_score = 10
            reasons.append("compatible_payment_method")
        else:
            pm_score = 5

        total_points = amount_score + date_score + desc_score + cat_score + pm_score
        confidence = (Decimal(total_points) / Decimal("100")).quantize(Decimal("0.01"))

        if confidence >= Decimal("0.85"):
            match_type = "HIGH_CONFIDENCE"
        elif confidence >= Decimal("0.60"):
            match_type = "POSSIBLE_MATCH"
        else:
            match_type = "NO_MATCH"

        return confidence, match_type, reasons

    @classmethod
    def find_best_candidate(
        cls,
        db: Session,
        user_id: int,
        bank_dto: ProviderTransactionData,
    ) -> Optional[Tuple[Transaction, Decimal, str, List[str]]]:
        """
        Scan unreconciled manual transactions of the user within +/- 7 days of the bank transaction.
        Picks the highest scoring candidate matching >= 0.60.
        """
        b_date = bank_dto.transaction_date
        if b_date.tzinfo is None:
            b_date = b_date.replace(tzinfo=datetime.timezone.utc)

        start_window = b_date - datetime.timedelta(days=7)
        end_window = b_date + datetime.timedelta(days=7)

        candidates = (
            db.query(Transaction)
            .filter(
                Transaction.user_id == user_id,
                Transaction.source == "MANUAL",
                Transaction.reconciliation_status.in_(("UNRECONCILED", "PENDING_REVIEW")),
                Transaction.transaction_type == bank_dto.transaction_type,
                Transaction.transaction_date >= start_window,
                Transaction.transaction_date <= end_window,
            )
            .all()
        )

        best_match = None
        highest_score = Decimal("0.00")

        for candidate in candidates:
            score, match_type, reasons = cls.score_match(candidate, bank_dto)
            if score >= Decimal("0.60") and score > highest_score:
                highest_score = score
                best_match = (candidate, score, match_type, reasons)

        return best_match

    @classmethod
    def auto_reconcile(
        cls,
        db: Session,
        user: User,
        account: ConnectedAccount,
        manual_tx: Transaction,
        bank_dto: ProviderTransactionData,
        score: Decimal,
        reasons: List[str],
        sync_run_id: Optional[int] = None,
    ) -> TransactionReconciliation:
        """
        Safely reconciles a high-confidence match:
        - Updates the manual transaction in-place with bank provenance.
        - Sets manual_tx.source = 'RECONCILED' and reconciliation_status = 'RECONCILED'.
        - Creates a TransactionReconciliation audit record (status='AUTO_RECONCILED').
        - Guarantees single counting in the ledger without creating a duplicate row.
        """
        now = datetime.datetime.now(datetime.timezone.utc)

        # Create audit reconciliation record with full snapshots
        reconciliation = TransactionReconciliation(
            user_id=user.id,
            manual_transaction_id=manual_tx.id,
            account_id=account.id,
            external_transaction_id=bank_dto.external_transaction_id,
            status="AUTO_RECONCILED",
            match_type="HIGH_CONFIDENCE",
            confidence_score=score,
            match_reasons=json.dumps(reasons),
            manual_amount=manual_tx.amount,
            manual_description=manual_tx.description,
            manual_category=manual_tx.category,
            manual_date=manual_tx.transaction_date,
            bank_amount=bank_dto.amount,
            bank_description=bank_dto.description,
            bank_category=bank_dto.category,
            bank_date=bank_dto.transaction_date,
            raw_bank_description=bank_dto.raw_bank_description,
            reconciled_at=now,
        )
        db.add(reconciliation)
        db.flush()

        # Update manual transaction with bank provenance
        manual_tx.source = "RECONCILED"
        manual_tx.reconciliation_status = "RECONCILED"
        manual_tx.account_id = account.id
        manual_tx.provider = account.provider
        manual_tx.external_transaction_id = bank_dto.external_transaction_id
        manual_tx.external_account_id = bank_dto.external_account_id
        manual_tx.raw_bank_description = bank_dto.raw_bank_description
        manual_tx.sync_run_id = sync_run_id
        manual_tx.imported_at = now

        # Enrich merchant normalization without overwriting user manual category
        if not manual_tx.normalized_merchant:
            norm_m, disp_m = TransactionNormalizationService.extract_merchant(
                raw_description=bank_dto.raw_bank_description,
                description=bank_dto.description,
            )
            if norm_m:
                manual_tx.normalized_merchant = norm_m
                if not manual_tx.merchant:
                    manual_tx.merchant = disp_m

        return reconciliation

    @classmethod
    def create_pending_review(
        cls,
        db: Session,
        user: User,
        account: ConnectedAccount,
        manual_tx: Transaction,
        bank_dto: ProviderTransactionData,
        score: Decimal,
        reasons: List[str],
    ) -> TransactionReconciliation:
        """
        Creates a pending review record for ambiguous/possible matches.
        Does NOT insert the bank transaction into the main ledger yet.
        """
        # Mark manual transaction as having a pending review
        manual_tx.reconciliation_status = "PENDING_REVIEW"

        reconciliation = TransactionReconciliation(
            user_id=user.id,
            manual_transaction_id=manual_tx.id,
            account_id=account.id,
            external_transaction_id=bank_dto.external_transaction_id,
            status="PENDING_REVIEW",
            match_type="POSSIBLE_MATCH",
            confidence_score=score,
            match_reasons=json.dumps(reasons),
            manual_amount=manual_tx.amount,
            manual_description=manual_tx.description,
            manual_category=manual_tx.category,
            manual_date=manual_tx.transaction_date,
            bank_amount=bank_dto.amount,
            bank_description=bank_dto.description,
            bank_category=bank_dto.category,
            bank_date=bank_dto.transaction_date,
            raw_bank_description=bank_dto.raw_bank_description,
        )
        db.add(reconciliation)
        db.flush()
        return reconciliation

    @classmethod
    def resolve_user_match(
        cls,
        db: Session,
        user: User,
        reconciliation_id: int,
    ) -> TransactionReconciliation:
        """
        User action [Match]:
        Confirms that the manual transaction and bank transaction are the same financial event.
        Enriches the manual transaction with bank data and marks reconciled.
        """
        rec = (
            db.query(TransactionReconciliation)
            .filter(
                TransactionReconciliation.id == reconciliation_id,
                TransactionReconciliation.user_id == user.id,
            )
            .first()
        )
        if not rec:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Reconciliation record not found",
            )

        if rec.status != "PENDING_REVIEW":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Reconciliation already resolved with status '{rec.status}'",
            )

        now = datetime.datetime.now(datetime.timezone.utc)
        manual_tx = (
            db.query(Transaction)
            .filter(Transaction.id == rec.manual_transaction_id, Transaction.user_id == user.id)
            .first()
        )
        if manual_tx:
            manual_tx.source = "RECONCILED"
            manual_tx.reconciliation_status = "RECONCILED"
            manual_tx.account_id = rec.account_id
            manual_tx.external_transaction_id = rec.external_transaction_id
            manual_tx.raw_bank_description = rec.raw_bank_description
            manual_tx.imported_at = now
            if not manual_tx.normalized_merchant:
                norm_m, disp_m = TransactionNormalizationService.extract_merchant(
                    raw_description=rec.raw_bank_description,
                    description=rec.bank_description,
                )
                if norm_m:
                    manual_tx.normalized_merchant = norm_m
                    if not manual_tx.merchant:
                        manual_tx.merchant = disp_m

        rec.status = "MATCHED"
        rec.reconciled_at = now
        db.commit()
        db.refresh(rec)
        return rec

    @classmethod
    def resolve_keep_separate(
        cls,
        db: Session,
        user: User,
        reconciliation_id: int,
    ) -> Transaction:
        """
        User action [Keep Separate]:
        Student indicates the two transactions are distinct financial events.
        Inserts the bank transaction into the ledger as a genuine new transaction
        and restores the manual transaction to UNRECONCILED.
        """
        rec = (
            db.query(TransactionReconciliation)
            .filter(
                TransactionReconciliation.id == reconciliation_id,
                TransactionReconciliation.user_id == user.id,
            )
            .first()
        )
        if not rec:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Reconciliation record not found",
            )

        if rec.status != "PENDING_REVIEW":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Reconciliation already resolved with status '{rec.status}'",
            )

        # Restore manual transaction
        manual_tx = (
            db.query(Transaction)
            .filter(Transaction.id == rec.manual_transaction_id, Transaction.user_id == user.id)
            .first()
        )
        if manual_tx:
            manual_tx.reconciliation_status = "UNRECONCILED"

        # Import bank transaction as genuine new ledger entry
        now = datetime.datetime.now(datetime.timezone.utc)
        account = db.query(ConnectedAccount).filter(ConnectedAccount.id == rec.account_id).first()
        provider = account.provider if account else "bank_sync"

        norm_m, disp_m = TransactionNormalizationService.extract_merchant(
            raw_description=rec.raw_bank_description,
            description=rec.bank_description,
        )
        tx_type = manual_tx.transaction_type if manual_tx else "expense"
        cat_result = CategorizationService.categorize(
            db=db,
            user_id=user.id,
            transaction_type=tx_type,
            normalized_merchant=norm_m,
            raw_description=rec.raw_bank_description,
            provider_category=rec.bank_category,
        )

        new_bank_tx = Transaction(
            user_id=user.id,
            transaction_type=tx_type,
            amount=rec.bank_amount,
            category=cat_result.category,
            merchant=disp_m or norm_m,
            normalized_merchant=norm_m,
            category_confidence=cat_result.confidence,
            categorization_source=cat_result.source,
            status="POSTED",
            description=rec.bank_description or rec.raw_bank_description or "Bank Transaction",
            payment_method="Bank Transfer",
            transaction_date=rec.bank_date,
            source="BANK_SYNC",
            provider=provider,
            account_id=rec.account_id,
            external_transaction_id=rec.external_transaction_id,
            raw_bank_description=rec.raw_bank_description,
            reconciliation_status="UNRECONCILED",
            imported_at=now,
        )
        db.add(new_bank_tx)
        db.flush()

        rec.status = "SEPARATE"
        rec.bank_transaction_id = new_bank_tx.id
        db.commit()
        db.refresh(new_bank_tx)
        return new_bank_tx
