import datetime
from typing import Optional, TYPE_CHECKING
from sqlalchemy import String, Boolean, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base

if TYPE_CHECKING:
    from app.models.financial_profile import FinancialProfile
    from app.models.transaction import Transaction
    from app.models.budget import Budget
    from app.models.goal import Goal
    from app.models.account import ConnectedAccount, AccountConsent, SyncRun
    from app.models.merchant_preference import MerchantCategoryPreference
    from app.models.recurring_expense import RecurringExpense
    from app.models.recurring_preference import RecurringPreference
    from app.models.forecast_preference import ForecastPreference
    from app.models.notification import Notification
    from app.models.notification_preference import NotificationPreference
    from app.models.personalization import PersonalizationProfile


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, index=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
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

    financial_profile: Mapped[Optional["FinancialProfile"]] = relationship(
        "FinancialProfile",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
    )

    transactions: Mapped[list["Transaction"]] = relationship(
        "Transaction",
        back_populates="user",
        cascade="all, delete-orphan",
        order_by="Transaction.transaction_date.desc()",
    )

    budgets: Mapped[list["Budget"]] = relationship(
        "Budget",
        back_populates="user",
        cascade="all, delete-orphan",
        order_by="Budget.year.desc(), Budget.month.desc()",
    )

    goals: Mapped[list["Goal"]] = relationship(
        "Goal",
        back_populates="user",
        cascade="all, delete-orphan",
        order_by="Goal.created_at.desc()",
    )

    connected_accounts: Mapped[list["ConnectedAccount"]] = relationship(
        "ConnectedAccount",
        back_populates="user",
        cascade="all, delete-orphan",
        order_by="ConnectedAccount.created_at.desc()",
    )

    consents: Mapped[list["AccountConsent"]] = relationship(
        "AccountConsent",
        back_populates="user",
        cascade="all, delete-orphan",
        order_by="AccountConsent.created_at.desc()",
    )

    sync_runs: Mapped[list["SyncRun"]] = relationship(
        "SyncRun",
        back_populates="user",
        cascade="all, delete-orphan",
        order_by="SyncRun.started_at.desc()",
    )

    merchant_preferences: Mapped[list["MerchantCategoryPreference"]] = relationship(
        "MerchantCategoryPreference",
        back_populates="user",
        cascade="all, delete-orphan",
        order_by="MerchantCategoryPreference.normalized_merchant.asc()",
    )

    recurring_expenses: Mapped[list["RecurringExpense"]] = relationship(
        "RecurringExpense",
        back_populates="user",
        cascade="all, delete-orphan",
        order_by="RecurringExpense.next_expected_date.asc()",
    )

    recurring_preferences: Mapped[list["RecurringPreference"]] = relationship(
        "RecurringPreference",
        back_populates="user",
        cascade="all, delete-orphan",
        order_by="RecurringPreference.normalized_merchant.asc()",
    )

    forecast_preference: Mapped[Optional["ForecastPreference"]] = relationship(
        "ForecastPreference",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
    )

    notifications: Mapped[list["Notification"]] = relationship(
        "Notification",
        back_populates="user",
        cascade="all, delete-orphan",
        order_by="Notification.created_at.desc()",
    )

    notification_preference: Mapped[Optional["NotificationPreference"]] = relationship(
        "NotificationPreference",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
    )

    personalization_profile: Mapped[Optional["PersonalizationProfile"]] = relationship(
        "PersonalizationProfile",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
    )

    @property
    def onboarding_completed(self) -> bool:
        if self.financial_profile:
            return bool(self.financial_profile.onboarding_completed)
        return False

    def __repr__(self) -> str:
        return f"<User id={self.id} email={self.email}>"
