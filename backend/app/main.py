from fastapi import FastAPI
from app.mock_data import (
    transactions,
    CURRENT_PERIOD,
    PUBLIC_INPUTS,
)
from app.logic import evaluate_discipline
from app.proof import generate_proof
from app.snapshot import create_snapshot_hash


app = FastAPI(title="LIMIT – Proof of Financial Restraint (Demo)")


@app.get("/transactions")
def get_transactions():
    """
    Returns mock monthly transactions.
    Demo-only endpoint (never on-chain).
    """
    return {"transactions": transactions}


@app.post("/evaluate-discipline")
def evaluate_discipline_endpoint():
    """
    Evaluates financial discipline using ZK-style constraints
    and returns a snapshot commitment hash.
    """
    result = evaluate_discipline(transactions)

    snapshot_hash = create_snapshot_hash(
        CURRENT_PERIOD,
        transactions,
        PUBLIC_INPUTS,
    )

    return {
        "period": CURRENT_PERIOD,
        "public_inputs": PUBLIC_INPUTS,
        "constraints": result["constraints"],
        "discipline_passed": result["discipline_passed"],
        "snapshot_hash": snapshot_hash,
    }


@app.post("/generate-proof")
def generate_proof_endpoint():
    """
    Generates a simulated proof bound to a discipline snapshot.
    """
    evaluation = evaluate_discipline(transactions)

    snapshot_hash = create_snapshot_hash(
        CURRENT_PERIOD,
        transactions,
        PUBLIC_INPUTS,
    )

    proof = generate_proof(
        snapshot_hash,
        evaluation["discipline_passed"],
    )

    return proof
