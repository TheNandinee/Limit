from fastapi import FastAPI
from app.mock_data import transactions
from app.logic import evaluate_discipline
from app.proof import generate_proof

app = FastAPI(title="LIMIT – Proof of Financial Restraint (Demo)")

@app.get("/transactions")
def get_transactions():
    """
    Returns mock monthly transactions.
    """
    return {"transactions": transactions}

@app.post("/evaluate-discipline")
def evaluate():
    """
    Evaluates financial discipline rules.
    """
    result = evaluate_discipline(transactions)
    return result

@app.post("/generate-proof")
def generate():
    """
    Generates a simulated proof based on discipline result.
    """
    discipline_result = evaluate_discipline(transactions)
    proof = generate_proof(discipline_result)
    return proof
