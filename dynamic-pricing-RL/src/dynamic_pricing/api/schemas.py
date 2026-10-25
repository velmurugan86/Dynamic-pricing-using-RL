"""Pydantic request/response schemas for the simulation API."""

from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field


class PredictRequest(BaseModel):
    """Single-step state vector sent from the Fluxmart dashboard."""

    model_config = ConfigDict(extra="forbid")

    current_price: float
    remaining_inventory: float
    historical_demand: float
    current_demand: float
    seasonality: float
    price_elasticity: float
    demand_velocity: float


class PredictResponse(BaseModel):
    """Model action + derived pricing decision returned to the frontend."""

    action: int
    action_label: str
    price_change_percent: float
    previous_price: float
    updated_price: float
    q_values: dict[str, float]
    normalized_state: list[float]


class FeedbackRequest(BaseModel):
    """Purchase outcome sent back after a customer completes checkout.

    This closes the RL loop: the model learns from the actual result
    of the price it recommended, not just from simulation.
    """

    model_config = ConfigDict(extra="forbid")

    product_id: str
    old_price: float
    new_price: float
    applied: bool = True

    # Actual purchase outcome fields
    units_sold: int = Field(default=0, ge=0)
    remaining_inventory: float = Field(default=0, ge=0)

    # Context at the time of sale (used to reconstruct the state vector)
    historical_demand: float = Field(default=0, ge=0)
    current_demand: float = Field(default=0, ge=0)
    seasonality: float = Field(default=1.0)
    price_elasticity: float = Field(default=0.0)
    demand_velocity: float = Field(default=0.0)


class FeedbackResponse(BaseModel):
    """Acknowledgement returned after processing a feedback interaction."""

    status: str  # "trained" | "buffered" | "skipped"
    buffer_size: int
    total_online_steps: int
    loss: Optional[float] = None
    epsilon: float


class TrainingStatsResponse(BaseModel):
    """Current training statistics for the live model."""

    total_online_steps: int
    buffer_size: int
    epsilon: float
    last_loss: Optional[float] = None
    total_feedback_received: int
    model_checkpoint_path: str
    model_loaded: bool


class SimulateRequest(BaseModel):
    """Request to run one simulation episode."""

    model_config = ConfigDict(extra="forbid")

    product: Optional[dict[str, Any]] = None
    max_steps: Optional[int] = Field(default=None, ge=1)
    seasonality_period: Optional[int] = Field(default=None, ge=1)
    seed: Optional[int] = None
    policy: str = "random"
    greedy_margin: float = Field(default=0.10, ge=0.0, le=1.0)

class StepRecord(BaseModel):
    """One timestep of a finished episode."""

    step: int
    action: int
    action_label: str
    price: float
    demand: float
    units_sold: int
    inventory: int
    seasonality: float
    revenue: float
    cumulative_revenue: float


class EpisodeSummary(BaseModel):
    total_revenue: float
    steps: int
    initial_inventory: int
    final_inventory: int
    terminated: bool
    truncated: bool
    average_price: float
    min_price: float
    max_price: float
    total_units_sold: int


class SimulateResponse(BaseModel):
    """Full result of one simulated episode."""

    policy: str
    seed: Optional[int]
    product: dict[str, Any]
    summary: EpisodeSummary
    steps: list[StepRecord]
