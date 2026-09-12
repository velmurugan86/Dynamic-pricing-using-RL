"""Tests for DynamicPricingEnv."""

import numpy as np
import pytest

from dynamic_pricing import DynamicPricingEnv, Product


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


@pytest.fixture
def env(product: Product) -> DynamicPricingEnv:
    return DynamicPricingEnv(product=product, max_steps=20)


def test_env_creation(env: DynamicPricingEnv):
    assert env.action_space.n == 5
    assert env.observation_space.shape == (7,)


def test_reset_returns_valid_observation(env: DynamicPricingEnv):
    observation, info = env.reset(seed=1)

    assert observation.shape == (7,)
    assert observation.dtype == np.float32
    assert observation[0] == pytest.approx(env.product.initial_price)
    assert observation[1] == env.product.initial_inventory
    assert isinstance(info, dict)


def test_step_returns_valid_tuple(env: DynamicPricingEnv):
    env.reset(seed=1)
    observation, reward, terminated, truncated, info = env.step(2)

    assert observation.shape == (7,)
    assert isinstance(reward, float)
    assert isinstance(terminated, bool)
    assert isinstance(truncated, bool)
    assert isinstance(info, dict)


def test_observation_shape_is_correct(env: DynamicPricingEnv):
    observation, _ = env.reset(seed=1)
    assert observation.shape == (7,)

    for action in range(5):
        env.reset(seed=1)
        observation, _, _, _, _ = env.step(action)
        assert observation.shape == (7,)


def test_inventory_never_negative(env: DynamicPricingEnv):
    env.reset(seed=1)
    terminated = False
    truncated = False
    steps = 0
    while not (terminated or truncated) and steps < 1000:
        _, _, terminated, truncated, info = env.step(4)
        assert env.remaining_inventory >= 0
        steps += 1


def test_price_stays_within_limits(env: DynamicPricingEnv):
    env.reset(seed=1)
    for _ in range(50):
        action = env.action_space.sample()
        env.step(action)
        assert env.product.minimum_price <= env.current_price <= env.product.maximum_price


def test_demand_is_non_negative(env: DynamicPricingEnv):
    env.reset(seed=1)
    for _ in range(50):
        action = env.action_space.sample()
        observation, _, terminated, truncated, _ = env.step(action)
        assert observation[3] >= 0.0
        if terminated or truncated:
            env.reset(seed=1)


def test_seeded_behavior_is_reproducible(product: Product):
    env1 = DynamicPricingEnv(product=product, max_steps=20)
    env2 = DynamicPricingEnv(product=product, max_steps=20)

    obs1, _ = env1.reset(seed=123)
    obs2, _ = env2.reset(seed=123)
    assert np.allclose(obs1, obs2)

    actions = [0, 1, 2, 3, 4, 2, 1, 0]
    for action in actions:
        result1 = env1.step(action)
        result2 = env2.step(action)

        assert np.allclose(result1[0], result2[0])
        assert result1[1] == pytest.approx(result2[1])
        assert result1[2] == result2[2]
        assert result1[3] == result2[3]


def test_terminates_when_inventory_depleted():
    product = Product(
        product_id="fast-sell",
        initial_price=10.0,
        initial_inventory=5,
        minimum_price=5.0,
        maximum_price=20.0,
        base_demand=100.0,
        price_elasticity=0.1,
        seasonality_strength=0.0,
        demand_noise=0.0,
    )
    env = DynamicPricingEnv(product=product, max_steps=50)
    env.reset(seed=1)

    terminated = False
    truncated = False
    steps = 0
    while not (terminated or truncated) and steps < 50:
        _, _, terminated, truncated, _ = env.step(0)
        steps += 1

    assert terminated is True
    assert env.remaining_inventory == 0


def test_truncates_at_max_steps():
    product = Product(
        product_id="slow-sell",
        initial_price=100.0,
        initial_inventory=1_000_000,
        minimum_price=50.0,
        maximum_price=200.0,
        base_demand=1.0,
        price_elasticity=1.0,
        seasonality_strength=0.0,
        demand_noise=0.0,
    )
    env = DynamicPricingEnv(product=product, max_steps=10)
    env.reset(seed=1)

    terminated = False
    truncated = False
    steps = 0
    while not (terminated or truncated) and steps < 100:
        _, _, terminated, truncated, _ = env.step(2)
        steps += 1

    assert truncated is True
    assert steps == 10
