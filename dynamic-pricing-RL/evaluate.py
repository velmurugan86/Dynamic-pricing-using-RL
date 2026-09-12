import csv
import yaml
import numpy as np

from dynamic_pricing.agent.agent import DQNAgent, normalize_state
from dynamic_pricing.environment.pricing_env import DynamicPricingEnv
from dynamic_pricing.models.product import Product
from dynamic_pricing.api.policies import (
    random_policy,
    fixed_price_policy,
    oracle_policy,
)


MODEL_PATH = "results/models/dqn.pt"
EVALUATION_EPISODES = 20


ACTION_LABELS = {
    0: "-10%",
    1: "-5%",
    2: "Hold",
    3: "+5%",
    4: "+10%",
}

def create_environment():
    with open("configs/default.yaml", "r") as f:
        cfg = yaml.safe_load(f)

    product = Product(**cfg["product"])

    return DynamicPricingEnv(
        product=product,
        max_steps=cfg["environment"]["max_steps"],
        seasonality_period=cfg["environment"]["seasonality_period"],
    )


def empty_result():
    return {
        "reward": 0.0,
        "revenue": 0.0,
        "product_cost": 0.0,
        "profit": 0.0,
        "holding_cost": 0.0,
        "clearance_penalty": 0.0,
        "units_sold": 0,
        "final_inventory": 0,
        "prices": [],
    }


def run_policy(env, policy, seed, record_steps=False):

    state, _ = env.reset(seed=seed)

    if policy == "dqn":
        state = normalize_state(state, env)

    result = empty_result()
    steps = []

    terminated = False
    truncated = False

    while not (terminated or truncated):

        # Select action
        if policy == "random":
            action = random_policy(state, env)

        elif policy == "fixed":
            action = fixed_price_policy(state, env)

        elif policy == "oracle":
            action = oracle_policy(state, env)

        elif policy == "dqn":
            action = agent.select_action(
                state,
                training=False
            )

        else:
            raise ValueError(
                f"Unknown policy: {policy}"
            )

        # Environment step
        next_state, reward, terminated, truncated, info = env.step(action)

        if policy == "dqn":
            next_state = normalize_state(
                next_state,
                env
            )

        # Collect results
        result["reward"] += reward
        result["revenue"] += info["revenue"]
        result["product_cost"] += info["product_cost"]
        result["profit"] += info["profit"]
        result["holding_cost"] += info["holding_cost"]
        result["clearance_penalty"] += info["clearance_penalty"]
        result["units_sold"] += info["units_sold"]

        result["prices"].append(
            env.current_price
        )

        # Save individual steps only for DQN
        if record_steps:

            steps.append({
                "step": info["timestep"],
                "action": action,
                "action_label": ACTION_LABELS[action],
                "price": round(
                    env.current_price,
                    2
                ),
                "demand": round(
                    env.current_demand,
                    2
                ),
                "units_sold": info["units_sold"],
                "inventory": env.remaining_inventory,
                "seasonality": round(
                    info["seasonality"],
                    4
                ),
                "trend": round(
                    info["trend"],
                    4
                ),
                "shock": round(
                    info["shock"],
                    4
                ),
                "noise": round(
                    info["noise"],
                    4
                ),
                "revenue": round(
                    info["revenue"],
                    2
                ),
                "product_cost": round(
                    info["product_cost"],
                    2
                ),
                "profit": round(
                    info["profit"],
                    2
                ),
                "holding_cost": round(
                    info["holding_cost"],
                    2
                ),
                "clearance_penalty": round(
                    info["clearance_penalty"],
                    2
                ),
                "reward": round(
                    reward,
                    2
                ),
            })

        state = next_state

    result["final_inventory"] = (
        env.remaining_inventory
    )

    if result["prices"]:

        result["average_price"] = np.mean(
            result["prices"]
        )

        result["minimum_price"] = min(
            result["prices"]
        )

        result["maximum_price"] = max(
            result["prices"]
        )

    else:

        result["average_price"] = 0
        result["minimum_price"] = 0
        result["maximum_price"] = 0

    return result, steps


