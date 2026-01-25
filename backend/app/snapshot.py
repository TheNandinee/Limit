"""
Creates a commitment hash for a monthly discipline snapshot.
Simulates a ZK witness commitment.
"""

import hashlib
import json

def create_snapshot_hash(period, transactions, public_inputs):
    payload = {
        "period": period,
        "transactions": transactions,
        "public_inputs": public_inputs,
    }

    encoded = json.dumps(payload, sort_keys=True).encode()
    return hashlib.sha256(encoded).hexdigest()
