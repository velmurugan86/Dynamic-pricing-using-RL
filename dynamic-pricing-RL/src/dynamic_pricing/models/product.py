from dataclasses import dataclass


@dataclass
class Product:
    product_id: str
    initial_price: float
    initial_inventory: int
    minimum_price: float
    maximum_price: float
    base_demand: float
    price_elasticity: float
    seasonality_strength: float
    demand_noise: float

    unit_cost: float = 0.0
    holding_cost: float = 0.0
    clearance_penalty: float = 0.0
    elasticity_amplifier: float = 1.5

    def __post_init__(self):
        if self.minimum_price <= 0:
            raise ValueError("minimum_price must be positive")

        if self.maximum_price < self.minimum_price:
            raise ValueError(
                "maximum_price must be >= minimum_price"
            )

        if not (
            self.minimum_price
            <= self.initial_price
            <= self.maximum_price
        ):
            raise ValueError(
                "initial_price must be within "
                "[minimum_price, maximum_price]"
            )

        if self.initial_inventory < 0:
            raise ValueError(
                "initial_inventory cannot be negative"
            )

        if self.base_demand < 0:
            raise ValueError(
                "base_demand cannot be negative"
            )

        if self.price_elasticity < 0:
            raise ValueError(
                "price_elasticity cannot be negative"
            )

        if self.demand_noise < 0:
            raise ValueError(
                "demand_noise cannot be negative"
            )

        if self.unit_cost < 0:
            raise ValueError(
                "unit_cost cannot be negative"
            )

        if self.unit_cost > self.maximum_price:
            raise ValueError(
                "unit_cost cannot exceed maximum_price"
            )

        if self.holding_cost < 0:
            raise ValueError(
                "holding_cost cannot be negative"
            )

        if self.clearance_penalty < 0:
            raise ValueError(
                "clearance_penalty cannot be negative"
            )

        if self.elasticity_amplifier <= 0:
            raise ValueError(
                "elasticity_amplifier must be positive"
            )