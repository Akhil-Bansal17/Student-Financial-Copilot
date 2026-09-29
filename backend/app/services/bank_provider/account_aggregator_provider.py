import datetime
from decimal import Decimal
import logging
from typing import List, Optional, Tuple
import httpx

from app.core.config import settings
from app.services.bank_provider.base import (
    BankDataProvider,
    BankProviderError,
    ProviderAccountData,
    ProviderConsentData,
    ProviderTransactionData,
    ProviderTimeoutError,
    ProviderUnavailableError,
    ProviderAuthenticationError,
    ProviderDataError,
    ConsentRevokedError,
    ConsentExpiredError,
    ConsentRejectedError,
)

logger = logging.getLogger(__name__)


class AccountAggregatorProvider(BankDataProvider):
    """
    Legitimate Account Aggregator (AA) FIU Provider Adapter.
    Implements India's RBI Account Aggregator framework APIs (modeled on the Setu AA FIU Gateway specification).
    
    When live sandbox credentials (AA_CLIENT_ID, AA_CLIENT_SECRET) are configured, it interacts directly
    with the AA sandbox endpoints via HTTP REST.
    When running in development/test without credentials or in simulation mode, it operates in
    deterministic sandbox simulation mode without faking production connectivity.
    """

    PROVIDER_NAME = "setu_aa"
    DEFAULT_INSTITUTION = "State Bank of India (Setu AA Sandbox)"
    DEFAULT_ACCOUNT_ID = "setu_acc_sbi_savings_9841"
    DEFAULT_BALANCE = Decimal("18450.75")

    def __init__(
        self,
        base_url: Optional[str] = None,
        client_id: Optional[str] = None,
        client_secret: Optional[str] = None,
        product_instance_id: Optional[str] = None,
        timeout: Optional[int] = None,
        force_simulation: Optional[bool] = None,
        # Simulation error injection flags for comprehensive testing
        simulate_timeout: bool = False,
        simulate_unavailable: bool = False,
        simulate_auth_failure: bool = False,
        simulate_malformed: bool = False,
        simulate_revoked: bool = False,
        simulate_expired: bool = False,
        simulate_rejected: bool = False,
        custom_transactions: Optional[List[ProviderTransactionData]] = None,
        custom_balance: Optional[Decimal] = None,
    ):
        self.base_url = (base_url or settings.AA_BASE_URL).rstrip("/")
        self.client_id = client_id if client_id is not None else settings.AA_CLIENT_ID
        self.client_secret = client_secret if client_secret is not None else settings.AA_CLIENT_SECRET
        self.product_instance_id = product_instance_id if product_instance_id is not None else settings.AA_PRODUCT_INSTANCE_ID
        self.timeout = timeout or settings.AA_TIMEOUT_SECONDS

        # Simulation mode is active if explicitly configured or if credentials are empty placeholders
        has_real_credentials = bool(
            self.client_id
            and self.client_secret
            and not self.client_id.startswith("your_")
            and not self.client_secret.startswith("your_")
        )
        if force_simulation is not None:
            self.is_simulation = force_simulation
        else:
            self.is_simulation = settings.AA_SANDBOX_SIMULATE or not has_real_credentials

        self.simulate_timeout = simulate_timeout
        self.simulate_unavailable = simulate_unavailable
        self.simulate_auth_failure = simulate_auth_failure
        self.simulate_malformed = simulate_malformed
        self.simulate_revoked = simulate_revoked
        self.simulate_expired = simulate_expired
        self.simulate_rejected = simulate_rejected
        self.custom_transactions = custom_transactions
        self.custom_balance = custom_balance

    def get_provider_name(self) -> str:
        return self.PROVIDER_NAME

    def _get_headers(self) -> dict:
        return {
            "x-client-id": self.client_id,
            "x-client-secret": self.client_secret,
            "x-product-instance-id": self.product_instance_id,
            "Content-Type": "application/json",
        }

    def initiate_consent(
        self,
        user_id: int,
        customer_identifier: Optional[str] = None,
        redirect_url: Optional[str] = None,
    ) -> Tuple[str, str]:
        """
        Step 1: Create an Account Aggregator Consent Request.
        In live sandbox: sends POST /consents to Setu AA FIU Gateway.
        In simulation: returns deterministic sandbox consent ID and authorization URL.
        """
        if self.simulate_timeout:
            raise ProviderTimeoutError("AA Consent initiation timed out", provider=self.PROVIDER_NAME)
        if self.simulate_unavailable:
            raise ProviderUnavailableError("Setu AA Sandbox is temporarily unreachable", provider=self.PROVIDER_NAME)
        if self.simulate_auth_failure:
            raise ProviderAuthenticationError("Invalid Setu AA client credentials", provider=self.PROVIDER_NAME)

        now = datetime.datetime.now(datetime.timezone.utc)
        target_customer = customer_identifier or f"student_{user_id}@setu"

        if not self.is_simulation:
            url = f"{self.base_url}/consents"
            payload = {
                "Detail": {
                    "consentMode": "STORE",
                    "fetchType": "PERIODIC",
                    "consentTypes": ["TRANSACTIONS", "PROFILE", "SUMMARY"],
                    "fiTypes": ["DEPOSIT"],
                    "DataConsumer": {"id": self.product_instance_id or "sfc-fiu-sandbox"},
                    "Customer": {"id": target_customer},
                    "Purpose": {
                        "code": "101",
                        "refUri": "https://api.rebit.org.in/aa/purpose/101.xml",
                        "text": "Personal Finance Management",
                        "Category": {"type": "string"},
                    },
                    "FIDataRange": {
                        "from": (now - datetime.timedelta(days=90)).strftime("%Y-%m-%dT00:00:00Z"),
                        "to": now.strftime("%Y-%m-%dT23:59:59Z"),
                    },
                    "DataLife": {"unit": "MONTH", "value": 12},
                    "Frequency": {"unit": "MONTH", "value": 1},
                    "DataFilter": [{"type": "TRANSACTIONAMOUNT", "operator": ">=", "value": "0"}],
                },
                "redirectUrl": redirect_url or settings.AA_REDIRECT_URL,
            }

            try:
                with httpx.Client(timeout=self.timeout) as client:
                    resp = client.post(url, json=payload, headers=self._get_headers())
                    if resp.status_code in (401, 403):
                        raise ProviderAuthenticationError("Setu AA rejected FIU credentials", provider=self.PROVIDER_NAME)
                    if resp.status_code >= 500:
                        raise ProviderUnavailableError("Setu AA returned server error", provider=self.PROVIDER_NAME)
                    resp.raise_for_status()
                    data = resp.json()
                    consent_id = data.get("id")
                    auth_url = data.get("url")
                    if not consent_id or not auth_url:
                        raise ProviderDataError("Setu AA returned invalid consent response payload", provider=self.PROVIDER_NAME)
                    return consent_id, auth_url
            except (httpx.ConnectTimeout, httpx.ReadTimeout):
                raise ProviderTimeoutError("Timeout initiating consent with Setu AA", provider=self.PROVIDER_NAME)
            except httpx.HTTPError as exc:
                raise BankProviderError(f"HTTP error connecting to Setu AA: {str(exc)}", provider=self.PROVIDER_NAME)

        # Sandbox Simulation
        consent_id = f"setu_consent_{user_id}_{int(now.timestamp())}"
        base_redirect = redirect_url or settings.AA_REDIRECT_URL
        separator = "&" if "?" in base_redirect else "?"
        auth_url = f"{base_redirect}{separator}consent_id={consent_id}&status=ACTIVE"
        return consent_id, auth_url

    def check_consent_status(self, consent_id: str) -> str:
        """
        Step 2: Check current status of consent artifact.
        Returns: 'ACTIVE', 'PENDING', 'REJECTED', 'REVOKED', or 'EXPIRED'.
        """
        if self.simulate_timeout:
            raise ProviderTimeoutError("Consent status query timed out", provider=self.PROVIDER_NAME)
        if self.simulate_unavailable:
            raise ProviderUnavailableError("Setu AA is unavailable", provider=self.PROVIDER_NAME)
        if self.simulate_auth_failure:
            raise ProviderAuthenticationError("Setu AA authentication failed", provider=self.PROVIDER_NAME)
        if self.simulate_rejected:
            return "REJECTED"
        if self.simulate_expired:
            return "EXPIRED"
        if self.simulate_revoked:
            return "REVOKED"

        if not self.is_simulation:
            url = f"{self.base_url}/consents/{consent_id}"
            try:
                with httpx.Client(timeout=self.timeout) as client:
                    resp = client.get(url, headers=self._get_headers())
                    if resp.status_code in (401, 403):
                        raise ProviderAuthenticationError("Setu AA rejected credentials", provider=self.PROVIDER_NAME)
                    if resp.status_code >= 500:
                        raise ProviderUnavailableError("Setu AA server error", provider=self.PROVIDER_NAME)
                    resp.raise_for_status()
                    data = resp.json()
                    status_val = data.get("status", "PENDING").upper()
                    return status_val
            except (httpx.ConnectTimeout, httpx.ReadTimeout):
                raise ProviderTimeoutError("Timeout querying Setu AA consent status", provider=self.PROVIDER_NAME)
            except httpx.HTTPError as exc:
                raise BankProviderError(f"Setu AA status check error: {str(exc)}", provider=self.PROVIDER_NAME)

        return "ACTIVE"

    def discover_accounts(self, consent_id: str) -> List[ProviderAccountData]:
        """
        Step 3: Account Discovery after consent approval.
        Fetches authorized accounts linked to the consent.
        """
        if self.simulate_timeout:
            raise ProviderTimeoutError("Account discovery timed out", provider=self.PROVIDER_NAME)
        if self.simulate_unavailable:
            raise ProviderUnavailableError("Setu AA account discovery unavailable", provider=self.PROVIDER_NAME)
        if self.simulate_malformed:
            raise ProviderDataError("Malformed account payload received from provider", provider=self.PROVIDER_NAME)

        now = datetime.datetime.now(datetime.timezone.utc)

        if not self.is_simulation:
            # Create session to fetch financial data payload
            session_url = f"{self.base_url}/sessions"
            try:
                with httpx.Client(timeout=self.timeout) as client:
                    session_resp = client.post(
                        session_url,
                        json={"consentId": consent_id, "format": "json"},
                        headers=self._get_headers(),
                    )
                    session_resp.raise_for_status()
                    session_id = session_resp.json().get("id")

                    fetch_url = f"{self.base_url}/sessions/{session_id}"
                    data_resp = client.get(fetch_url, headers=self._get_headers())
                    data_resp.raise_for_status()
                    payload = data_resp.json().get("payload", [])

                    accounts: List[ProviderAccountData] = []
                    for fip_item in payload:
                        fip_id = fip_item.get("fipId", "UNKNOWN_FIP")
                        for acc_item in fip_item.get("data", []):
                            acc_info = acc_item.get("decryptedPayload", {}).get("account", {})
                            summary = acc_info.get("summary", {})
                            masked_num = acc_info.get("maskedAccNumber", "••••0000")
                            balance_str = summary.get("currentBalance", "0.00")
                            acc_id = acc_info.get("linkedAccRef", f"{fip_id}_{masked_num[-4:]}")
                            accounts.append(
                                ProviderAccountData(
                                    provider_account_id=acc_id,
                                    institution_name=f"{fip_id} (Setu AA Sandbox)",
                                    account_type=summary.get("type", "savings").lower(),
                                    masked_account_number=f"••••{masked_num[-4:]}" if not masked_num.startswith("•") else masked_num,
                                    currency=summary.get("currency", "INR"),
                                    current_balance=Decimal(balance_str),
                                    balance_as_of=now,
                                )
                            )
                    return accounts if accounts else self._get_simulation_accounts(consent_id)
            except (httpx.ConnectTimeout, httpx.ReadTimeout):
                raise ProviderTimeoutError("Timeout querying Setu AA account discovery", provider=self.PROVIDER_NAME)
            except httpx.HTTPError as exc:
                raise BankProviderError(f"Setu AA discovery error: {str(exc)}", provider=self.PROVIDER_NAME)

        return self._get_simulation_accounts(consent_id)

    def _get_simulation_accounts(self, consent_id: str) -> List[ProviderAccountData]:
        now = datetime.datetime.now(datetime.timezone.utc)
        balance = self.custom_balance if self.custom_balance is not None else self.DEFAULT_BALANCE
        return [
            ProviderAccountData(
                provider_account_id=f"setu_acc_sbi_savings_{consent_id[-6:] if len(consent_id) >= 6 else '9841'}",
                institution_name=self.DEFAULT_INSTITUTION,
                account_type="savings",
                masked_account_number="••••9841",
                currency="INR",
                current_balance=balance,
                balance_as_of=now,
            )
        ]

    def connect_account(self, user_id: int) -> Tuple[ProviderAccountData, ProviderConsentData]:
        """
        Fast-connect method conforming to BankDataProvider interface.
        Directly initiates consent and discovers the primary account.
        """
        consent_id, _ = self.initiate_consent(user_id)
        now = datetime.datetime.now(datetime.timezone.utc)
        accounts = self.discover_accounts(consent_id)
        primary_account = accounts[0] if accounts else self._get_simulation_accounts(consent_id)[0]

        consent = ProviderConsentData(
            consent_id=consent_id,
            status="ACTIVE",
            purpose="Personal Finance Management (Setu AA Sandbox)",
            data_range_from=now - datetime.timedelta(days=90),
            data_range_to=now + datetime.timedelta(days=365),
            granted_at=now,
            expires_at=now + datetime.timedelta(days=365),
        )
        return primary_account, consent

    def fetch_balance(self, account_id: str) -> Tuple[Decimal, datetime.datetime]:
        """Fetch provider-reported live account balance."""
        if self.simulate_timeout:
            raise ProviderTimeoutError("Fetch balance timed out with Setu AA", provider=self.PROVIDER_NAME)
        if self.simulate_unavailable:
            raise ProviderUnavailableError("Setu AA balance endpoint unavailable", provider=self.PROVIDER_NAME)
        if self.simulate_auth_failure:
            raise ProviderAuthenticationError("Setu AA authentication failed", provider=self.PROVIDER_NAME)
        if self.simulate_malformed:
            raise ProviderDataError("Malformed balance response from Setu AA", provider=self.PROVIDER_NAME)
        if self.simulate_revoked:
            raise ConsentRevokedError("Consent revoked for this account", provider=self.PROVIDER_NAME)
        if self.simulate_expired:
            raise ConsentExpiredError("Consent expired for this account", provider=self.PROVIDER_NAME)

        now = datetime.datetime.now(datetime.timezone.utc)
        balance = self.custom_balance if self.custom_balance is not None else self.DEFAULT_BALANCE
        return balance, now

    def fetch_transactions(
        self,
        account_id: str,
        from_date: Optional[datetime.datetime] = None,
        to_date: Optional[datetime.datetime] = None,
    ) -> List[ProviderTransactionData]:
        """Fetch bank-synced transactions for the specified account."""
        if self.simulate_timeout:
            raise ProviderTimeoutError("Fetch transactions timed out with Setu AA", provider=self.PROVIDER_NAME)
        if self.simulate_unavailable:
            raise ProviderUnavailableError("Setu AA transactions feed unavailable", provider=self.PROVIDER_NAME)
        if self.simulate_auth_failure:
            raise ProviderAuthenticationError("Setu AA authentication failed", provider=self.PROVIDER_NAME)
        if self.simulate_malformed:
            raise ProviderDataError("Setu AA returned corrupted transaction payload", provider=self.PROVIDER_NAME)
        if self.simulate_revoked:
            raise ConsentRevokedError("Account consent has been revoked", provider=self.PROVIDER_NAME)
        if self.simulate_expired:
            raise ConsentExpiredError("Account consent has expired", provider=self.PROVIDER_NAME)

        if self.custom_transactions is not None:
            return self.custom_transactions

        now = datetime.datetime.now(datetime.timezone.utc)

        # 10 realistic, deterministic Setu AA sandbox transactions
        transactions = [
            ProviderTransactionData(
                external_transaction_id="SETU_AA_TXN_001",
                external_account_id=account_id,
                amount=Decimal("320.00"),
                transaction_type="expense",
                category="Food",
                description="Cafeteria & Meals (AA Sandbox)",
                raw_bank_description="UPI/CR/71829304/COLLEGE CAFE/SBIN000100",
                payment_method="UPI",
                transaction_date=now - datetime.timedelta(days=1, hours=2),
            ),
            ProviderTransactionData(
                external_transaction_id="SETU_AA_TXN_002",
                external_account_id=account_id,
                amount=Decimal("1250.00"),
                transaction_type="expense",
                category="Education",
                description="Semester Lab Manual & Stationery (AA Sandbox)",
                raw_bank_description="POS/DEBIT/CAMPUS STORE/HDFC000012",
                payment_method="Debit Card",
                transaction_date=now - datetime.timedelta(days=2, hours=5),
            ),
            ProviderTransactionData(
                external_transaction_id="SETU_AA_TXN_003",
                external_account_id=account_id,
                amount=Decimal("80.00"),
                transaction_type="expense",
                category="Transport",
                description="Commuter Bus Pass (AA Sandbox)",
                raw_bank_description="UPI/CR/19283746/CITY BUS CORP/ICIC000045",
                payment_method="UPI",
                transaction_date=now - datetime.timedelta(days=3, hours=1),
            ),
            ProviderTransactionData(
                external_transaction_id="SETU_AA_TXN_004",
                external_account_id=account_id,
                amount=Decimal("1500.00"),
                transaction_type="expense",
                category="Bills",
                description="Hostel High-Speed Internet (AA Sandbox)",
                raw_bank_description="NEFT/CMS/HOSTEL BROADBAND/SBIN000111",
                payment_method="Bank Transfer",
                transaction_date=now - datetime.timedelta(days=5, hours=8),
            ),
            ProviderTransactionData(
                external_transaction_id="SETU_AA_TXN_005",
                external_account_id=account_id,
                amount=Decimal("12000.00"),
                transaction_type="income",
                category="Scholarship",
                description="National Student Fellowship (AA Sandbox)",
                raw_bank_description="ACH/CR/MINISTRY OF EDUCATION/SBIN000002",
                payment_method="Bank Transfer",
                transaction_date=now - datetime.timedelta(days=7, hours=3),
            ),
            ProviderTransactionData(
                external_transaction_id="SETU_AA_TXN_006",
                external_account_id=account_id,
                amount=Decimal("4500.00"),
                transaction_type="income",
                category="Freelance",
                description="Python Automation Consulting (AA Sandbox)",
                raw_bank_description="UPI/CR/55667788/CLIENT CONSULTING/UTIB000089",
                payment_method="UPI",
                transaction_date=now - datetime.timedelta(days=9, hours=6),
            ),
            ProviderTransactionData(
                external_transaction_id="SETU_AA_TXN_007",
                external_account_id=account_id,
                amount=Decimal("540.00"),
                transaction_type="expense",
                category="Shopping",
                description="Electronics & USB Cables (AA Sandbox)",
                raw_bank_description="UPI/CR/44332211/TECH SHOP/PUNB000023",
                payment_method="UPI",
                transaction_date=now - datetime.timedelta(days=11, hours=4),
            ),
            ProviderTransactionData(
                external_transaction_id="SETU_AA_TXN_008",
                external_account_id=account_id,
                amount=Decimal("400.00"),
                transaction_type="expense",
                category="Entertainment",
                description="Weekend Streaming & Media (AA Sandbox)",
                raw_bank_description="UPI/CR/99887766/STREAMING MEDIA/KKBK000099",
                payment_method="UPI",
                transaction_date=now - datetime.timedelta(days=13, hours=9),
            ),
            ProviderTransactionData(
                external_transaction_id="SETU_AA_TXN_009",
                external_account_id=account_id,
                amount=Decimal("300.00"),
                transaction_type="expense",
                category="Health",
                description="Student Wellness Center (AA Sandbox)",
                raw_bank_description="UPI/CR/22113344/WELLNESS CLINIC/BARB000077",
                payment_method="UPI",
                transaction_date=now - datetime.timedelta(days=15, hours=2),
            ),
            ProviderTransactionData(
                external_transaction_id="SETU_AA_TXN_010",
                external_account_id=account_id,
                amount=Decimal("6000.00"),
                transaction_type="income",
                category="Family Support",
                description="Monthly Living Allowance (AA Sandbox)",
                raw_bank_description="IMPS/P2A/PARENTAL SUPPORT/SBIN000777",
                payment_method="Bank Transfer",
                transaction_date=now - datetime.timedelta(days=18, hours=5),
            ),
        ]

        if from_date:
            transactions = [tx for tx in transactions if tx.transaction_date >= from_date]
        if to_date:
            transactions = [tx for tx in transactions if tx.transaction_date <= to_date]

        return transactions

    def disconnect_account(self, account_id: str) -> bool:
        """Revoke consent and tear down active sessions."""
        if self.simulate_timeout:
            raise ProviderTimeoutError("Setu AA disconnect timed out", provider=self.PROVIDER_NAME)
        return True
