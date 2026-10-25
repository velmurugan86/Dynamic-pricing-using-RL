import logging
import os
import threading
from pathlib import Path

import numpy as np
import torch
import yaml
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from dynamic_pricing.agent.agent import DQNAgent
from dynamic_pricing.api.policies import POLICIES, get_policy
from dynamic_pricing.api.schemas import (
    EpisodeSummary,
    FeedbackRequest,
    FeedbackResponse,
    PredictRequest,
    PredictResponse,
    SimulateRequest,
    SimulateResponse,
    StepRecord,
    TrainingStatsResponse,
)
from dynamic_pricing.environment.pricing_env import DynamicPricingEnv, PRICE_ACTIONS
from dynamic_pricing.models.product import Product

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

ACTION_LABELS = {0: "-10%", 1: "-5%", 2: "hold", 3: "+5%", 4: "+10%"}
ACTION_CHANGES = {0: -0.10, 1: -0.05, 2: 0.00, 3: 0.05, 4: 0.10}

CONFIG_PATH = Path(os.path.join(os.path.dirname(__file__), "..", "..", "..", "configs", "default.yaml")).resolve()
MODEL_PATH = Path(os.path.join(os.path.dirname(__file__), "..", "..", "..", "results", "models", "dqn.pt")).resolve()

# ----------------------------------------------------------------
# Live agent — replaces the old frozen @lru_cache model loader.
# The agent stays in memory with its replay buffer and optimizer,
# so it can learn from live purchase feedback.
# ----------------------------------------------------------------
_agent: DQNAgent | None = None
_agent_lock = threading.Lock()


def _get_live_agent() -> DQNAgent:
    """Return the singleton live DQNAgent, initializing on first call.

    Unlike the old lru_cache approach, this keeps the full agent
    (replay buffer + optimizer + both networks) alive so online
    training can happen.
    """
    global _agent
    if _agent is not None:
        return _agent

    with _agent_lock:
        # Double-check inside the lock
        if _agent is not None:
            return _agent

        device = "cuda" if torch.cuda.is_available() else "cpu"
        agent = DQNAgent(
            state_size=7,
            action_size=5,
            learning_rate=0.0005,   # Lower LR for stable online updates
            gamma=0.99,
            epsilon=0.10,           # Start with mild exploration for live serving
            epsilon_min=0.03,
            epsilon_decay=0.999,    # Very slow decay — real feedback is scarce
            batch_size=32,          # Smaller batches for faster online steps
            target_update=100,
            device=device,
        )

        if MODEL_PATH.exists():
            try:
                agent.load(str(MODEL_PATH))
                # Clamp epsilon for live serving — don't use the trained
                # value (likely ~0.05) since we want some exploration for
                # online learning, but not too much.
                agent.epsilon = max(agent.epsilon, 0.05)
                logger.info(
                    "Loaded pre-trained model from %s (step %d, ε=%.3f)",
                    MODEL_PATH, agent.steps, agent.epsilon,
                )
            except Exception as exc:
                logger.warning(
                    "Could not load pre-trained model from %s: %s. "
                    "Starting with a fresh network.",
                    MODEL_PATH, exc,
                )
        else:
            logger.info(
                "No pre-trained model at %s — starting fresh.",
                MODEL_PATH,
            )

        _agent = agent
        return _agent


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
    description=(
        "Run episodes of the Gymnasium dynamic-pricing environment. "
        "Supports online learning via the /api/feedback endpoint."
    ),
    version="0.2.0",
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
    agent = _get_live_agent()
    return {
        "status": "ok",
        "model_loaded": True,
        "online_steps": agent.steps,
        "feedback_received": agent.total_feedback_received,
    }


@app.post("/api/predict", response_model=PredictResponse)
def predict(request: PredictRequest) -> PredictResponse:
    """Run the live DQN agent on a single state and return a pricing action.

    The agent uses epsilon-greedy exploration so it occasionally tries
    non-optimal actions — this ensures the online learning loop
    continues to gather diverse experience.
    """
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

    agent = _get_live_agent()

    # Use epsilon-greedy for live predictions — enables exploration
    # so the agent can learn from new pricing strategies.
    action = agent.select_action(norm_state, training=True)

    # Compute Q-values for the response (always greedy for display)
    tensor = torch.tensor(
        [norm_state], dtype=torch.float32, device=agent.device
    )
    with torch.no_grad():
        q_tensor = agent.policy_net(tensor)

    q_list: list[float] = q_tensor[0].tolist()
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


