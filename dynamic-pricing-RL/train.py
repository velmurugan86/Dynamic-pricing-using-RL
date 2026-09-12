import os
import random
import csv
from pathlib import Path

import yaml
import numpy as np
import torch

from dynamic_pricing.agent.agent import (
    DQNAgent,
    normalize_state
)
from dynamic_pricing.environment.pricing_env import (
    DynamicPricingEnv
)
from dynamic_pricing.models.product import Product


EPISODES = 5000
MAX_STEPS = 100
SEED = 42
MODEL_PATH = "results/models/dqn.pt"
TRAINING_LOG = "results/training_log.csv"



def set_seed(seed):
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)

    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)


def create_environment():
    config_path = Path("configs/default.yaml")

    with open(config_path, "r") as f:
        cfg = yaml.safe_load(f)

    product = Product(**cfg["product"])

    env = DynamicPricingEnv(
        product=product,
        max_steps=cfg["environment"]["max_steps"],
        seasonality_period=cfg["environment"]["seasonality_period"],
    )

    return env


def main():
    set_seed(SEED)

    os.makedirs(
        "results/models",
        exist_ok=True
    )

    os.makedirs(
        "results",
        exist_ok=True
    )

    env = create_environment()

    agent = DQNAgent(
        state_size=7,
        action_size=5,
        learning_rate=0.001,
        gamma=0.99,
        epsilon=1.0,
        epsilon_min=0.05,
        epsilon_decay=0.997,
        batch_size=64,
        target_update=250,
    )

    print("Device:", agent.device)

    training_log = []

    for episode in range(EPISODES):

        state, _ = env.reset(
            seed=SEED + episode
        )

        state = normalize_state(
            state,
            env
        )

        total_reward = 0
        total_units_sold = 0

        prices = []
        losses = []

        terminated = False
        truncated = False

        while not (terminated or truncated):

            # Select action
            action = agent.select_action(
                state,
                training=True
            )

            # Environment step
            next_state, reward, terminated, truncated, info = (
                env.step(action)
            )

            # Collect episode statistics
            total_units_sold += info["units_sold"]

            prices.append(
                env.current_price
            )

            # Normalize next state
            next_state = normalize_state(
                next_state,
                env
            )

            # Scale reward for numerical stability
            scaled_reward = (
                reward / env.product.initial_price
            )

            # Store transition
            agent.replay_buffer.push(
                state,
                action,
                scaled_reward,
                next_state,
                terminated or truncated
            )

            # Train DQN
            loss = agent.train_step()

            if loss is not None:
                losses.append(loss)

            state = next_state

            total_reward += reward

        # Calculate average loss
        average_loss = (
            sum(losses) / len(losses)
            if losses
            else 0
        )

        # Save episode statistics
        training_log.append({
            "episode": episode + 1,
            "reward": total_reward,
            "average_loss": average_loss,
            "epsilon": agent.epsilon,
            "units_sold": total_units_sold,
            "final_inventory": env.remaining_inventory,
            "average_price": (
                np.mean(prices)
                if prices
                else 0
            ),
        })

        # Reduce exploration
        agent.decay_epsilon()

        print(
            f"Episode {episode + 1:4d} | "
            f"Reward: {total_reward:10.2f} | "
            f"Loss: {average_loss:.5f} | "
            f"Epsilon: {agent.epsilon:.3f}"
        )

    # Save trained model
    agent.save(MODEL_PATH)

    # Save training log
    with open(
        TRAINING_LOG,
        "w",
        newline=""
    ) as f:

        fieldnames = [
            "episode",
            "reward",
            "average_loss",
            "epsilon",
            "units_sold",
            "final_inventory",
            "average_price",
        ]

        writer = csv.DictWriter(
            f,
            fieldnames=fieldnames
        )

        writer.writeheader()
        writer.writerows(training_log)

    env.close()

    print()
    print("Training complete.")
    print("Model saved to:", MODEL_PATH)
    print("Training log saved to:", TRAINING_LOG)


if __name__ == "__main__":
    main()