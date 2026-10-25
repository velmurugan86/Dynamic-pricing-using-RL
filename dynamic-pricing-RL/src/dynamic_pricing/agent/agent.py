import random
import logging

import numpy as np
import torch
import torch.nn.functional as F
import torch.optim as optim

from dynamic_pricing.agent.dqn import DQN
from dynamic_pricing.agent.replay_buffer import ReplayBuffer

logger = logging.getLogger(__name__)


class DQNAgent:

    def __init__(
        self,
        state_size=7,
        action_size=5,
        learning_rate=0.001,
        gamma=0.99,
        epsilon=1.0,
        epsilon_min=0.05,
        epsilon_decay=0.995,
        buffer_size=50000,
        batch_size=64,
        target_update=250,
        device=None,
    ):
        self.state_size = state_size
        self.action_size = action_size

        self.gamma = gamma

        self.epsilon = epsilon
        self.epsilon_min = epsilon_min
        self.epsilon_decay = epsilon_decay

        self.batch_size = batch_size
        self.target_update = target_update

        self.device = device or (
            "cuda" if torch.cuda.is_available() else "cpu"
        )

        self.policy_net = DQN(
            state_size,
            action_size
        ).to(self.device)

        self.target_net = DQN(
            state_size,
            action_size
        ).to(self.device)

        self.target_net.load_state_dict(
            self.policy_net.state_dict()
        )

        self.target_net.eval()

        self.optimizer = optim.Adam(
            self.policy_net.parameters(),
            lr=learning_rate
        )

        self.replay_buffer = ReplayBuffer(buffer_size)

        self.steps = 0

        # --- Online learning tracking ---
        self.total_feedback_received = 0
        self.last_loss = None
        self.checkpoint_interval = 10  # Save after every N feedback items

    def select_action(self, state, training=True):

        if training and random.random() < self.epsilon:
            return random.randrange(self.action_size)

        state = torch.tensor(
            state,
            dtype=torch.float32,
            device=self.device
        ).unsqueeze(0)

        with torch.no_grad():
            q_values = self.policy_net(state)

        return int(torch.argmax(q_values, dim=1).item())

    def train_step(self):

        if len(self.replay_buffer) < self.batch_size:
            return None

        states, actions, rewards, next_states, dones = (
            self.replay_buffer.sample(self.batch_size)
        )

        states = torch.tensor(
            np.array(states),
            dtype=torch.float32,
            device=self.device
        )

        actions = torch.tensor(
            actions,
            dtype=torch.long,
            device=self.device
        ).unsqueeze(1)

        rewards = torch.tensor(
            rewards,
            dtype=torch.float32,
            device=self.device
        )

        next_states = torch.tensor(
            np.array(next_states),
            dtype=torch.float32,
            device=self.device
        )

        dones = torch.tensor(
            dones,
            dtype=torch.float32,
            device=self.device
        )

        # Q(s, a)
        current_q = self.policy_net(states).gather(
            1, actions
        ).squeeze(1)

        # Double DQN: use policy_net to SELECT the best action,
        # but target_net to EVALUATE its Q-value. This reduces
        # overestimation bias, which is critical for online learning
        # where data is non-stationary.
        with torch.no_grad():
            next_actions = self.policy_net(next_states).argmax(
                dim=1, keepdim=True
            )
            next_q = self.target_net(next_states).gather(
                1, next_actions
            ).squeeze(1)

            target_q = rewards + (
                self.gamma * next_q * (1 - dones)
            )

        loss = F.smooth_l1_loss(
            current_q,
            target_q
        )

        self.optimizer.zero_grad()

        loss.backward()

        torch.nn.utils.clip_grad_norm_(
            self.policy_net.parameters(),
            max_norm=1.0
        )

        self.optimizer.step()

        self.steps += 1
        self.last_loss = loss.item()

        if self.steps % self.target_update == 0:
            self.update_target_network()

        return loss.item()

    def process_feedback(self, state, action, reward, next_state, done):
        """Process a single feedback interaction from the website.

        This is the core of the online learning loop:
        1. Push the real-world transition into the replay buffer
        2. Run a training step (if buffer has enough samples)
        3. Decay epsilon to gradually reduce exploration
        4. Track statistics

        Returns the training loss (or None if buffer too small).
        """
        self.replay_buffer.push(state, action, reward, next_state, done)
        self.total_feedback_received += 1

        loss = self.train_step()

        # Gentle epsilon decay on each feedback — slower than offline
        # training since real interactions are scarce and valuable.
        self.decay_epsilon()

        return loss

    def update_target_network(self):
        self.target_net.load_state_dict(
            self.policy_net.state_dict()
        )

    def decay_epsilon(self):
        self.epsilon = max(
            self.epsilon_min,
            self.epsilon * self.epsilon_decay
        )

    def save(self, path):
        torch.save(
            {
                "policy_net": self.policy_net.state_dict(),
                "target_net": self.target_net.state_dict(),
                "optimizer": self.optimizer.state_dict(),
                "epsilon": self.epsilon,
                "steps": self.steps,
                "total_feedback_received": self.total_feedback_received,
            },
            path
        )
        logger.info("Model checkpoint saved to %s (step %d)", path, self.steps)

    def load(self, path):

        checkpoint = torch.load(
            path,
            map_location=self.device
        )

        self.policy_net.load_state_dict(
            checkpoint["policy_net"]
        )

        self.target_net.load_state_dict(
            checkpoint["target_net"]
        )

        self.optimizer.load_state_dict(
            checkpoint["optimizer"]
        )

        self.epsilon = checkpoint["epsilon"]
        self.steps = checkpoint["steps"]
        self.total_feedback_received = checkpoint.get(
            "total_feedback_received", 0
        )

    def should_checkpoint(self):
        """Return True if enough feedback has been received to warrant
        saving a checkpoint."""
        return (
            self.total_feedback_received > 0
            and self.total_feedback_received % self.checkpoint_interval == 0
        )


def normalize_state(state, env):

    state = np.array(state, dtype=np.float32).copy()

    state[0] /= env.product.maximum_price
    state[1] /= max(env.product.initial_inventory, 1)

    state[2] /= max(env.product.base_demand, 1)
    state[3] /= max(env.product.base_demand, 1)

    state[4] = state[4]

    state[5] /= 5.0

    state[6] /= max(env.product.base_demand, 1)

    return state