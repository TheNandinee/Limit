"""
Simulated Proof of Restraint.
NOT real cryptography.
Just a boundary to show how ZK fits later.
"""

from datetime import datetime
import uuid

def generate_proof(snapshot_hash, discipline_passed):
    return {
    "proof_id": f"0x{uuid.uuid4().hex[:8].upper()}",
    "snapshot_hash": snapshot_hash,
    "discipline_valid": discipline_passed,
    "timestamp": datetime.utcnow().isoformat(),
    }
