import datetime
from decimal import Decimal
from typing import Optional, TYPE_CHECKING
from sqlalchemy import Integer, String, Numeric, DateTime, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.transaction import Transaction
    from app.models.account import ConnectedAccount


class TransactionReconciliation(Base):
    """
    Tracks reconciliation matches, confidence scores, and review state between
    manually entered student transactions and bank-synced transactions.
    """
    __tablename__ = "transaction_reconciliations"
    __table_args__ = (
        Index("ix_reconciliations_user_status", "user_id", "status"),
        Index("ix_reconciliations_manual_tx", "manual_transaction_id"),
        Index("ix_reconciliations_bank_tx", "bank_transaction_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    manual_transaction_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("transactions.id", ondelete="CASCADE"),
        nullable=True,
    )
    bank_transaction_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("transactions.id", ondelete="SET NULL"),
        nullable=True,
    )
    account_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("connected_accounts.id", ondelete="SET NULL"),
        nullable=True,
    )
    external_transaction_id: Mapped[Optional[str]] = mapped_column(
        String(255),
        index=True,
        nullable=True,
    )
    status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="PENDING_REVIEW",
    )  # PENDING_REVIEW, MATCHED, AUTO_RECONCILED, SEPARATE
    match_type: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="POSSIBLE_MATCH",
    )  # EXACT, HIGH_CONFIDENCE, POSSIBLE_MATCH
    confidence_score: Mapped[Decimal] = mapped_column(
        Numeric(precision=5, scale=2),
        nullable=False,
        default=Decimal("0.00"),
    )
    match_reasons: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)

    # Snapshot data to preserve original comparison state
    manual_amount: Mapped[Decimal] = mapped_column(Numeric(precision=12, scale=2), nullable=False)
    manual_description: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    manual_category: Mapped[str] = mapped_column(String(50), nullable=False)
    manual_date: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    bank_amount: Mapped[Decimal] = mapped_column(Numeric(precision=12, scale=2), nullable=False)
    bank_description: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    bank_category: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    bank_date: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    raw_bank_description: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    reconciled_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.datetime.now(datetime.timezone.utc),
        nullable=False,
    )
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.datetime.now(datetime.timezone.utc),
        onupdate=lambda: datetime.datetime.now(datetime.timezone.utc),
        nullable=False,
    )

    user: Mapped["User"] = relationship("User")
    manual_transaction: Mapped[Optional["Transaction"]] = relationship(
        "Transaction",
        foreign_keys=[manual_transaction_id],
    )
    bank_transaction: Mapped[Optional["Transaction"]] = relationship(
        "Transaction",
        foreign_keys=[bank_transaction_id],
    )
    account: Mapped[Optional["ConnectedAccount"]] = relationship("ConnectedAccount")

    def __repr__(self) -> str:
        return f"<TransactionReconciliation id={self.id} status={self.status} score={self.confidence_score}>"
