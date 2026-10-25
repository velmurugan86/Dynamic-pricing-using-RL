# Dynamic Pricing RL Engine & FastAPI Microservice

> **Component:** Core Reinforcement Learning Engine & Inference API  
> **Ecosystem:** [Dynamic Pricing RL Ecosystem](../README.md)  
> **Sibling Subsystems:** [Fluxmart Storefront](../fluxmart/README.md) · [Simulator Dashboard](frontend/README.md)

A Gymnasium-compatible reinforcement learning environment, custom **Dueling DQN** neural network agent, offline training/benchmarking pipeline, and production-grade **FastAPI microservice** for dynamic product pricing with real-time online continuous learning.

---

## 📑 Table of Contents

- [Component Role in Ecosystem](#component-role-in-ecosystem)
- [Key Features](#key-features)
- [Directory Structure](#directory-structure)
- [Reinforcement Learning Architecture](#reinforcement-learning-architecture)
  - [1. Gymnasium Environment (`DynamicPricingEnv`)](#1-gymnasium-environment-dynamicpricingenv)
  - [2. Dueling DQN Architecture (`dqn.py`)](#2-dueling-dqn-architecture-dqnpy)
  - [3. Experience Replay & DQNAgent (`agent.py`)](#3-experience-replay--dqnagent-agentpy)
  - [4. Reward Function & Shaping](#4-reward-function--shaping)
- [Continuous Online Learning Loop](#continuous-online-learning-loop)
- [Training & Policy Evaluation](#training--policy-evaluation)
- [FastAPI Service & Endpoints](#fastapi-service--endpoints)
- [Configuration (`configs/default.yaml`)](#configuration-configsdefaultyaml)
- [Setup & Execution](#setup--execution)
- [Testing & Quality Assurance](#testing--quality-assurance)

---

## Component Role in Ecosystem

Within the dynamic pricing architecture, `dynamic-pricing-RL` serves as the intelligence core:
- **For Researchers & Developers:** It provides an interactive simulation environment and benchmarking suite comparing the DQN agent against Random, Fixed-Price, and Oracle policies.
- **For Fluxmart E-Commerce:** It acts as an active pricing oracle. It receives live product demand metrics over HTTP, predicts optimal pricing changes, and continuously improves its policy through online experience replay when customer transactions occur.

---

## Key Features

- **Gymnasium-Compliant Simulation**: Implements `gym.Env` with clean observation spaces, discrete action spaces, and deterministic seeding for reproducible experiments.
- **Realistic Demand Modeling**: Integrates constant-elasticity price curves, sinusoidal seasonality cycles (30 timesteps), and Gaussian demand noise.
- **Dueling DQN with Layer Normalization**: Features separate state-value $V(s)$ and advantage $A(s, a)$ heads to stabilize training during small-batch online updates.
- **Continuous Online Learning**: The live agent stays resident in memory during serving. As purchases are completed in Fluxmart, checkout feedback is pushed directly into the replay buffer, triggering live gradient descent steps.
- **High-Performance FastAPI Server**: Exposes low-latency prediction, simulation, and telemetry endpoints with CORS enabled for client frontends.
- **Offline Training & Benchmarking Suite**: Automated scripts (`train.py`, `evaluate.py`, `plot_demand_price.py`) to pre-train policies, export evaluation logs, and visualize price-demand response curves.

---

## Directory Structure

```text
dynamic-pricing-RL/
├── README.md                           # ← This File
├── pyproject.toml                      # Dependencies & package configuration
├── uv.lock                             # Pinned uv lockfile
├── train.py                            # Offline DQN training script
├── evaluate.py                         # Multi-policy benchmark runner
├── plot_demand_price.py                # Demand-price state curve plotting tool
├── configs/
│   └── default.yaml                    # Product & environment hyperparameters
├── results/
│   ├── dqn_policy.csv                  # Exported policy action distributions
│   ├── training_log.csv                # Per-episode reward, loss, & epsilon log
│   └── models/
│       └── dqn.pt                      # Saved PyTorch model checkpoint
├── src/dynamic_pricing/
│   ├── models/
│   │   └── product.py                  # Product dataclass & constraint validation
│   ├── simulation/
│   │   └── demand.py                   # Constant elasticity & seasonality demand engine
│   ├── environment/
│   │   └── pricing_env.py              # DynamicPricingEnv(gym.Env) implementation
│   ├── agent/
│   │   ├── dqn.py                      # Dueling DQN network definition
│   │   ├── replay_buffer.py            # Cyclic experience replay memory
│   │   └── agent.py                    # DQNAgent training & inference logic
│   └── api/
│       ├── app.py                      # FastAPI application & route controllers
│       ├── schemas.py                  # Pydantic schema validation models
│       └── policies.py                 # Action selection policies (random, fixed, oracle)
├── tests/
│   ├── test_environment.py             # Gymnasium environment assertions
│   ├── test_demand.py                  # Demand curve & seasonality tests
│   └── test_api.py                     # FastAPI endpoint integration tests
└── frontend/                           # Sibling Dashboard (React 19 + TypeScript)
```

---

## Reinforcement Learning Architecture

### 1. Gymnasium Environment (`DynamicPricingEnv`)

- **Observation Space**: `Box(7,)`, `float32`, continuous:
  1. `current_price`: Current product selling price.
  2. `remaining_inventory`: Units currently remaining in stock.
  3. `historical_demand`: Moving average or baseline demand level.
  4. `current_demand`: Demand realized in the preceding step.
  5. `seasonality`: Current seasonal multiplier factor (sinusoidal).
  6. `price_elasticity`: Sensitivity of demand to price shifts ($\epsilon$).
  7. `demand_velocity`: Rate of change of demand over time.

- **Action Space**: `Discrete(5)`:
  | Action Index | Label | Price Multiplier | Description |
  |:---:|:---:|:---:|---|
  | `0` | `-10%` | `0.90` | Aggressive markdown |
  | `1` | `-5%` | `0.95` | Moderate markdown |
  | `2` | `Hold` | `1.00` | Maintain price |
  | `3` | `+5%` | `1.05` | Moderate markup |
  | `4` | `+10%` | `1.10` | Aggressive markup |

- **Demand Dynamics Formula**:
  $$\text{Demand} = \max\left(0, \text{base\_demand} \times \left(\frac{\text{price}}{\text{initial\_price}}\right)^{-\text{elasticity}} \times \text{seasonality} \times \text{noise}\right)$$
  - Clamped to integer units.
  - Price is bound within $[\text{minimum\_price}, \text{maximum\_price}]$.

### 2. Dueling DQN Architecture (`dqn.py`)

Standard DQN estimates $Q(s, a)$ directly. In dynamic pricing, certain market states are inherently high-value or low-value regardless of immediate price shifts. The Dueling architecture decomposes the representation:

- **Feature Extractor**:
  - `Linear(state_size, 256)` $\to$ `LayerNorm(256)` $\to$ `ReLU()`
  - `Linear(256, 256)` $\to$ `LayerNorm(256)` $\to$ `ReLU()`
- **Value Stream $V(s)$**:
  - `Linear(256, 128)` $\to$ `ReLU()` $\to$ `Linear(128, 1)`
- **Advantage Stream $A(s, a)$**:
  - `Linear(256, 128)` $\to$ `ReLU()` $\to$ `Linear(128, action_size)`
- **Aggregation**:
  $$Q(s, a) = V(s) + \left(A(s, a) - \frac{1}{|\mathcal{A}|} \sum_{a'} A(s, a')\right)$$

*Layer normalization is critical here to prevent exploding gradients when updating weights on single online transitions.*

### 3. Experience Replay & DQNAgent (`agent.py`)

- **Replay Buffer**: Holds up to 50,000 transitions `(s, a, r, s', done)`.
- **Target Network**: Periodically updated (every 100–250 steps) to prevent bootstrap divergence.
- **Exploration Policy**: $\epsilon$-greedy schedule with decay ($\epsilon_{\text{start}} = 1.0 \to \epsilon_{\text{min}} = 0.03 \text{ to } 0.05$).

### 4. Reward Function & Shaping

During training and online feedback, the agent optimizes economic profitability:

$$\text{Reward} = \frac{\text{Profit} + \text{Penalties}}{\text{initial\_price}}$$

Where:
- $\text{Revenue} = \text{price} \times \text{units\_sold}$
- $\text{Cost} = \text{unit\_cost} \times \text{units\_sold}$
- $\text{Holding Cost} = \text{holding\_cost\_per\_unit} \times \text{remaining\_inventory}$
- $\text{Profit} = \text{Revenue} - \text{Cost} - \text{Holding Cost}$
- $\text{Zero-Sale Penalty}$: Applied if $\text{units\_sold} = 0$ when inventory was available (penalizing uncompetitive overpricing).
- Scaled by `initial_price` for stable neural network gradients.

---

## Continuous Online Learning Loop

Unlike traditional static offline models, the live FastAPI service retains a singleton `DQNAgent` instance in memory.

1. **State Normalization**: When `/api/predict` or `/api/feedback` is called, state values are normalized using baseline product parameters.
2. **Exploration**: Live predictions use $\epsilon$-greedy action selection ($\epsilon \approx 0.05$) to explore promising price regimes.
3. **Transaction Feedback**: When an order executes on the storefront, `POST /api/feedback` delivers the actual purchase outcome.
4. **Online Training Step**: The transition is pushed to the buffer, a mini-batch is sampled, Huber/MSE loss is calculated, and an Adam optimizer step is executed.
5. **Auto-Checkpointing**: Every 50 online updates, model weights are saved automatically to `results/models/dqn.pt`.

---

## Training & Policy Evaluation

### Offline Pretraining (`train.py`)

Trains the agent for 1,000 episodes against the simulated demand environment:

```bash
uv run python train.py
```

Outputs:
- Checkpoint weights: `results/models/dqn.pt`
- Training metrics log: `results/training_log.csv`

### Policy Benchmarking (`evaluate.py`)

Evaluates and compares policies over 20 randomized seeds:
- **`dqn`**: Learned Dueling DQN policy.
- **`oracle`**: Lookahead agent evaluating 50 Monte Carlo demand simulations per candidate action.
- **`fixed`**: Static hold price policy.
- **`random`**: Uniform random price actions.

```bash
uv run python evaluate.py
```

Outputs summary statistics and saves the full action distribution to `results/dqn_policy.csv`.

### Demand Curve Plotting (`plot_demand_price.py`)

```bash
uv run python plot_demand_price.py
```

Renders plots of price elasticity and demand response curves across 500 state evaluations.

---

## FastAPI Service & Endpoints

Run the server:

```bash
uv run uvicorn dynamic_pricing.api.app:app --reload --port 8000
```

### Endpoints

#### 1. `GET /api/health`
Verifies service availability, model readiness, online steps completed, and total feedback received.

#### 2. `POST /api/predict`
Accepts a 7-feature product state and returns the selected action, updated price, price change percentage, and Q-values for all 5 actions.

```json
// Request
{
  "current_price": 1000.0,
  "remaining_inventory": 85,
  "historical_demand": 20.0,
  "current_demand": 18.0,
  "seasonality": 1.1,
  "price_elasticity": 1.5,
  "demand_velocity": 0.2
}
```

#### 3. `POST /api/feedback`
Ingests real transaction feedback to train the model online.

```json
// Request
{
  "product_id": "sku-001",
  "old_price": 1000.0,
  "new_price": 950.0,
  "units_sold": 2,
  "remaining_inventory": 83,
  "historical_demand": 20.0,
  "current_demand": 18.0,
  "seasonality": 1.1,
  "price_elasticity": 1.5,
  "demand_velocity": 0.2,
  "applied": true
}
```

#### 4. `GET /api/training-stats`
Returns live training metrics: buffer size, epsilon, last training loss, total feedback received, and checkpoint path.

#### 5. `GET /api/config`
Returns default product settings from `configs/default.yaml`, available policies, action labels, and live online learning status.

#### 6. `POST /api/simulate`
Executes an entire simulated episode (up to `max_steps`) using a specified policy (`random`, `fixed`, `oracle`) with optional parameter overrides, returning step-by-step logs and summary metrics.

---

## Configuration (`configs/default.yaml`)

```yaml
product:
  product_id: "sku-001"
  initial_price: 1000.0
  initial_inventory: 100
  minimum_price: 500.0
  maximum_price: 2000.0
  base_demand: 20.0
  price_elasticity: 1.5
  seasonality_strength: 0.2
  demand_noise: 0.1
  unit_cost: 600.0
  holding_cost: 2.0

environment:
  max_steps: 100
  seasonality_period: 30
  seed: 42
```

---

## Setup & Execution

### 1. Requirements
- Python ≥ 3.10
- [uv package manager](https://docs.astral.sh/uv/)

### 2. Installation
```bash
cd dynamic-pricing-RL
uv sync
```

### 3. Launching
```bash
uv run uvicorn dynamic_pricing.api.app:app --reload --port 8000
```

---

## Testing & Quality Assurance

Run the automated test suite covering the simulation environment, demand math, and FastAPI endpoints:

```bash
uv run pytest
```
