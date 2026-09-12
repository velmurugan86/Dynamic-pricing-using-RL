import os
from functools import lru_cache
from pathlib import Path

import numpy as np
import torch
import yaml
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from dynamic_pricing.agent.dqn import DQN
from dynamic_pricing.api.policies import POLICIES, get_policy
from dynamic_pricing.api.schemas import (
    EpisodeSummary,
    PredictRequest,
    PredictResponse,
    SimulateRequest,
    SimulateResponse,
    StepRecord,
)
from dynamic_pricing.environment.pricing_env import DynamicPricingEnv, PRICE_ACTIONS
from dynamic_pricing.models.product import Product

ACTION_LABELS = {0: "-10%", 1: "-5%", 2: "hold", 3: "+5%", 4: "+10%"}
ACTION_CHANGES = {0: -0.10, 1: -0.05, 2: 0.00, 3: 0.05, 4: 0.10}

CONFIG_PATH = Path(os.path.join(os.path.dirname(__file__), "..", "..", "..", "configs", "default.yaml")).resolve()
MODEL_PATH = Path(os.path.join(os.path.dirname(__file__), "..", "..", "..", "results", "models", "dqn.pt")).resolve()


@lru_cache(maxsize=1)
def _load_model() -> DQN:
    """Load the trained DQN weights once and cache them in memory."""
    device = "cuda" if torch.cuda.is_available() else "cpu"
    net = DQN(state_size=7, action_size=5).to(device)
    if not MODEL_PATH.exists():
        raise FileNotFoundError(
            f"Trained model not found at {MODEL_PATH}. "
            "Run train.py first to produce results/models/dqn.pt."
        )
    checkpoint = torch.load(MODEL_PATH, map_location=device)
    state_dict = checkpoint.get("policy_net", checkpoint)
    net.load_state_dict(state_dict)
    net.eval()
    return net


def _normalize_state(
    state: list[float],
    cfg: dict,
) -> list[float]:
    """Reproduce the normalization used during training (agent.normalize_state)."""
    p = cfg["product"]
    max_price = float(p.get("maximum_price", 2000.0))
    init_inv = max(float(p.get("initial_inventory", 300.0)), 1.0)
    base_demand = max(float(p.get("base_demand", 6.0)), 1.0)

    s = list(state)  # copy
    s[0] /= max_price       # current_price
    s[1] /= init_inv        # remaining_inventory
    s[2] /= base_demand     # historical_demand
    s[3] /= base_demand     # current_demand
    # s[4] seasonality — kept as-is
    s[5] /= 5.0             # price_elasticity
    s[6] /= base_demand     # demand_velocity
    return s

app = FastAPI(
    title="Dynamic Pricing Simulator API",
    description="Run episodes of the Gymnasium dynamic-pricing environment.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def load_default_config() -> dict:
    with open(CONFIG_PATH, "r") as f:
        return yaml.safe_load(f)


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/api/predict", response_model=PredictResponse)
def predict(request: PredictRequest) -> PredictResponse:
    """Run the trained DQN model on a single state and return a pricing action."""
    cfg = load_default_config()

    raw_state = [
        request.current_price,
        request.remaining_inventory,
        request.historical_demand,
        request.current_demand,
        request.seasonality,
        request.price_elasticity,
        request.demand_velocity,
    ]

    norm_state = _normalize_state(raw_state, cfg)

    try:
        net = _load_model()
    except FileNotFoundError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    device = next(net.parameters()).device
    tensor = torch.tensor(
        [norm_state], dtype=torch.float32, device=device
    )

    with torch.no_grad():
        q_tensor = net(tensor)  # shape (1, 5)

    q_list: list[float] = q_tensor[0].tolist()
    action = int(torch.argmax(q_tensor, dim=1).item())

    q_values = {ACTION_LABELS[i]: round(q_list[i], 4) for i in range(5)}

    price_change = ACTION_CHANGES[action]
    p_cfg = cfg["product"]
    previous_price = request.current_price
    updated_price = float(
        np.clip(
            previous_price * (1.0 + price_change),
            p_cfg["minimum_price"],
            p_cfg["maximum_price"],
        )
    )
    price_change_percent = round(
        (updated_price - previous_price) / previous_price * 100, 4
    )

    return PredictResponse(
        action=action,
        action_label=ACTION_LABELS[action],
        price_change_percent=price_change_percent,
        previous_price=round(previous_price, 4),
        updated_price=round(updated_price, 4),
        q_values=q_values,
        normalized_state=[round(v, 6) for v in norm_state],
    )


@app.get("/api/config")
def get_config() -> dict:
    cfg = load_default_config()
    return {
        "product": cfg["product"],
        "environment": cfg["environment"],
        "policies": sorted(POLICIES),
        "action_labels": ACTION_LABELS,
    }


@app.post("/api/simulate", response_model=SimulateResponse)
def simulate(request: SimulateRequest) -> SimulateResponse:
    cfg = load_default_config()
    product_data = {**cfg["product"], **(request.product or {})}
    env_cfg = cfg["environment"]

    try:
        product = Product(**product_data)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    try:
        policy = get_policy(request.policy)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    env = DynamicPricingEnv(
        product=product,
        max_steps=request.max_steps if request.max_steps is not None else env_cfg["max_steps"],
        seasonality_period=(
            request.seasonality_period
            if request.seasonality_period is not None
            else env_cfg["seasonality_period"]
        ),
    )

    env.action_space.seed(request.seed)
    observation, _info = env.reset(seed=request.seed)

    records: list[StepRecord] = []
    cumulative_revenue = 0.0
    terminated = truncated = False

    while not (terminated or truncated):
        action = policy(observation, env)
        observation, _reward, terminated, truncated, info = env.step(action)

        cumulative_revenue += info["revenue"]
        records.append(
            StepRecord(
                step=info["timestep"],
                action=action,
                action_label=ACTION_LABELS[action],
                price=round(float(observation[0]), 4),
                demand=round(float(observation[3]), 4),
                units_sold=info["units_sold"],
                inventory=int(observation[1]),
                seasonality=round(float(observation[4]), 4),
                revenue=round(info["revenue"], 4),
                cumulative_revenue=round(cumulative_revenue, 4),
            )
        )

    prices = [r.price for r in records] or [product.initial_price]
    summary = EpisodeSummary(
        total_revenue=round(cumulative_revenue, 2),
        steps=len(records),
        initial_inventory=product.initial_inventory,
        final_inventory=int(observation[1]),
        terminated=terminated,
        truncated=truncated,
        average_price=round(sum(prices) / len(prices), 2),
        min_price=round(min(prices), 2),
        max_price=round(max(prices), 2),
        total_units_sold=sum(r.units_sold for r in records),
    )

    env.close()

    return SimulateResponse(
        policy=request.policy,
        seed=request.seed,
        product=product_data,
        summary=summary,
        steps=records,
    )
