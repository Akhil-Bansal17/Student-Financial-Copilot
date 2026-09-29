import datetime
from decimal import Decimal
from typing import List, Optional, Tuple

from app.services.bank_provider.base import (
    BankDataProvider,
    ProviderAccountData,
    ProviderConsentData,
    ProviderTransactionData,
    ProviderTimeoutError,
    ProviderUnavailableError,
    ProviderDataError,
)


class MockBankProvider(BankDataProvider):
    """
    Deterministic Mock Bank Provider for sandbox simulation and automated test suites.
    Provides realistic student bank accounts and transaction streams while guaranteeing
    that all data is clearly identifiable as mock/sandbox.
    """

    PROVIDER_NAME = "mock_bank"
    DEFAULT_ACCOUNT_ID = "mock_acc_student_savings_01"
    DEFAULT_INSTITUTION = "Demo Student Bank (Sandbox)"
    DEFAULT_BALANCE = Decimal("12450.00")

    def __init__(
        self,
        simulate_timeout: bool = False,
        simulate_unavailable: bool = False,
        simulate_malformed: bool = False,
        custom_transactions: Optional[List[ProviderTransactionData]] = None,
        custom_balance: Optional[Decimal] = None,
    ):
        self.simulate_timeout = simulate_timeout
        self.simulate_unavailable = simulate_unavailable
        self.simulate_malformed = simulate_malformed
        self.custom_transactions = custom_transactions
        self.custom_balance = custom_balance

    def get_provider_name(self) -> str:
        return self.PROVIDER_NAME

    def connect_account(self, user_id: int) -> Tuple[ProviderAccountData, ProviderConsentData]:
        if self.simulate_timeout:
            raise ProviderTimeoutError("Connection to sandbox bank timed out", provider=self.PROVIDER_NAME)
        if self.simulate_unavailable:
            raise ProviderUnavailableError("Sandbox bank is temporarily offline", provider=self.PROVIDER_NAME)

        now = datetime.datetime.now(datetime.timezone.utc)
        account = ProviderAccountData(
            provider_account_id=f"mock_acc_{user_id}_savings_01",
            institution_name=self.DEFAULT_INSTITUTION,
            account_type="savings",
            masked_account_number="••••5821",
            currency="INR",
            current_balance=self.custom_balance if self.custom_balance is not None else self.DEFAULT_BALANCE,
            balance_as_of=now,
        )

        consent = ProviderConsentData(
            consent_id=f"mock_consent_{user_id}_{int(now.timestamp())}",
            status="ACTIVE",
            purpose="Student Financial Management & Analytics Sync (Sandbox)",
            data_range_from=now - datetime.timedelta(days=90),
            data_range_to=now + datetime.timedelta(days=365),
            granted_at=now,
            expires_at=now + datetime.timedelta(days=365),
        )

        return account, consent

    def initiate_consent(
        self,
        user_id: int,
        customer_identifier: Optional[str] = None,
        redirect_url: Optional[str] = None,
    ) -> Tuple[str, str]:
        if self.simulate_timeout:
            raise ProviderTimeoutError("Consent initiation timed out", provider=self.PROVIDER_NAME)
        if self.simulate_unavailable:
            raise ProviderUnavailableError("Sandbox bank is temporarily offline", provider=self.PROVIDER_NAME)
        now = datetime.datetime.now(datetime.timezone.utc)
        consent_id = f"mock_consent_{user_id}_{int(now.timestamp())}"
        target_url = redirect_url or "/connected-accounts"
        return consent_id, target_url

    def check_consent_status(self, consent_id: str) -> str:
        return "ACTIVE"

    def discover_accounts(self, consent_id: str) -> List[ProviderAccountData]:
        now = datetime.datetime.now(datetime.timezone.utc)
        return [
            ProviderAccountData(
                provider_account_id=f"mock_acc_savings_01",
                institution_name=self.DEFAULT_INSTITUTION,
                account_type="savings",
                masked_account_number="••••5821",
                currency="INR",
                current_balance=self.custom_balance if self.custom_balance is not None else self.DEFAULT_BALANCE,
                balance_as_of=now,
            )
        ]

    def fetch_balance(self, account_id: str) -> Tuple[Decimal, datetime.datetime]:
        if self.simulate_timeout:
            raise ProviderTimeoutError("Fetch balance timed out", provider=self.PROVIDER_NAME)
        if self.simulate_unavailable:
            raise ProviderUnavailableError("Bank balance endpoint unavailable", provider=self.PROVIDER_NAME)
        if self.simulate_malformed:
            raise ProviderDataError("Balance returned invalid non-numeric payload", provider=self.PROVIDER_NAME)

        now = datetime.datetime.now(datetime.timezone.utc)
        balance = self.custom_balance if self.custom_balance is not None else self.DEFAULT_BALANCE
        return balance, now

    def fetch_transactions(
        self,
        account_id: str,
        from_date: Optional[datetime.datetime] = None,
        to_date: Optional[datetime.datetime] = None,
    ) -> List[ProviderTransactionData]:
        if self.simulate_timeout:
            raise ProviderTimeoutError("Fetch transactions timed out", provider=self.PROVIDER_NAME)
        if self.simulate_unavailable:
            raise ProviderUnavailableError("Transactions endpoint unavailable", provider=self.PROVIDER_NAME)
        if self.simulate_malformed:
            raise ProviderDataError("Transactions payload corrupted or malformed", provider=self.PROVIDER_NAME)

        if self.custom_transactions is not None:
            return self.custom_transactions

        now = datetime.datetime.now(datetime.timezone.utc)

        # 10 realistic, deterministic student transactions
        transactions = [
            ProviderTransactionData(
                external_transaction_id="mock_tx_demo_001",
                external_account_id=account_id,
                amount=Decimal("180.00"),
                transaction_type="expense",
                category="Food",
                description="Campus Canteen Lunch (Sandbox)",
                raw_bank_description="UPI/CR/82910281/CAMPUS CANTEEN/UTIB000123",
                payment_method="UPI",
                transaction_date=now - datetime.timedelta(days=1, hours=3),
            ),
            ProviderTransactionData(
                external_transaction_id="mock_tx_demo_002",
                external_account_id=account_id,
                amount=Decimal("850.00"),
                transaction_type="expense",
                category="Education",
                description="Engineering Textbooks (Sandbox)",
                raw_bank_description="POS/DEBIT/UNIVERSITY BOOKSTORE/HDFC00004",
                payment_method="Debit Card",
                transaction_date=now - datetime.timedelta(days=3, hours=5),
            ),
            ProviderTransactionData(
                external_transaction_id="mock_tx_demo_003",
                external_account_id=account_id,
                amount=Decimal("60.00"),
                transaction_type="expense",
                category="Transport",
                description="Metro Card Topup (Sandbox)",
                raw_bank_description="UPI/CR/99281726/METRO RAIL CORP/PUNB00045",
                payment_method="UPI",
                transaction_date=now - datetime.timedelta(days=4, hours=2),
            ),
            ProviderTransactionData(
                external_transaction_id="mock_tx_demo_004",
                external_account_id=account_id,
                amount=Decimal("2200.00"),
                transaction_type="expense",
                category="Bills",
                description="Hostel Mess Fee (Sandbox)",
                raw_bank_description="NEFT/CMS/HOSTEL MESS MGMT/SBIN000109",
                payment_method="Bank Transfer",
                transaction_date=now - datetime.timedelta(days=6, hours=10),
            ),
            ProviderTransactionData(
                external_transaction_id="mock_tx_demo_005",
                external_account_id=account_id,
                amount=Decimal("10000.00"),
                transaction_type="income",
                category="Scholarship",
                description="Academic Merit Scholarship (Sandbox)",
                raw_bank_description="ACH/CR/GOVT SCHOLARSHIP CELL/SBIN000001",
                payment_method="Bank Transfer",
                transaction_date=now - datetime.timedelta(days=8, hours=4),
            ),
            ProviderTransactionData(
                external_transaction_id="mock_tx_demo_006",
                external_account_id=account_id,
                amount=Decimal("3500.00"),
                transaction_type="income",
                category="Freelance",
                description="Web Design Project Stipend (Sandbox)",
                raw_bank_description="UPI/CR/11223344/TECH CLIENT/ICIC000021",
                payment_method="UPI",
                transaction_date=now - datetime.timedelta(days=10, hours=6),
            ),
            ProviderTransactionData(
                external_transaction_id="mock_tx_demo_007",
                external_account_id=account_id,
                amount=Decimal("420.00"),
                transaction_type="expense",
                category="Shopping",
                description="Stationery & Notebooks (Sandbox)",
                raw_bank_description="UPI/CR/77889900/STUDENT BAZAAR/BARB0001",
                payment_method="UPI",
                transaction_date=now - datetime.timedelta(days=12, hours=1),
            ),
            ProviderTransactionData(
                external_transaction_id="mock_tx_demo_008",
                external_account_id=account_id,
                amount=Decimal("350.00"),
                transaction_type="expense",
                category="Entertainment",
                description="Campus Cinema Club (Sandbox)",
                raw_bank_description="UPI/CR/66554433/STUDENT FILMS/CNRB0001",
                payment_method="UPI",
                transaction_date=now - datetime.timedelta(days=14, hours=8),
            ),
            ProviderTransactionData(
                external_transaction_id="mock_tx_demo_009",
                external_account_id=account_id,
                amount=Decimal("250.00"),
                transaction_type="expense",
                category="Health",
                description="Campus Health Pharmacy (Sandbox)",
                raw_bank_description="UPI/CR/33445566/CAMPUS MEDICO/KKBK0001",
                payment_method="UPI",
                transaction_date=now - datetime.timedelta(days=16, hours=3),
            ),
            ProviderTransactionData(
                external_transaction_id="mock_tx_demo_010",
                external_account_id=account_id,
                amount=Decimal("5000.00"),
                transaction_type="income",
                category="Family Support",
                description="Parental Allowance (Sandbox)",
                raw_bank_description="IMPS/P2A/FAMILY SUPPORT/SBIN000888",
                payment_method="Bank Transfer",
                transaction_date=now - datetime.timedelta(days=20, hours=2),
            ),
        ]

        # Apply date filters if requested
        if from_date:
            transactions = [tx for tx in transactions if tx.transaction_date >= from_date]
        if to_date:
            transactions = [tx for tx in transactions if tx.transaction_date <= to_date]

        return transactions

    def disconnect_account(self, account_id: str) -> bool:
        if self.simulate_timeout:
            raise ProviderTimeoutError("Disconnect timed out", provider=self.PROVIDER_NAME)
        return True
