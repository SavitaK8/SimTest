import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

# Dummy PyTorch Geometric features for testing
MOCK_FEATURES = [
    [1.0, 1.0, 1.0, 1.0, 1.0, 0.0, 50.0, 0.0, 1.0, 0.0],
    [2.0, 1.0, 1.0, 1.0, 2.0, 1.0, 12.0, 0.0, 1.0, 0.0]
]
MOCK_EDGE_INDEX = [
    [0],
    [1]
]

def test_predict_endpoint():
    response = client.post("/predict", json={
        "features": MOCK_FEATURES,
        "edge_index": MOCK_EDGE_INDEX,
        "action": 1
    })
    assert response.status_code == 200
    data = response.json()
    assert "z" in data
    assert "z_next" in data
    assert "risks" in data
    assert len(data["z"]) == 16 # LATENT_DIM
    assert "crash" in data["risks"]

def test_predict_uncertain_endpoint():
    response = client.post("/predict_uncertain", json={
        "features": MOCK_FEATURES,
        "edge_index": MOCK_EDGE_INDEX,
        "action": 1
    })
    assert response.status_code == 200
    data = response.json()
    assert "uncertainty" in data
    assert "crash" in data["uncertainty"]
    
    # Uncertainty std dev should be non-negative
    assert data["uncertainty"]["crash"] >= 0.0
    assert data["uncertainty"]["security_issue"] >= 0.0

def test_remember_and_intrinsic_reward():
    # 1. Ask for reward before anything is remembered -> should be maximum novelty (1.0)
    response = client.post("/intrinsic_reward", json={
        "z_next": [0.1] * 16
    })
    assert response.status_code == 200
    assert response.json()["novelty"] == 1.0

    # 2. Remember a state
    test_z = [0.5] * 16
    response = client.post("/remember", json={
        "z": test_z
    })
    assert response.status_code == 200
    assert response.json()["status"] == "remembered"
    
    # 3. Ask for reward for the EXACT same state -> should have zero novelty
    response = client.post("/intrinsic_reward", json={
        "z_next": test_z
    })
    assert response.status_code == 200
    assert response.json()["novelty"] == 0.0

    # 4. Ask for reward for an opposite state -> should have high novelty
    response = client.post("/intrinsic_reward", json={
        "z_next": [-0.5] * 16
    })
    assert response.status_code == 200
    novelty = response.json()["novelty"]
    assert novelty > 0.5 # Cosine similarity should be negative, novelty > 0.5
