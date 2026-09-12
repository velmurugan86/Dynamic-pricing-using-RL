from typing import Any, Optional

import gymnasium as gym
import numpy as np
from gymnasium import spaces

from dynamic_pricing.models.product import Product
from dynamic_pricing.simulation.demand import simulate_demand


PRICE_ACTIONS = {
    0: -0.10,   # -10%
    1: -0.05,   # -5%
    2: 0.00,    # Hold
    3: 0.05,    # +5%
    4: 0.10,    # +10%
}


class DynamicPricingEnv(gym.Env):

    metadata = {"render_modes": ["human"]}

    def __init__(
        self,
        product: Product,
        max_steps: int = 100,
        seasonality_period: int = 30,
        render_mode: Optional[str] = None,
    ) -> None:

        super().__init__()

        self.product = product
        self.max_steps = max_steps
        self.seasonality_period = seasonality_period
        self.render_mode = render_mode

        self.action_space = spaces.Discrete(5)

        self.observation_space = spaces.Box(
            low=np.array(
                [
                    0.0,
                    0.0,
                    0.0,
                    0.0,
                    0.0,
                    0.0,
                    -np.inf,
                ],
                dtype=np.float32,
            ),
            high=np.array(
                [
                    np.inf,
                    np.inf,
                    np.inf,
                    np.inf,
                    np.inf,
                    np.inf,
                    np.inf,
                ],
                dtype=np.float32,
            ),
            dtype=np.float32,
        )

        self._rng: np.random.Generator = (
            np.random.default_rng()
        )

        self.current_price: float = product.initial_price

        self.remaining_inventory: int = (
            product.initial_inventory
        )

        self.historical_demand: float = 0.0

        self.current_demand: float = 0.0

        self.demand_velocity: float = 0.0

        self.timestep: int = 0

        self._default_initial_price: float = product.initial_price
        self._default_base_demand: float = product.base_demand
        self._default_initial_inventory: int = product.initial_inventory

        self.season_offset: int = 0

        self.replenishment_interval = 10
        self.replenishment_min = 10
        self.replenishment_max = 30

    def _get_seasonality(self) -> float:

        from dynamic_pricing.simulation.demand import (
            seasonality_factor,
        )

        return seasonality_factor(
            self.timestep + self.season_offset,
            self.product.seasonality_strength,
            self.seasonality_period,
        )

    def _get_obs(self) -> np.ndarray:

        return np.array(
            [
                self.current_price,
                self.remaining_inventory,
                self.historical_demand,
                self.current_demand,
                self._get_seasonality(),
                self.product.price_elasticity,
                self.demand_velocity,
            ],
            dtype=np.float32,
        )

    def _get_info(self) -> dict[str, Any]:

        return {
            "timestep": self.timestep,
            "product_id": self.product.product_id,
        }

    def randomize_episode(self) -> None:

        if self._default_initial_price > 500:
            self.product.initial_price = float(
                self._rng.uniform(800, 1200)
            )
            self.product.base_demand = float(
                self._rng.uniform(4.5, 7.5)
            )
            self.product.initial_inventory = int(
                self._rng.integers(220, 380)
            )
        else:
            self.product.initial_price = float(
                np.clip(
                    self._default_initial_price * self._rng.uniform(0.95, 1.05),
                    self.product.minimum_price,
                    self.product.maximum_price,
                )
            )
            self.product.base_demand = float(
                self._default_base_demand * self._rng.uniform(0.95, 1.05)
            )
            self.product.initial_inventory = int(
                max(1, self._default_initial_inventory * self._rng.uniform(0.95, 1.05))
            )

        self.product.price_elasticity = float(
            self._rng.uniform(1.8, 2.6)
        )
        self.product.seasonality_strength = float(
            self._rng.uniform(0.05, 0.25)
        )
        self.product.demand_noise = float(
            self._rng.uniform(0.05, 0.15)
        )

    def reset(
        self,
        *,
        seed: Optional[int] = None,
        options: Optional[dict[str, Any]] = None,
    ) -> tuple[np.ndarray, dict[str, Any]]:

        super().reset(seed=seed)
        self._rng = np.random.default_rng(seed)

        self.randomize_episode()

        self.timestep = 0
        self.season_offset = int(
            self._rng.integers(
                0,
                self.seasonality_period,
            )
        )

        self.current_price = float(
            np.clip(
                self.product.initial_price,
                self.product.minimum_price,
                self.product.maximum_price,
            )
        )

        # Baseline market price anchor for this episode
        self.reference_price = self.product.initial_price

        self.remaining_inventory = int(
            max(
                1,
                self.product.initial_inventory,
            )
        )

        self.current_demand, _ = simulate_demand(
            product=self.product,
            price=self.current_price,
            timestep=self.timestep + self.season_offset,
            rng=self._rng,
            period=self.seasonality_period,
            reference_price=self.product.initial_price,
            previous_demand=None,
            price_change=0.0,
        )

        self.historical_demand = self.current_demand

        self.demand_velocity = float(
            self._rng.normal(
                0.0,
                self.product.base_demand * 0.05,
            )
        )

        observation = self._get_obs()

        info = self._get_info()

        return observation, info

    def step(self, action: int):

        if action not in PRICE_ACTIONS:

            raise ValueError(
                f"Invalid action: {action}. "
                f"Must be one of {list(PRICE_ACTIONS)}."
            )

        price_change = PRICE_ACTIONS[action]

        new_price = self.current_price * (
            1.0 + price_change
        )

        self.current_price = float(
            np.clip(
                new_price,
                self.product.minimum_price,
                self.product.maximum_price,
            )
        )

        demand, factors = simulate_demand(
            product=self.product,
            price=self.current_price,
            timestep=self.timestep + self.season_offset,
            rng=self._rng,
            period=self.seasonality_period,
            reference_price=self.product.initial_price,
            previous_demand=self.current_demand,
            price_change=price_change,
        )

        previous_demand = self.current_demand

        self.current_demand = demand


        units_sold = int(
            min(
                demand,
                self.remaining_inventory,
            )
        )

        units_sold = max(
            0,
            units_sold,
        )

        self.remaining_inventory = max(
            0,
            self.remaining_inventory - units_sold,
        )


        revenue = (
            self.current_price
            * units_sold
        )


        product_cost = (
            self.product.unit_cost
            * units_sold
        )

        profit = (
            revenue
            - product_cost
        )


        replenishment = 0

        if (
            self.timestep > 0
            and self.timestep
            % self.replenishment_interval
            == 0
        ):

            replenishment = int(
                self._rng.integers(
                    self.replenishment_min,
                    self.replenishment_max + 1,
                )
            )

            self.remaining_inventory += (
                replenishment
            )


        holding_cost = (
            self.product.holding_cost
            * self.remaining_inventory
        )


        self.timestep += 1

        clearance_penalty = 0.0

        truncated = (
            self.timestep >= self.max_steps
        )

        if (
            truncated
            and self.remaining_inventory > 0
        ):

            clearance_penalty = (
                self.product.clearance_penalty
                * self.remaining_inventory
            )

        # --- Demand-based penalties ---
        # Penalty when demand drops well below base demand
        # (signals overpricing is killing demand)
        demand_drop_penalty = 0.0
        demand_ratio = (
            demand / max(self.product.base_demand, 1.0)
        )
        if demand_ratio < 0.4:
            # Penalty proportional to how far demand has
            # fallen below the 40% threshold
            demand_drop_penalty = (
                (0.4 - demand_ratio)
                * self.product.base_demand
                * (self.current_price - self.product.unit_cost)
                * 0.5
            )

        # Lost-sales penalty: demand existed but couldn't
        # be fulfilled (could mean price should have been
        # lowered earlier to spread sales more evenly)
        lost_sales = max(0.0, demand - units_sold)
        margin = max(
            0.0,
            self.current_price - self.product.unit_cost
        )
        lost_sale_penalty = lost_sales * margin * 0.1

        reward = (
            profit
            - holding_cost
            - clearance_penalty
            - demand_drop_penalty
            - lost_sale_penalty
        )

        if self.timestep == 1:

            self.historical_demand = demand

        else:

            self.historical_demand = (
                (
                    self.historical_demand
                    * (self.timestep - 1)
                )
                + demand
            ) / self.timestep


        self.demand_velocity = (
            demand
            - previous_demand
        )


        terminated = bool(self.remaining_inventory <= 0)

        observation = self._get_obs()
        info = self._get_info()

        info["units_sold"] = units_sold

        info["revenue"] = revenue

        info["product_cost"] = product_cost

        info["profit"] = profit

        info["holding_cost"] = holding_cost

        info["clearance_penalty"] = (
            clearance_penalty
        )

        info["demand_drop_penalty"] = (
            demand_drop_penalty
        )

        info["lost_sale_penalty"] = (
            lost_sale_penalty
        )

        info["replenishment"] = replenishment

        info["seasonality"] = (
            factors["seasonality"]
        )

        info["trend"] = factors["trend"]

        info["shock"] = factors["shock"]

        info["noise"] = factors["noise"]


        if self.render_mode == "human":

            self.render()

        return (
            observation,
            float(reward),
            terminated,
            truncated,
            info,
        )


    def render(self) -> None:

        if self.render_mode == "human":

            print(
                f"Step {self.timestep} | "
                f"Price: {self.current_price:.2f} | "
                f"Demand: {self.current_demand:.2f} | "
                f"Inventory: {self.remaining_inventory}"
            )


    def close(self) -> None:
        pass