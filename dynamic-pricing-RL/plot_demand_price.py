import yaml
import numpy as np
import matplotlib.pyplot as plt

from dynamic_pricing.models.product import Product
from dynamic_pricing.environment.pricing_env import (
    DynamicPricingEnv,
    PRICE_ACTIONS,
)


with open("configs/default.yaml", "r") as f:
    cfg = yaml.safe_load(f)

product = Product(**cfg["product"])

env = DynamicPricingEnv(
    product=product,
    max_steps=100,
    seasonality_period=30,
)

action_labels = {
    0: "-10%",
    1: "-5%",
    2: "Hold",
    3: "+5%",
    4: "+10%",
}

results = {
    action: {
        "price": [],
        "demand": [],
        "revenue": [],
        "profit": [],
    }
    for action in PRICE_ACTIONS
}

num_states = 500

for seed in range(num_states):

    for action in PRICE_ACTIONS:

        state, _ = env.reset(seed=seed)

        next_state, reward, terminated, truncated, info = env.step(
            action
        )

        results[action]["price"].append(
            float(env.current_price)
        )

        results[action]["demand"].append(
            float(env.current_demand)
        )

        results[action]["revenue"].append(
            float(info["revenue"])
        )

        results[action]["profit"].append(
            float(info["profit"])
        )


average_price = []
average_demand = []
average_revenue = []
average_profit = []

for action in PRICE_ACTIONS:
    average_price.append(
        np.mean(results[action]["price"])
    )

    average_demand.append(
        np.mean(results[action]["demand"])
    )

    average_revenue.append(
        np.mean(results[action]["revenue"])
    )

    average_profit.append(
        np.mean(results[action]["profit"])
    )


plt.figure(figsize=(10, 6))

for action in PRICE_ACTIONS:
    plt.scatter(
        results[action]["price"],
        results[action]["demand"],
        alpha=0.25,
        label=action_labels[action],
    )

plt.plot(
    average_price,
    average_demand,
    marker="o",
    linewidth=2,
)

plt.xlabel("Price")
plt.ylabel("Actual Demand")
plt.title("Price vs Actual Demand")
plt.legend()
plt.grid(True)
plt.show()


plt.figure(figsize=(10, 6))

for action in PRICE_ACTIONS:
    plt.scatter(
        results[action]["price"],
        results[action]["profit"],
        alpha=0.25,
        label=action_labels[action],
    )

plt.plot(
    average_price,
    average_profit,
    marker="o",
    linewidth=2,
)

plt.xlabel("Price")
plt.ylabel("Profit")
plt.title("Price vs Profit")
plt.legend()
plt.grid(True)
plt.show()


plt.figure(figsize=(10, 6))

for action in PRICE_ACTIONS:
    plt.scatter(
        results[action]["price"],
        results[action]["revenue"],
        alpha=0.25,
        label=action_labels[action],
    )

plt.plot(
    average_price,
    average_revenue,
    marker="o",
    linewidth=2,
)

plt.xlabel("Price")
plt.ylabel("Revenue")
plt.title("Price vs Revenue")
plt.legend()
plt.grid(True)
plt.show()


print()
print("=" * 60)
print("AVERAGE RESULTS")
print("=" * 60)

for i, action in enumerate(PRICE_ACTIONS):
    print(
        f"{action_labels[action]:>6} | "
        f"Price: {average_price[i]:8.2f} | "
        f"Demand: {average_demand[i]:8.2f} | "
        f"Revenue: {average_revenue[i]:10.2f} | "
        f"Profit: {average_profit[i]:10.2f}"
    )

best_action = int(
    np.argmax(average_profit)
)

print()
print(
    "Best average profit action:",
    action_labels[best_action]
)

env.close()