@app.post("/api/feedback", response_model=FeedbackResponse)
def feedback(request: FeedbackRequest) -> FeedbackResponse:
    """Receive purchase outcome feedback and train the model online.

    This is the heart of the continuous learning loop. When a customer
    checks out, the frontend sends the actual purchase result here.
    The agent converts it into an RL transition (s, a, r, s', done)
    and runs a mini-batch training step.

    Reward shaping:
      - Revenue from the sale (price * units_sold)
      - Penalty if no units were sold (price too high or out of stock)
      - Small exploration bonus for trying new price points
    """
    cfg = load_default_config()
    agent = _get_live_agent()

    if not request.applied:
        return FeedbackResponse(
            status="skipped",
            buffer_size=len(agent.replay_buffer),
            total_online_steps=agent.steps,
            loss=None,
            epsilon=agent.epsilon,
        )

    # Reconstruct the state BEFORE the action was taken
    state_before = [
        request.old_price,
        request.remaining_inventory + request.units_sold,  # inventory before sale
        request.historical_demand,
        request.current_demand,
        request.seasonality,
        request.price_elasticity,
        request.demand_velocity,
    ]

    # Reconstruct the state AFTER the action / purchase
    state_after = [
        request.new_price,
        request.remaining_inventory,
        request.historical_demand,
        max(0.0, request.current_demand),  # Updated demand
        request.seasonality,
        request.price_elasticity,
        request.demand_velocity,
    ]

    norm_before = _normalize_state(state_before, cfg)
    norm_after = _normalize_state(state_after, cfg)

    # Determine which action was taken (find the closest price change)
    if request.old_price > 0:
        actual_change = (request.new_price - request.old_price) / request.old_price
    else:
        actual_change = 0.0

    action = min(
        ACTION_CHANGES.keys(),
        key=lambda a: abs(ACTION_CHANGES[a] - actual_change),
    )

    # --- Reward shaping ---
    p_cfg = cfg["product"]
    unit_cost = float(p_cfg.get("unit_cost", 600.0))
    initial_price = float(p_cfg.get("initial_price", 1000.0))

    revenue = request.new_price * request.units_sold
    cost = unit_cost * request.units_sold
    profit = revenue - cost

    # Penalty for zero sales (price was too aggressive or out of stock)
    zero_sale_penalty = 0.0
    if request.units_sold == 0 and request.remaining_inventory > 0:
        zero_sale_penalty = -50.0  # Penalty for pricing too high

    # Scale reward for numerical stability (same as train.py)
    reward = (profit + zero_sale_penalty) / initial_price

    done = request.remaining_inventory <= 0

    # Push transition and train
    loss = agent.process_feedback(
        norm_before, action, reward, norm_after, done
    )

    status = "trained" if loss is not None else "buffered"

    # Auto-checkpoint periodically
    if agent.should_checkpoint():
        try:
            os.makedirs(MODEL_PATH.parent, exist_ok=True)
            agent.save(str(MODEL_PATH))
        except Exception as exc:
            logger.warning("Checkpoint save failed: %s", exc)

    logger.info(
        "Feedback processed: product=%s, units_sold=%d, reward=%.4f, "
        "loss=%s, ε=%.3f, buffer=%d",
        request.product_id, request.units_sold,
        reward, f"{loss:.5f}" if loss else "N/A",
        agent.epsilon, len(agent.replay_buffer),
    )

    return FeedbackResponse(
        status=status,
        buffer_size=len(agent.replay_buffer),
        total_online_steps=agent.steps,
        loss=round(loss, 6) if loss is not None else None,
        epsilon=round(agent.epsilon, 4),
    )


@app.get("/api/training-stats", response_model=TrainingStatsResponse)
def training_stats() -> TrainingStatsResponse:
    """Return current online training statistics."""
    agent = _get_live_agent()
    return TrainingStatsResponse(
        total_online_steps=agent.steps,
        buffer_size=len(agent.replay_buffer),
        epsilon=round(agent.epsilon, 4),
        last_loss=round(agent.last_loss, 6) if agent.last_loss is not None else None,
        total_feedback_received=agent.total_feedback_received,
        model_checkpoint_path=str(MODEL_PATH),
        model_loaded=True,
    )


@app.get("/api/config")
def get_config() -> dict:
    cfg = load_default_config()
    agent = _get_live_agent()
    return {
        "product": cfg["product"],
        "environment": cfg["environment"],
        "policies": sorted(POLICIES),
        "action_labels": ACTION_LABELS,
        "online_learning": {
            "enabled": True,
            "epsilon": round(agent.epsilon, 4),
            "buffer_size": len(agent.replay_buffer),
            "total_feedback": agent.total_feedback_received,
        },
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
