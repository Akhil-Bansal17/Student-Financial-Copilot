from decimal import Decimal
import datetime
from typing import Optional, TYPE_CHECKING
from sqlalchemy import Integer, String, Numeric, DateTime, ForeignKey, CheckConstraint, Index, text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.account import ConnectedAccount, SyncRun


class Transaction(Base):
    __tablename__ = "transactions"
    __table_args__ = (
        CheckConstraint("amount > 0", name="check_transaction_amount_positive"),
        CheckConstraint("transaction_type IN ('income', 'expense')", name="check_transaction_type_valid"),
        Index("ix_transactions_user_id_date", "user_id", "transaction_date"),
        Index("ix_transactions_user_id_type_date", "user_id", "transaction_type", "transaction_date"),
        Index(
            "uq_transactions_provider_account_external_id",
            "provider",
            "external_account_id",
            "external_transaction_id",
            unique=True,
            postgresql_where=text("external_transaction_id IS NOT NULL"),
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    transaction_type: Mapped[str] = mapped_column(String(20), nullable=False)
    amount: Mapped[Decimal] = mapped_column(
        Numeric(precision=12, scale=2),
        nullable=False,
    )
    category: Mapped[str] = mapped_column(String(50), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    payment_method: Mapped[str] = mapped_column(String(50), nullable=False)
    transaction_date: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.datetime.now(datetime.timezone.utc),
        nullable=False,
    )
    # Provenance fields for automated sync / Account Aggregator
    source: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="MANUAL",
        server_default="MANUAL",
    )  # e.g. 'MANUAL', 'BANK_SYNC'
    provider: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)  # e.g. 'mock_bank'
    account_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("connected_accounts.id", ondelete="SET NULL"),
        index=True,
        nullable=True,
    )
    external_transaction_id: Mapped[Optional[str]] = mapped_column(
        String(255),
        index=True,
        nullable=True,
    )
    external_account_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    raw_bank_description: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    sync_run_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("sync_runs.id", ondelete="SET NULL"),
        index=True,
        nullable=True,
    )
    imported_at: Mapped[Optional[datetime.datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
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

    user: Mapped["User"] = relationship("User", back_populates="transactions")
    account: Mapped[Optional["ConnectedAccount"]] = relationship("ConnectedAccount", back_populates="transactions")
    sync_run: Mapped[Optional["SyncRun"]] = relationship("SyncRun", back_populates="transactions")

    def __repr__(self) -> str:
        return f"<Transaction id={self.id} user_id={self.user_id} source={self.source} type={self.transaction_type} amount={self.amount}>"
