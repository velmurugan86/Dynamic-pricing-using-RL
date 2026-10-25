import torch
import torch.nn as nn


class DQN(nn.Module):
    """Dueling DQN with layer normalization.

    Separates the Q-value into a state-value stream V(s) and an
    advantage stream A(s, a).  This produces more stable Q-value
    estimates — especially important during online / continuous
    learning where mini-batches are small and non-stationary.

    Layer normalization is applied after each hidden layer to
    stabilize gradients during online updates.
    """

    def __init__(self, state_size=7, action_size=5):
        super().__init__()

        # Shared feature extractor
        self.feature = nn.Sequential(
            nn.Linear(state_size, 256),
            nn.LayerNorm(256),
            nn.ReLU(),
            nn.Linear(256, 256),
            nn.LayerNorm(256),
            nn.ReLU(),
        )

        # Value stream — estimates V(s)
        self.value_stream = nn.Sequential(
            nn.Linear(256, 128),
            nn.ReLU(),
            nn.Linear(128, 1),
        )

        # Advantage stream — estimates A(s, a)
        self.advantage_stream = nn.Sequential(
            nn.Linear(256, 128),
            nn.ReLU(),
            nn.Linear(128, action_size),
        )

    def forward(self, state):
        features = self.feature(state)
        value = self.value_stream(features)          # (batch, 1)
        advantage = self.advantage_stream(features)  # (batch, action_size)

        # Q(s,a) = V(s) + A(s,a) - mean(A)
        q_values = value + advantage - advantage.mean(dim=1, keepdim=True)
        return q_values