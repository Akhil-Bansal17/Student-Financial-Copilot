import datetime
from decimal import Decimal
from typing import List, Literal, Optional, Tuple
from fastapi import HTTPException, status
from sqlalchemy import func, or_, and_
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.transaction import Transaction
from app.core.constants import (
    EXPENSE_CATEGORIES,
    INCOME_CATEGORIES,
    ALL_CATEGORIES,
    PAYMENT_METHODS,
)
from app.schemas.transaction import (
    TransactionCreate,
    TransactionUpdate,
    BulkCategoryUpdatePayload,
    BulkCategoryUpdateResponse,
)
from app.services.transaction_normalization_service import TransactionNormalizationService
from app.services.categorization_service import CategorizationService
from app.services.merchant_preference_service import MerchantPreferenceService


class TransactionService:
    """
    Authoritative service for transaction lifecycle, server-side filtering,
    intelligence normalization, bulk operations, and tenancy security.
    """

    @staticmethod
    def create_transaction(
        db: Session,
        user: User,
        payload: TransactionCreate,
    ) -> Transaction:
        """Create a manual transaction for the authenticated student."""
        tx_date = payload.transaction_date or datetime.datetime.now(datetime.timezone.utc)
        if tx_date.tzinfo is None:
            tx_date = tx_date.replace(tzinfo=datetime.timezone.utc)

        # Extract/normalize merchant if provided or inferred from description
        merchant_input = payload.merchant or payload.description
        norm_merchant, display_merchant = TransactionNormalizationService.extract_merchant(
            raw_description=None,
            description=merchant_input,
        )
        if payload.merchant and not display_merchant:
            display_merchant = payload.merchant.strip()
            norm_merchant = payload.merchant.strip().upper()

        transaction = Transaction(
            user_id=user.id,
            transaction_type=payload.transaction_type,
            amount=payload.amount,
            category=payload.category,
            merchant=display_merchant or payload.merchant,
            normalized_merchant=norm_merchant,
            category_confidence="HIGH",
            categorization_source="USER_MANUAL",
            status="POSTED",
            description=payload.description.strip() if payload.description else None,
            payment_method=payload.payment_method,
            transaction_date=tx_date,
            source="MANUAL",
            reconciliation_status="UNRECONCILED",
        )
        db.add(transaction)
        db.commit()
        db.refresh(transaction)
        return transaction

    @staticmethod
    def list_transactions(
        db: Session,
        user: User,
        transaction_type: Optional[Literal["income", "expense"]] = None,
        category: Optional[str] = None,
        search: Optional[str] = None,
        merchant: Optional[str] = None,
        source: Optional[str] = None,
        account_id: Optional[int] = None,
        start_date: Optional[datetime.date] = None,
        end_date: Optional[datetime.date] = None,
        min_amount: Optional[Decimal] = None,
        max_amount: Optional[Decimal] = None,
        reconciliation_status: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> Tuple[List[Transaction], int]:
        """
        Server-side filtered listing of transactions belonging exclusively to the user.
        Avoids N+1 queries and limits database workload.
        """
        query = db.query(Transaction).filter(Transaction.user_id == user.id)

        if transaction_type:
            query = query.filter(Transaction.transaction_type == transaction_type)
        if category:
            query = query.filter(Transaction.category == category)
        if source:
            query = query.filter(Transaction.source == source.upper().strip())
        if account_id is not None:
            query = query.filter(Transaction.account_id == account_id)
        if reconciliation_status:
            query = query.filter(Transaction.reconciliation_status == reconciliation_status.upper().strip())

        if start_date:
            start_dt = datetime.datetime.combine(start_date, datetime.time.min, tzinfo=datetime.timezone.utc)
            query = query.filter(Transaction.transaction_date >= start_dt)
        if end_date:
            end_dt = datetime.datetime.combine(end_date, datetime.time.max, tzinfo=datetime.timezone.utc)
            query = query.filter(Transaction.transaction_date <= end_dt)

        if min_amount is not None:
            query = query.filter(Transaction.amount >= min_amount)
        if max_amount is not None:
            query = query.filter(Transaction.amount <= max_amount)

        if merchant:
            m_term = f"%{merchant.strip().upper()}%"
            query = query.filter(
                or_(
                    Transaction.normalized_merchant.ilike(m_term),
                    Transaction.merchant.ilike(f"%{merchant.strip()}%"),
                )
            )

        if search and search.strip():
            s_term = f"%{search.strip()}%"
            query = query.filter(
                or_(
                    Transaction.description.ilike(s_term),
                    Transaction.raw_bank_description.ilike(s_term),
                    Transaction.category.ilike(s_term),
                    Transaction.merchant.ilike(s_term),
                    Transaction.normalized_merchant.ilike(s_term),
                    Transaction.payment_method.ilike(s_term),
                )
            )

        total = query.count()
        items = (
            query.order_by(Transaction.transaction_date.desc(), Transaction.id.desc())
            .offset(offset)
            .limit(limit)
            .all()
        )
        return items, total

    @staticmethod
    def get_transaction_detail(
        db: Session,
        user: User,
        transaction_id: int,
    ) -> Transaction:
        """Fetch a single transaction with strict tenancy ownership."""
        tx = (
            db.query(Transaction)
            .filter(Transaction.id == transaction_id, Transaction.user_id == user.id)
            .first()
        )
        if not tx:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Transaction not found",
            )
        return tx

    @staticmethod
    def update_transaction(
        db: Session,
        user: User,
        transaction_id: int,
        payload: TransactionUpdate,
    ) -> Transaction:
        """
        Safely update transaction fields.
        - Preserves bank provenance and external IDs for bank-originated items.
        - Automatically updates categorization_source to USER_MANUAL when category is edited.
        - Optionally saves merchant preference if remember_merchant_preference is True.
        """
        tx = TransactionService.get_transaction_detail(db, user, transaction_id)

        effective_type = payload.transaction_type or tx.transaction_type
        effective_category = payload.category or tx.category

        # Validate category for type
        if effective_type == "income" and effective_category not in INCOME_CATEGORIES:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Category '{effective_category}' is not valid for income transactions",
            )
        if effective_type == "expense" and effective_category not in EXPENSE_CATEGORIES:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Category '{effective_category}' is not valid for expense transactions",
            )

        # Bank provenance safeguards
        if tx.source == "BANK_SYNC" and tx.reconciliation_status == "RECONCILED":
            if payload.amount is not None and payload.amount != tx.amount:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cannot modify amount of a reconciled bank transaction directly. Unlink reconciliation first.",
                )

        if payload.transaction_type is not None:
            tx.transaction_type = payload.transaction_type
        if payload.amount is not None:
            tx.amount = payload.amount

        if payload.category is not None:
            tx.category = payload.category
            tx.categorization_source = "USER_MANUAL"
            tx.category_confidence = "HIGH"

        if payload.description is not None:
            tx.description = payload.description.strip() if payload.description else None
            # If merchant wasn't explicitly set, re-extract from description
            if payload.merchant is None and not tx.merchant:
                norm_m, disp_m = TransactionNormalizationService.extract_merchant(
                    raw_description=tx.raw_bank_description,
                    description=tx.description,
                )
                if norm_m:
                    tx.normalized_merchant = norm_m
                    tx.merchant = disp_m

        if payload.merchant is not None:
            tx.merchant = payload.merchant.strip() if payload.merchant else None
            if tx.merchant:
                norm_m, _ = TransactionNormalizationService.extract_merchant(
                    raw_description=None,
                    description=tx.merchant,
                )
                tx.normalized_merchant = norm_m or tx.merchant.upper()
            else:
                tx.normalized_merchant = None

        if payload.payment_method is not None:
            tx.payment_method = payload.payment_method

        if payload.transaction_date is not None:
            dt = payload.transaction_date
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=datetime.timezone.utc)
            tx.transaction_date = dt

        tx.updated_at = datetime.datetime.now(datetime.timezone.utc)

        # If user checked 'remember_merchant_preference', persist the rule
        if payload.remember_merchant_preference and tx.normalized_merchant and tx.category:
            MerchantPreferenceService.set_preference(
                db=db,
                user=user,
                normalized_merchant=tx.normalized_merchant,
                category=tx.category,
            )

        db.commit()
        db.refresh(tx)
        return tx

    @staticmethod
    def bulk_update_category(
        db: Session,
        user: User,
        payload: BulkCategoryUpdatePayload,
    ) -> BulkCategoryUpdateResponse:
        """
        Safely bulk update categories across multiple transactions.
        - Enforces ownership check (only user's transactions are updated).
        - Executes inside an atomic transaction.
        - Sets categorization_source = 'USER_MANUAL' and confidence = 'HIGH'.
        - Optionally saves merchant preference if all or matching merchants qualify.
        """
        if payload.category not in ALL_CATEGORIES:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Invalid category: '{payload.category}'",
            )

        # Query all matching transactions owned by user
        txs = (
            db.query(Transaction)
            .filter(
                Transaction.id.in_(payload.transaction_ids),
                Transaction.user_id == user.id,
            )
            .all()
        )

        if not txs:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No matching transactions found for current user",
            )

        now = datetime.datetime.now(datetime.timezone.utc)
        merchants_to_remember = set()

        for tx in txs:
            # Check compatibility with transaction type
            if tx.transaction_type == "income" and payload.category not in INCOME_CATEGORIES:
                continue
            if tx.transaction_type == "expense" and payload.category not in EXPENSE_CATEGORIES:
                continue

            tx.category = payload.category
            tx.categorization_source = "USER_MANUAL"
            tx.category_confidence = "HIGH"
            tx.updated_at = now

            if payload.update_merchant_preference and tx.normalized_merchant:
                merchants_to_remember.add(tx.normalized_merchant)

        preference_saved = False
        if payload.update_merchant_preference and merchants_to_remember:
            for m in merchants_to_remember:
                MerchantPreferenceService.set_preference(
                    db=db,
                    user=user,
                    normalized_merchant=m,
                    category=payload.category,
                )
            preference_saved = True

        db.commit()
        return BulkCategoryUpdateResponse(
            updated_count=len(txs),
            category=payload.category,
            preference_saved=preference_saved,
        )

    @staticmethod
    def delete_transaction(
        db: Session,
        user: User,
        transaction_id: int,
    ) -> bool:
        """Delete a transaction with ownership enforcement."""
        tx = TransactionService.get_transaction_detail(db, user, transaction_id)
        db.delete(tx)
        db.commit()
        return True
