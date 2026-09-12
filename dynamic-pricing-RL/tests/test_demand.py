"""Tests for the demand simulator."""

import numpy as np
import pytest

from dynamic_pricing.models.product import Product
from dynamic_pricing.simulation.demand import (
    price_effect,
    seasonality_factor,
    simulate_demand,
)


@pytest.fixture
def product() -> Product:
    return Product(
        product_id="test-sku",
        initial_price=100.0,
        initial_inventory=50,
        minimum_price=50.0,
        maximum_price=200.0,
        base_demand=10.0,
        price_elasticity=1.2,
        seasonality_strength=0.2,
        demand_noise=0.1,
    )


def test_demand_is_non_negative(product: Product):
    rng = np.random.default_rng(0)
    for price in [50.0, 80.0, 100.0, 150.0, 200.0]:
        for t in range(30):
            demand, _ = simulate_demand(product, price, t, rng)
            assert demand >= 0.0


def test_demand_decreases_as_price_increases(product: Product):
    rng = np.random.default_rng(0)
    product.demand_noise = 0.0

    low_price_demand, _ = simulate_demand(product, 80.0, 0, rng)
    high_price_demand, _ = simulate_demand(product, 150.0, 0, rng)

    assert low_price_demand > high_price_demand


def test_price_effect_at_initial_price_is_one(product: Product):
    effect = price_effect(product.initial_price, product.initial_price, product.price_elasticity)
    assert effect == pytest.approx(1.0)


def test_seasonality_factor_oscillates():
    values = [seasonality_factor(t, strength=0.2, period=30) for t in range(30)]
    assert max(values) > 1.0
    assert min(values) < 1.0


def test_seasonality_zero_strength_is_constant():
    values = [seasonality_factor(t, strength=0.0, period=30) for t in range(10)]
    assert all(v == pytest.approx(1.0) for v in values)


def test_demand_is_seedable(product: Product):
    rng1 = np.random.default_rng(42)
    rng2 = np.random.default_rng(42)

    demand1, _ = simulate_demand(product, 100.0, 0, rng1)
    demand2, _ = simulate_demand(product, 100.0, 0, rng2)

    assert demand1 == pytest.approx(demand2)