def average_results(results):

    return {
        "reward": np.mean(
            [r["reward"] for r in results]
        ),

        "revenue": np.mean(
            [r["revenue"] for r in results]
        ),

        "product_cost": np.mean(
            [r["product_cost"] for r in results]
        ),

        "profit": np.mean(
            [r["profit"] for r in results]
        ),

        "holding_cost": np.mean(
            [r["holding_cost"] for r in results]
        ),

        "clearance_penalty": np.mean(
            [r["clearance_penalty"] for r in results]
        ),

        "units_sold": np.mean(
            [r["units_sold"] for r in results]
        ),

        "final_inventory": np.mean(
            [r["final_inventory"] for r in results]
        ),

        "average_price": np.mean(
            [r["average_price"] for r in results]
        ),

        "minimum_price": np.mean(
            [r["minimum_price"] for r in results]
        ),

        "maximum_price": np.mean(
            [r["maximum_price"] for r in results]
        ),
    }


def print_results(name, results):

    avg = average_results(results)

    print()
    print(name)
    print("-" * 50)

    print(
        f"Average Reward:         "
        f"{avg['reward']:.2f}"
    )

    print(
        f"Average Revenue:        "
        f"{avg['revenue']:.2f}"
    )

    print(
        f"Average Product Cost:   "
        f"{avg['product_cost']:.2f}"
    )

    print(
        f"Average Profit:         "
        f"{avg['profit']:.2f}"
    )

    print(
        f"Average Holding Cost:   "
        f"{avg['holding_cost']:.2f}"
    )

    print(
        f"Average Clearance Cost: "
        f"{avg['clearance_penalty']:.2f}"
    )

    print(
        f"Average Units Sold:     "
        f"{avg['units_sold']:.2f}"
    )

    print(
        f"Average Final Inventory: "
        f"{avg['final_inventory']:.2f}"
    )

    print(
        f"Average Price:          "
        f"{avg['average_price']:.2f}"
    )

    print(
        f"Minimum Price:          "
        f"{avg['minimum_price']:.2f}"
    )

    print(
        f"Maximum Price:          "
        f"{avg['maximum_price']:.2f}"
    )


def save_steps(steps):

    path = "results/dqn_policy.csv"

    fieldnames = [
        "step",
        "action",
        "action_label",
        "price",
        "demand",
        "units_sold",
        "inventory",
        "seasonality",
        "trend",
        "shock",
        "noise",
        "revenue",
        "product_cost",
        "profit",
        "holding_cost",
        "clearance_penalty",
        "reward",
    ]

    with open(
        path,
        "w",
        newline=""
    ) as f:

        writer = csv.DictWriter(
            f,
            fieldnames=fieldnames
        )

        writer.writeheader()
        writer.writerows(steps)

    print()
    print(
        "DQN episode saved to:",
        path
    )


def main():

    global agent

    env = create_environment()

    # Load trained DQN
    agent = DQNAgent(
        state_size=7,
        action_size=5,
        epsilon=0.0,
    )

    agent.load(MODEL_PATH)

    # Results
    random_results = []
    fixed_results = []
    oracle_results = []
    dqn_results = []

    first_dqn_steps = []

    # Evaluation
    for episode in range(
        EVALUATION_EPISODES
    ):

        seed = 1000 + episode

        # Random
        random_result, _ = run_policy(
            env,
            "random",
            seed
        )

        # Fixed
        fixed_result, _ = run_policy(
            env,
            "fixed",
            seed
        )

        # Oracle
        oracle_result, _ = run_policy(
            env,
            "oracle",
            seed
        )

        # DQN
        dqn_result, dqn_steps = run_policy(
            env,
            "dqn",
            seed,
            record_steps=(episode == 0)
        )

        random_results.append(
            random_result
        )

        fixed_results.append(
            fixed_result
        )

        oracle_results.append(
            oracle_result
        )

        dqn_results.append(
            dqn_result
        )

        if episode == 0:
            first_dqn_steps = dqn_steps

    # Print
    print()
    print("=" * 50)
    print("DYNAMIC PRICING EVALUATION")
    print("=" * 50)

    print_results(
        "Random Policy",
        random_results
    )

    print_results(
        "Fixed Price Policy",
        fixed_results
    )

    print_results(
        "Oracle Policy",
        oracle_results
    )

    print_results(
        "DQN Policy",
        dqn_results
    )

    # Save DQN episode
    save_steps(
        first_dqn_steps
    )

    env.close()


if __name__ == "__main__":
    main()