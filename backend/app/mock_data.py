"""
Mock transaction data for demo purposes.
No real bank data. Fully hardcoded.
"""

from datetime import datetime

USER_BUDGET = 20000
SAVINGS_TARGET = 5000

# Current month transactions
transactions = [
    {"amount": 3000, "category": "food", "date": "2026-01-05"},
    {"amount": 1500, "category": "shopping", "date": "2026-01-07"},
    {"amount": 2000, "category": "travel", "date": "2026-01-10"},
    {"amount": 5000, "category": "savings", "date": "2026-01-12"},
    {"amount": 1200, "category": "food", "date": "2026-01-15"},
]

# Previous month impulse spend (mocked)
PREVIOUS_MONTH_IMPULSE_SPEND = 4000

# Categories considered impulse spending
IMPULSE_CATEGORIES = {"food", "shopping", "travel"}
