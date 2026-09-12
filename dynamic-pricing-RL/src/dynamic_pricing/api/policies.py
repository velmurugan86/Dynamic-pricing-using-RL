import numpy as np

from dynamic_pricing.environment.pricing_env import PRICE_ACTIONS
from dynamic_pricing.simulation.demand import simulate_demand

def random_policy(observation, env):
    return env.np_random.integers(env.action_space.n)


def fixed_price_policy(observation, env):
    return 2


def oracle_policy(observation, env):

    best_action = 2
    best_value = float("-inf")

    current_price = env.current_price

    samples = 50

    for action, price_change in PRICE_ACTIONS.items():

        candidate_price = current_price * (1.0 + price_change)

        candidate_price = float(
            np.clip(
                candidate_price,
                env.product.minimum_price,
                env.product.maximum_price
            )
        )

        total_value = 0.0

        for sample in range(samples):
            rng = np.random.default_rng(
                100000
                + env.timestep * 1000
                + action * 100
                + sample
            )

            demand, _ = simulate_demand(
                product=env.product,
                price=candidate_price,
                timestep=env.timestep + getattr(env, "season_offset", 0),
                rng=rng,
                period=env.seasonality_period,
                reference_price=env.product.initial_price,
                previous_demand=env.current_demand,
                price_change=price_change,
            )

            units_sold = min(
                demand,
                env.remaining_inventory
            )

            revenue = candidate_price * units_sold

            product_cost = (
                env.product.unit_cost * units_sold
            )

            profit = revenue - product_cost

            remaining_inventory = (
                env.remaining_inventory - units_sold
            )

            holding_cost = (
                env.product.holding_cost
                * remaining_inventory
            )

            value = profit - holding_cost

            total_value += value

        expected_value = total_value / samples

        if expected_value > best_value:
            best_value = expected_value
            best_action = action

    return best_action

POLICIES = {
    "random": random_policy,
    "fixed": fixed_price_policy,
    "oracle": oracle_policy,
}


def get_policy(name):
    if name not in POLICIES:
        raise ValueError(
            f"Unknown policy '{name}'. "
            f"Available policies: {list(POLICIES)}"
        )

    return POLICIES[name]