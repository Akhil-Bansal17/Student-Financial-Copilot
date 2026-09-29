from abc import ABC, abstractmethod
import datetime
from decimal import Decimal
from typing import List, Literal, Optional, Tuple
from pydantic import BaseModel, ConfigDict, Field


class BankProviderError(Exception):
    """Base exception for all bank provider operations."""
    def __init__(self, message: str, provider: str = "unknown", status_code: int = 502):
        super().__init__(message)
        self.message = message
        self.provider = provider
        self.status_code = status_code


class ProviderTimeoutError(BankProviderError):
    """Raised when communication with the bank/AA provider times out."""
    def __init__(self, message: str = "Connection to financial provider timed out", provider: str = "unknown"):
        super().__init__(message, provider=provider, status_code=504)


class ProviderUnavailableError(BankProviderError):
    """Raised when the bank/AA provider is temporarily unreachable or returned 503."""
    def __init__(self, message: str = "Financial provider service is temporarily unavailable", provider: str = "unknown"):
        super().__init__(message, provider=provider, status_code=503)


class ProviderAuthenticationError(BankProviderError):
    """Raised when provider credentials, certificates, or tokens are rejected."""
    def __init__(self, message: str = "Authentication failed with financial provider", provider: str = "unknown"):
        super().__init__(message, provider=provider, status_code=401)


class ProviderDataError(BankProviderError):
    """Raised when provider returns invalid, malformed, or unparseable financial data."""
    def __init__(self, message: str = "Provider returned invalid or malformed transaction data", provider: str = "unknown"):
        super().__init__(message, provider=provider, status_code=502)


class ConsentRevokedError(BankProviderError):
    """Raised when operation fails because user consent was revoked."""
    def __init__(self, message: str = "Account Aggregator consent was revoked", provider: str = "unknown"):
        super().__init__(message, provider=provider, status_code=403)


class ConsentExpiredError(BankProviderError):
    """Raised when operation fails because user consent has expired."""
    def __init__(self, message: str = "Account Aggregator consent has expired", provider: str = "unknown"):
        super().__init__(message, provider=provider, status_code=403)


class ConsentRejectedError(BankProviderError):
    """Raised when user denies or rejects consent authorization in Account Aggregator webview."""
    def __init__(self, message: str = "Account Aggregator consent was rejected by user", provider: str = "unknown"):
        super().__init__(message, provider=provider, status_code=400)


class ProviderAccountData(BaseModel):
    provider_account_id: str
    institution_name: str
    account_type: str = "savings"
    masked_account_number: str
    currency: str = "INR"
    current_balance: Optional[Decimal] = None
    balance_as_of: Optional[datetime.datetime] = None

    model_config = ConfigDict(from_attributes=True)


class ProviderTransactionData(BaseModel):
    external_transaction_id: str
    external_account_id: str
    amount: Decimal = Field(..., gt=0)
    transaction_type: Literal["income", "expense"]
    category: str
    description: Optional[str] = None
    raw_bank_description: Optional[str] = None
    payment_method: str = "Bank Transfer"
    transaction_date: datetime.datetime

    model_config = ConfigDict(from_attributes=True)


class ProviderConsentData(BaseModel):
    consent_id: str
    status: str = "ACTIVE"
    purpose: str = "Personal Finance Management"
    data_range_from: Optional[datetime.datetime] = None
    data_range_to: Optional[datetime.datetime] = None
    granted_at: Optional[datetime.datetime] = None
    expires_at: Optional[datetime.datetime] = None
    revoked_at: Optional[datetime.datetime] = None

    model_config = ConfigDict(from_attributes=True)


class BankDataProvider(ABC):
    """
    Provider-agnostic interface for financial institutions and Account Aggregators (RBI AA framework).
    The rest of the application interacts strictly with this abstraction rather than any vendor-specific APIs.
    """

    @abstractmethod
    def get_provider_name(self) -> str:
        """Return the unique canonical identifier of this provider (e.g. 'mock_bank', 'setu_aa', 'onemoney')."""
        pass

    @abstractmethod
    def connect_account(self, user_id: int) -> Tuple[ProviderAccountData, ProviderConsentData]:
        """Initiate or mock an account connection, returning account details and consent metadata."""
        pass

    def initiate_consent(
        self,
        user_id: int,
        customer_identifier: Optional[str] = None,
        redirect_url: Optional[str] = None,
    ) -> Tuple[str, str]:
        """
        Initiate an Account Aggregator consent request.
        Returns a tuple of (consent_id, authorization_url).
        """
        now = datetime.datetime.now(datetime.timezone.utc)
        consent_id = f"consent_{self.get_provider_name()}_{user_id}_{int(now.timestamp())}"
        target_url = redirect_url or "/connected-accounts"
        return consent_id, target_url

    def check_consent_status(self, consent_id: str) -> str:
        """Query provider to check actual status of a consent artifact (e.g. 'ACTIVE', 'PENDING', 'REJECTED', 'EXPIRED')."""
        return "ACTIVE"

    def discover_accounts(self, consent_id: str) -> List[ProviderAccountData]:
        """Fetch discovered financial accounts authorized under this consent."""
        return []

    @abstractmethod
    def fetch_transactions(
        self,
        account_id: str,
        from_date: Optional[datetime.datetime] = None,
        to_date: Optional[datetime.datetime] = None,
    ) -> List[ProviderTransactionData]:
        """Fetch bank-sourced transactions for the specified account."""
        pass

    @abstractmethod
    def fetch_balance(self, account_id: str) -> Tuple[Decimal, datetime.datetime]:
        """Fetch the latest available balance and its timestamp for the specified account."""
        pass

    @abstractmethod
    def disconnect_account(self, account_id: str) -> bool:
        """Inform the provider to revoke consent and tear down active data sessions."""
        pass

