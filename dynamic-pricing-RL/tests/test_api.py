"""Tests for the FastAPI simulation endpoints."""

import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from dynamic_pricing.api.app import app  # noqa: E402

client = TestClient(app)


def test_health_ok() -> None:
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_config_endpoint_returns_defaults() -> None:
    response = client.get("/api/config")
    assert response.status_code == 200
    body = response.json()
    assert body["product"]["product_id"] == "sku-001"
    assert "random" in body["policies"]
    assert body["action_labels"]["2"] == "hold"


def test_simulate_random_policy_returns_full_episode() -> None:
    response = client.post("/api/simulate", json={"seed": 42, "policy": "random"})
    assert response.status_code == 200
    body = response.json()

    summary = body["summary"]
    assert summary["steps"] == len(body["steps"])
    assert summary["steps"] > 0
    assert summary["initial_inventory"] == 100
    assert summary["total_units_sold"] <= 100
    assert summary["total_revenue"] == pytest.approx(
        sum(s["revenue"] for s in body["steps"]), abs=0.5
    )
    assert summary["terminated"] or summary["truncated"]

    first = body["steps"][0]
    assert first["step"] == 1
    assert first["inventory"] + first["units_sold"] == 100
    assert first["action_label"] in {"-10%", "-5%", "hold", "+5%", "+10%"}


def test_simulate_is_reproducible_with_same_seed() -> None:
    payload = {"seed": 7, "policy": "random"}
    r1 = client.post("/api/simulate", json=payload).json()
    r2 = client.post("/api/simulate", json=payload).json()
    assert r1["summary"] == r2["summary"]
    assert r1["steps"] == r2["steps"]


def test_simulate_greedy_policy_never_exceeds_bounds() -> None:
    body = client.post(
        "/api/simulate",
        json={"seed": 3, "policy": "greedy", "greedy_margin": 0.05},
    ).json()
    for step in body["steps"]:
        assert 500.0 <= step["price"] <= 2000.0


def test_simulate_rejects_unknown_policy() -> None:
    response = client.post("/api/simulate", json={"policy": "ppo-agent"})
    assert response.status_code == 422


def test_simulate_rejects_invalid_product() -> None:
    response = client.post(
        "/api/simulate",
        json={"product": {"initial_inventory": -5}},
    )
    assert response.status_code == 422


def test_simulate_honors_partial_product_override() -> None:
    body = client.post(
        "/api/simulate",
        json={"seed": 11, "product": {"base_demand": 5.0}},
    ).json()
    assert body["product"]["base_demand"] == 5.0
    assert body["product"]["product_id"] == "sku-001"
