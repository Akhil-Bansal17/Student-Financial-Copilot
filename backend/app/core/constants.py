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
