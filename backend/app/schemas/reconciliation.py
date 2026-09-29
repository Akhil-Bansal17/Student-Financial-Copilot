import datetime
from decimal import Decimal
import json
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, field_validator


class ReconciliationItemResponse(BaseModel):
    id: int
    user_id: int
    manual_transaction_id: Optional[int] = None
    bank_transaction_id: Optional[int] = None
    account_id: Optional[int] = None
    external_transaction_id: Optional[str] = None
    status: str
    match_type: str
    confidence_score: Decimal
    match_reasons: List[str] = []
    manual_amount: Decimal
    manual_description: Optional[str] = None
    manual_category: str
    manual_date: datetime.datetime
    bank_amount: Decimal
    bank_description: Optional[str] = None
    bank_category: Optional[str] = None
    bank_date: datetime.datetime
    raw_bank_description: Optional[str] = None
    reconciled_at: Optional[datetime.datetime] = None
    created_at: datetime.datetime

    @field_validator("match_reasons", mode="before")
    @classmethod
    def parse_reasons(cls, v):
        if isinstance(v, str):
            try:
                parsed = json.loads(v)
                if isinstance(parsed, list):
                    return parsed
            except Exception:
                return [v]
        elif isinstance(v, list):
            return v
        return []

    model_config = ConfigDict(from_attributes=True)


class ReconciliationSummaryResponse(BaseModel):
    pending_count: int
    reconciled_count: int


class SyncStatusResponse(BaseModel):
    last_synced_at: Optional[datetime.datetime] = None
    sync_status: str  # UP_TO_DATE, SYNCING, DELAYED, FAILED, NO_ACCOUNTS
    is_stale: bool
    total_connected_accounts: int
    total_bank_balance: Decimal
    ledger_balance: Decimal
    balance_difference: Decimal
    pending_reconciliations: int
