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
        amount = int(tx["amount"])  # enforce integer math (ZK-friendly)

        if tx["category"] == "savings":
            total_savings += amount
        else:
            total_spend += amount

        if tx["category"] in IMPULSE_CATEGORIES:
            impulse_spend += amount

    # ZK-style inequality constraints
    budget_delta = USER_BUDGET - total_spend
    impulse_delta = PREVIOUS_MONTH_IMPULSE_SPEND - impulse_spend
    savings_delta = total_savings - SAVINGS_TARGET

    budget_ok = budget_delta >= 0
    impulse_ok = impulse_delta > 0
    savings_ok = savings_delta >= 0

    discipline_passed = budget_ok and impulse_ok and savings_ok

    return {
        "constraints": {
            "budget_delta": budget_delta,
            "impulse_delta": impulse_delta,
            "savings_delta": savings_delta,
        },
        "discipline_passed": discipline_passed,
    }
