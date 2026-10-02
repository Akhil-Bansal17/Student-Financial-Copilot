"""
Centralized constants and enums for categories and payment methods.
"""

EXPENSE_CATEGORIES = {
    "Food",
    "Transport",
    "Education",
    "Shopping",
    "Bills",
    "Entertainment",
    "Health",
    "Hostel/Rent",
    "Other",
}

INCOME_CATEGORIES = {
    "Pocket Money",
    "Salary",
    "Freelance",
    "Scholarship",
    "Family Support",
    "Other",
}

ALL_CATEGORIES = EXPENSE_CATEGORIES | INCOME_CATEGORIES

PAYMENT_METHODS = {
    "Cash",
    "UPI",
    "Debit Card",
    "Credit Card",
    "Bank Transfer",
    "Other",
}

CATEGORY_CONFIDENCES = {
    "HIGH",
    "MEDIUM",
    "LOW",
}

CATEGORIZATION_SOURCES = {
    "USER_MANUAL",
    "USER_PREFERENCE",
    "RULE_HIGH",
    "RULE_SUGGESTION",
    "PROVIDER",
    "DEFAULT",
}

TRANSACTION_STATUSES = {
    "POSTED",
    "PENDING",
    "REVERSED",
}

# ==============================================================================
# Phase 12: Recurring Expenses & Subscriptions Constants
# ==============================================================================
from decimal import Decimal

RECURRING_FREQUENCIES = {
    "WEEKLY",
    "BIWEEKLY",
    "MONTHLY",
    "QUARTERLY",
    "YEARLY",
}

RECURRING_TYPES = {
    "SUBSCRIPTION",
    "RECURRING_BILL",
    "RECURRING_EXPENSE",
    "RECURRING_OTHER",
    "UNKNOWN_RECURRING_TYPE",
}

RECURRING_STATUSES = {
    "ACTIVE",
    "OVERDUE_EXPECTED",
    "POSSIBLY_ENDED",
    "PAUSED",
    "USER_IGNORED",
}

RECURRING_PREFERENCES = {
    "IGNORE",
    "RECURRING",
    "SUBSCRIPTION",
    "BILL",
}

# Detection interval ranges (min_days, max_days)
RECURRING_INTERVALS = {
    "WEEKLY": (5, 9),
    "BIWEEKLY": (11, 17),
    "MONTHLY": (25, 35),
    "QUARTERLY": (80, 100),
    "YEARLY": (330, 400),
}

# Minimum evidence threshold (occurrences required to identify a pattern)
MIN_RECURRING_OCCURRENCES = {
    "WEEKLY": 3,
    "BIWEEKLY": 3,
    "MONTHLY": 3,
    "QUARTERLY": 2,
    "YEARLY": 2,
}

# Grace periods before marking next expected payment as OVERDUE_EXPECTED (in days)
RECURRING_GRACE_PERIOD_DAYS = {
    "WEEKLY": 4,
    "BIWEEKLY": 7,
    "MONTHLY": 10,
    "QUARTERLY": 20,
    "YEARLY": 30,
}

# Factor of interval after which an overdue item is considered POSSIBLY_ENDED
POSSIBLY_ENDED_INTERVAL_MULTIPLIER = Decimal("2.0")

# Amount variation threshold: if max-min / avg > 10%, marked as variable amount
VARIABLE_AMOUNT_THRESHOLD_PCT = Decimal("10.0")

# Price change detection thresholds
PRICE_CHANGE_MIN_AMOUNT = Decimal("1.00")
PRICE_CHANGE_MIN_PERCENTAGE = Decimal("1.0")

# Known merchant classifications
KNOWN_SUBSCRIPTION_MERCHANTS = {
    "NETFLIX",
    "SPOTIFY",
    "AMAZON PRIME",
    "YOUTUBE",
    "YOUTUBE PREMIUM",
    "DISNEY",
    "HOTSTAR",
    "APPLE",
    "APPLE MUSIC",
    "ICLOUD",
    "GOOGLE ONE",
    "GYM",
    "FITNESS",
    "CULT.FIT",
    "COURSERA",
    "UDEMY",
    "LINKEDIN",
    "GITHUB",
    "CHATGPT",
    "OPENAI",
    "NOTION",
}

KNOWN_RECURRING_BILL_MERCHANTS = {
    "AIRTEL",
    "JIO",
    "VODAFONE IDEA",
    "VI",
    "HOSTEL BROADBAND",
    "ELECTRICITY",
    "BESCOM",
    "TNEB",
    "MSEB",
    "BSES",
    "WATER",
    "GAS",
    "PIPED GAS",
    "MAINTENANCE",
}

KNOWN_RECURRING_EXPENSE_MERCHANTS = {
    "HOSTEL MESS",
    "CAMPUS MESS",
    "RENT",
    "PG RENT",
    "HOSTEL RENT",
    "METRO PASS",
    "BUS PASS",
    "TUITION",
}

# ==============================================================================
# Phase 13: Cash Flow Forecasting & Financial Planning Constants
# ==============================================================================

FORECAST_HORIZONS = [7, 30, 90]
DEFAULT_FORECAST_HORIZON_DAYS = 30
DEFAULT_MINIMUM_BALANCE_THRESHOLD = Decimal("2000.00")

DATA_SUFFICIENCY_LEVELS = {
    "INSUFFICIENT",
    "LIMITED",
    "MODERATE",
    "STRONG",
}

FORECAST_CONFIDENCE_LEVELS = {
    "LOW",
    "MEDIUM",
    "HIGH",
}

FORECAST_EVENT_TYPES = {
    "EXPECTED_INCOME",
    "RECURRING_EXPENSE",
    "RECURRING_SUBSCRIPTION",
    "RECURRING_BILL",
    "ESTIMATED_SPENDING",
    "GOAL_ALLOCATION",
    "OTHER",
}

RECURRING_INCOME_CATEGORIES = {
    "Salary",
    "Stipend",
    "Scholarship",
    "Family Support",
    "Pocket Money",
}

