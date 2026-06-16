import torch
import torch.nn as nn
import numpy as np
import pandas as pd
from typing import Tuple, List

class EnergyLSTM(nn.Module):
    def __init__(self, input_dim: int, hidden_dim: int = 64, num_layers: int = 2, output_dim: int = 3):
        super(EnergyLSTM, self).__init__()
        self.hidden_dim = hidden_dim
        self.num_layers = num_layers
        
        self.lstm = nn.LSTM(
            input_dim, 
            hidden_dim, 
            num_layers, 
            batch_first=True, 
            dropout=0.2 if num_layers > 1 else 0.0
        )
        self.fc = nn.Linear(hidden_dim, output_dim)

    def forward(self, x):
        # Initialize hidden states
        h0 = torch.zeros(self.num_layers, x.size(0), self.hidden_dim).to(x.device)
        c0 = torch.zeros(self.num_layers, x.size(0), self.hidden_dim).to(x.device)
        
        # Forward propagate LSTM
        out, _ = self.lstm(x, (h0, c0))
        
        # Decode the hidden state of the last time step
        out = self.fc(out[:, -1, :])
        return out

def prepare_lstm_sequences(
    data: np.ndarray, 
    seq_length: int = 5
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Slices a 2D numpy array of shape (timesteps, features) into sequential inputs
    X of shape (samples, seq_length, features) and target targets y of shape (samples, 3)
    where targets are the first 3 indices (demand, emissions, renewable_share).
    """
    X, y = [], []
    for i in range(len(data) - seq_length):
        X.append(data[i:(i + seq_length)])
        # Target is next year's values for:
        # [electricity_generation, emissions, renewable_share]
        y.append(data[i + seq_length, :3]) 
    return np.array(X), np.array(y)
