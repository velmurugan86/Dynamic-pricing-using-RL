import numpy as np

from dynamic_pricing.models.product import Product


def seasonality_factor(
    timestep: int,
    strength: float,
    period: int = 30
) -> float:
    return 1.0 + strength * np.sin(
        2 * np.pi * timestep / period
    )


def price_effect(
    price: float,
    reference_price: float,
    elasticity: float,
    amplifier: float = 1.0,
    price_change: float = 0.0,
) -> float:
    """Compute demand multiplier from price relative to market baseline and action taken.

    Parameters
    ----------
    price : float
        Current product price.
    reference_price : float
        Market baseline reference price (initial_price) anchoring customer valuation.
    elasticity : float
        Price elasticity of demand.
    amplifier : float
        Elasticity scaling factor.
    price_change : float
        The relative price change from the action chosen at this step:
        -0.10 (-10%), -0.05 (-5%), 0.0 (Hold), +0.05 (+5%), +0.10 (+10%).
    """
    if reference_price <= 0:
        raise ValueError("reference_price must be positive")

    ratio = price / reference_price
    effective_elasticity = elasticity * amplifier
    base_effect = float(ratio ** (-effective_elasticity))

    # Action promotional / price-change effect:
    # -10%: +40% promotional volume surge
    # -5%:  +20% promotional volume surge
    # Hold: 1.0 (neutral)
    # +5%:  0.90 (-10% demand resistance)
    # +10%: 0.70 (-30% demand backlash)
    if price_change <= -0.08:
        promo_factor = 1.40
    elif price_change <= -0.03:
        promo_factor = 1.20
    elif price_change >= 0.08:
        promo_factor = 0.70
    elif price_change >= 0.03:
        promo_factor = 0.90
    else:
        promo_factor = 1.0

    return float(base_effect * promo_factor)


def market_trend_factor(
    timestep: int,
    rng: np.random.Generator
) -> float:

    trend = 1.0 + 0.001 * timestep

    variation = rng.normal(
        loc=0.0,
        scale=0.03
    )

    return max(
        0.5,
        trend + variation
    )


def demand_shock(
    rng: np.random.Generator
) -> float:

    probability = 0.05

    if rng.random() < probability:

        if rng.random() < 0.7:
            return float(
                rng.uniform(1.3, 2.0)
            )
        else:
            return float(
                rng.uniform(0.5, 0.8)
            )

    return 1.0


def apply_demand_memory(
    raw_demand: float,
    previous_demand: float,
    memory_strength: float = 0.3,
) -> float:
    """Blend current raw demand with previous demand.

    This creates *hysteresis*: when price is raised and demand
    drops, lowering the price again doesn't instantly restore
    demand because some customers were lost.  ``memory_strength``
    controls how sticky the previous demand level is (0 = no
    memory, 1 = demand never changes).
    """
    if previous_demand <= 0:
        return raw_demand

    return (
        (1.0 - memory_strength) * raw_demand
        + memory_strength * previous_demand
    )


def simulate_demand(
    product: Product,
    price: float,
    timestep: int,
    rng: np.random.Generator,
    period: int = 30,
    reference_price: float | None = None,
    previous_demand: float | None = None,
    price_change: float = 0.0,
) -> tuple[float, dict]:
    """Simulate demand for one timestep.

    Parameters
    ----------
    reference_price : float, optional
        Market baseline reference price. Falls back to ``product.initial_price``
        when not supplied.
    previous_demand : float, optional
        Demand from the previous step, used for the memory / hysteresis effect.
    price_change : float, optional
        The fractional price change from the action chosen (-0.10, -0.05, 0.0, 0.05, 0.10).
    """
    if reference_price is None:
        reference_price = product.initial_price

    seasonality = seasonality_factor(
        timestep,
        product.seasonality_strength,
        period
    )

    elasticity_effect = price_effect(
        price=price,
        reference_price=reference_price,
        elasticity=product.price_elasticity,
        amplifier=product.elasticity_amplifier,
        price_change=price_change,
    )

    trend = market_trend_factor(
        timestep,
        rng
    )

    shock = demand_shock(
        rng
    )

    raw_demand = (
        product.base_demand
        * elasticity_effect
        * seasonality
        * trend
        * shock
    )

    noise_std = (
        product.demand_noise
        * product.base_demand
    )

    noise = (
        rng.normal(
            loc=0.0,
            scale=noise_std
        )
        if noise_std > 0
        else 0.0
    )

    raw_demand = max(
        0.0,
        raw_demand + noise
    )

    # Apply demand memory / hysteresis
    if previous_demand is not None:
        demand = apply_demand_memory(
            raw_demand,
            previous_demand,
            memory_strength=0.3,
        )
    else:
        demand = raw_demand

    demand = max(0.0, demand)

    factors = {
        "seasonality": seasonality,
        "trend": trend,
        "shock": shock,
        "noise": noise,
    }

    return float(demand), factors