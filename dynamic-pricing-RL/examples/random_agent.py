import yaml
from pathlib import Path

from dynamic_pricing.environment.pricing_env import DynamicPricingEnv
from dynamic_pricing.models.product import Product


def load_config():
    config_path = Path("configs/default.yaml")

    with open(config_path, "r") as f:
        return yaml.safe_load(f)


def main():

    cfg = load_config()

    product = Product(**cfg["product"])

    env = DynamicPricingEnv(
        product=product,
        max_steps=cfg["environment"]["max_steps"],
        seasonality_period=cfg["environment"]["seasonality_period"],
    )

    observation, info = env.reset(seed=42)

    total_reward = 0

    terminated = False
    truncated = False

    while not (terminated or truncated):

        action = env.action_space.sample()

        observation, reward, terminated, truncated, info = env.step(action)

        total_reward += reward

        print(
            f"Step {info['timestep']} | "
            f"Action: {action} | "
            f"Price: {observation[0]:.2f} | "
            f"Demand: {observation[3]:.2f} | "
            f"Inventory: {observation[1]:.0f} | "
            f"Revenue: {info['revenue']:.2f} | "
            f"Reward: {reward:.2f}"
        )

    print("\nEpisode finished")
    print(f"Total reward: {total_reward:.2f}")
    print(f"Final inventory: {observation[1]:.0f}")

    env.close()


if __name__ == "__main__":
    main()