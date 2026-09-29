from typing import Dict, Optional
from app.services.bank_provider.base import BankDataProvider, BankProviderError
from app.services.bank_provider.mock_provider import MockBankProvider
from app.services.bank_provider.account_aggregator_provider import AccountAggregatorProvider

# Registry for instantiated or overridden providers (useful for tests and dependency injection)
_provider_registry: Dict[str, BankDataProvider] = {}


def register_bank_provider(name: str, provider: BankDataProvider) -> None:
    """Register or override a bank data provider instance."""
    _provider_registry[name.lower()] = provider


def reset_bank_providers() -> None:
    """Clear registered or mocked provider overrides."""
    _provider_registry.clear()


def get_bank_provider(provider_name: str) -> BankDataProvider:
    """
    Factory function returning the appropriate provider implementation.
    If an override exists in the registry, it is returned; otherwise standard instances are built.
    """
    normalized = provider_name.strip().lower()

    if normalized in _provider_registry:
        return _provider_registry[normalized]

    if normalized in ("mock_bank", "sandbox", "mock"):
        return MockBankProvider()

    if normalized in ("setu_aa", "account_aggregator", "aa"):
        return AccountAggregatorProvider()

    raise BankProviderError(
        f"Bank provider '{provider_name}' is not configured or unsupported in this environment.",
        provider=provider_name,
        status_code=400,
    )
