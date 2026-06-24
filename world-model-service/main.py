from fastapi import FastAPI
from pydantic import BaseModel
import torch
import torch.nn as nn
import torch.nn.functional as F
from typing import List, Optional
from torch_geometric.nn import SAGEConv, global_mean_pool
import faiss
import numpy as np

app = FastAPI()

class FeaturesInput(BaseModel):
    features: List[List[float]]
    edge_index: List[List[int]]
    action: int
    context: Optional[List[float]] = [0.0, 0.0, 0.0]

class RememberInput(BaseModel):
    z: List[float]

class RewardInput(BaseModel):
    z_next: List[float]

# PyTorch Models
class Encoder(nn.Module):
    def __init__(self, input_dim=10, hidden_dim=32, latent_dim=16):
        super().__init__()
        self.conv1 = SAGEConv(input_dim, hidden_dim)
        self.conv2 = SAGEConv(hidden_dim, latent_dim)
        
    def forward(self, x, edge_index, batch):
        x = self.conv1(x, edge_index)
        x = torch.relu(x)
        x = self.conv2(x, edge_index)
        z = global_mean_pool(x, batch)
        return z

class FusionEncoder(nn.Module):
    def __init__(self, graph_latent_dim=16, context_dim=3, final_latent_dim=16):
        super().__init__()
        self.graph_encoder = Encoder(input_dim=10, hidden_dim=32, latent_dim=graph_latent_dim)
        self.fusion_net = nn.Sequential(
            nn.Linear(graph_latent_dim + context_dim, 32),
            nn.ReLU(),
            nn.Linear(32, final_latent_dim)
        )
        
    def forward(self, x, edge_index, batch, context):
        z_graph = self.graph_encoder(x, edge_index, batch)
        z_fused = torch.cat([z_graph, context], dim=-1)
        z_final = self.fusion_net(z_fused)
        return z_final

class TransitionNetwork(nn.Module):
    def __init__(self, latent_dim=16, action_dim=1):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(latent_dim + action_dim, 32),
            nn.ReLU(),
            nn.Linear(32, latent_dim)
        )
        
    def forward(self, z, action):
        action_tensor = action.unsqueeze(-1).float()
        x = torch.cat([z, action_tensor], dim=-1)
        return self.net(x)

class RiskHead(nn.Module):
    """Phase 8: Uncertainty-Aware Risk Head with Monte Carlo Dropout."""
    def __init__(self, latent_dim=16, action_dim=1, dropout_rate=0.2):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(latent_dim + action_dim, 32),
            nn.ReLU(),
            nn.Dropout(p=dropout_rate),
            nn.Linear(32, 32),
            nn.ReLU(),
            nn.Dropout(p=dropout_rate),
            nn.Linear(32, 4) # Crash, Security Issue, Auth Bypass, Novelty (legacy)
        )
        
    def forward(self, z, action):
        action_tensor = action.unsqueeze(-1).float()
        x = torch.cat([z, action_tensor], dim=-1)
        return torch.sigmoid(self.net(x))

MC_FORWARD_PASSES = 20  # Number of stochastic forward passes for uncertainty estimation

encoder = FusionEncoder()
transition_net = TransitionNetwork()
risk_head = RiskHead()

# Phase 7 Upgrade: FAISS Latent Memory Buffer (O(1) similarity)
LATENT_DIM = 16
faiss_index = faiss.IndexFlatIP(LATENT_DIM)
buffer_size = 0

@app.post("/predict")
def predict_world_model(data: FeaturesInput):
    x = torch.tensor(data.features, dtype=torch.float32)
    edge_index = torch.tensor(data.edge_index, dtype=torch.long)
    batch = torch.zeros(x.size(0), dtype=torch.long)
    action_t = torch.tensor([data.action], dtype=torch.float32)
    context_t = torch.tensor([data.context], dtype=torch.float32)
    
    with torch.no_grad():
        z = encoder(x, edge_index, batch, context_t)
        z_next = transition_net(z, action_t)
        risk = risk_head(z, action_t)
        risk_values = risk.squeeze(0).tolist()
        
    return {
        "z": z.squeeze(0).tolist(),
        "z_next": z_next.squeeze(0).tolist(),
        "risks": {
            "crash": risk_values[0],
            "security_issue": risk_values[1],
            "auth_bypass": risk_values[2],
            "novelty": risk_values[3]
        }
    }

@app.post("/predict_uncertain")
def predict_with_uncertainty(data: FeaturesInput):
    """Phase 8: Monte Carlo Dropout uncertainty estimation.
    Runs N stochastic forward passes through the RiskHead with dropout enabled,
    returning mean predictions and standard deviation (uncertainty).
    """
    x = torch.tensor(data.features, dtype=torch.float32)
    edge_index = torch.tensor(data.edge_index, dtype=torch.long)
    batch = torch.zeros(x.size(0), dtype=torch.long)
    action_t = torch.tensor([data.action], dtype=torch.float32)
    context_t = torch.tensor([data.context], dtype=torch.float32)

    with torch.no_grad():
        z = encoder(x, edge_index, batch, context_t)
        z_next = transition_net(z, action_t)

    # Enable dropout at inference time for MC sampling
    risk_head.train()
    mc_samples = []
    with torch.no_grad():
        for _ in range(MC_FORWARD_PASSES):
            risk = risk_head(z, action_t)
            mc_samples.append(risk.squeeze(0))
    risk_head.eval()

    stacked = torch.stack(mc_samples)       # (N, 4)
    mean_risk = stacked.mean(dim=0).tolist() # mean prediction
    std_risk = stacked.std(dim=0).tolist()   # uncertainty

    return {
        "z": z.squeeze(0).tolist(),
        "z_next": z_next.squeeze(0).tolist(),
        "risks": {
            "crash": mean_risk[0],
            "security_issue": mean_risk[1],
            "auth_bypass": mean_risk[2],
            "novelty": mean_risk[3]
        },
        "uncertainty": {
            "crash": std_risk[0],
            "security_issue": std_risk[1],
            "auth_bypass": std_risk[2],
            "novelty": std_risk[3]
        }
    }

@app.post("/remember")
def remember_state(data: RememberInput):
    global buffer_size
    z_np = np.array([data.z], dtype=np.float32)
    # Normalize for cosine similarity
    faiss.normalize_L2(z_np)
    faiss_index.add(z_np)
    buffer_size += 1
    return {"status": "remembered", "buffer_size": buffer_size}

@app.post("/intrinsic_reward")
def get_intrinsic_reward(data: RewardInput):
    if buffer_size == 0:
        return {"novelty": 1.0}
        
    z_pred = np.array([data.z_next], dtype=np.float32)
    faiss.normalize_L2(z_pred)
    
    # Search for the nearest neighbor
    D, I = faiss_index.search(z_pred, 1)
    max_sim = D[0][0] # Inner product of normalized vectors = cosine sim
    
    # Novelty = 1 - max_cosine_similarity
    novelty = max(0.0, float(1.0 - max_sim))
    
    return {"novelty": novelty}

