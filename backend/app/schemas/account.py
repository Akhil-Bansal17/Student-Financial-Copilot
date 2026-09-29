import datetime
from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, computed_field


class AccountConsentResponse(BaseModel):
    id: int
    consent_id: str
    status: str
    purpose: str
    data_range_from: Optional[datetime.datetime] = None
    data_range_to: Optional[datetime.datetime] = None
    granted_at: Optional[datetime.datetime] = None
    expires_at: Optional[datetime.datetime] = None
    revoked_at: Optional[datetime.datetime] = None

    model_config = ConfigDict(from_attributes=True)


class ConnectedAccountResponse(BaseModel):
    id: int
    user_id: int
    provider: str
    provider_account_id: str
    institution_name: str
    account_type: str
    masked_account_number: str
    currency: str = "INR"
    current_balance: Optional[Decimal] = None
    balance_as_of: Optional[datetime.datetime] = None
    status: str
    last_synced_at: Optional[datetime.datetime] = None
    created_at: datetime.datetime
    updated_at: datetime.datetime

    @computed_field  # type: ignore[prop-decorator]
    @property
    def is_sandbox(self) -> bool:
        return self.provider.lower() in ("mock_bank", "sandbox", "mock")

    model_config = ConfigDict(from_attributes=True)


class ConnectedAccountListResponse(BaseModel):
    items: List[ConnectedAccountResponse]
    total_connected_balance: Decimal
    total_accounts: int


class SyncRunResponse(BaseModel):
    id: int
    user_id: int
    account_id: int
    provider: str
    status: str
    transactions_fetched: int
    transactions_imported: int
    transactions_skipped: int
    error_message: Optional[str] = None
    started_at: datetime.datetime
    completed_at: Optional[datetime.datetime] = None
    created_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True)


class AccountDisconnectResponse(BaseModel):
    success: bool = True
    message: str
    account: ConnectedAccountResponse
