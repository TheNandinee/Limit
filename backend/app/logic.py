"""
Core discipline evaluation logic.
This is the HEART of the project.
"""

from app.mock_data import (
    USER_BUDGET,
    SAVINGS_TARGET,
    IMPULSE_CATEGORIES,
    PREVIOUS_MONTH_IMPULSE_SPEND,
)

def evaluate_discipline(transactions):
    total_spend = 0
    impulse_spend = 0
    total_savings = 0

    for tx in transactions:
        if tx["category"] == "savings":
            total_savings += tx["amount"]
        else:
            total_spend += tx["amount"]

        if tx["category"] in IMPULSE_CATEGORIES:
            impulse_spend += tx["amount"]

    budget_ok = total_spend <= USER_BUDGET
    impulse_ok = impulse_spend < PREVIOUS_MONTH_IMPULSE_SPEND
    savings_ok = total_savings >= SAVINGS_TARGET

    discipline_passed = budget_ok and impulse_ok and savings_ok

    return {
        "budget_ok": budget_ok,
        "impulse_ok": impulse_ok,
        "savings_ok": savings_ok,
        "discipline_passed": discipline_passed,
        "debug": {
            "total_spend": total_spend,
            "impulse_spend": impulse_spend,
            "total_savings": total_savings,
        },
    }
