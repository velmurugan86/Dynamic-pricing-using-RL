# Dynamic Pricing Simulator

A Gymnasium-based simulation environment for dynamic product pricing, with a
FastAPI backend and a React dashboard for visualizing pricing episodes. The
simulator is RL-ready: it speaks the standard `gym.Env` interface, so an agent
(PPO / DQN / SAC) can be plugged in later. The web UI ships with two built-in
rule-based policies (random and greedy) to explore the environment today.

## What's inside

### Simulation core (`src/dynamic_pricing/`)

| Module | What it does |
|--------|--------------|
| `models/product.py` | `Product` dataclass: price bounds, inventory, base demand, elasticity, seasonality strength, demand noise. Validates itself on creation (rejects negative inventory, out-of-bounds prices, etc.). |
| `simulation/demand.py` | Pure-math demand model, no ML. `demand = base_demand × price_effect × seasonality × noise`, clipped at 0. `price_effect` is a constant-elasticity curve `(price / initial_price) ** -elasticity`; `seasonality` is a sine wave over a 30-step cycle. |
| `environment/pricing_env.py` | `DynamicPricingEnv(gym.Env)`, the RL-ready environment. |
| `api/app.py` | FastAPI app exposing the simulator over HTTP. |
| `api/schemas.py` | Pydantic request/response schemas. |
| `api/policies.py` | Action-selection policies (`random`, `greedy`). An RL agent registers here. |

### Environment interface

**Observation** — `Box`, shape `(7,)`, float32:

```
[current_price, remaining_inventory, historical_demand,
 current_demand, seasonality, price_elasticity, demand_velocity]
```

**Action** — `Discrete(5)`:

| Action | Effect |
|--------|--------|
| 0 | decrease price 10% |
| 1 | decrease price 5% |
| 2 | hold price |
| 3 | increase price 5% |
| 4 | increase price 10% |

**Reward** — `revenue = price × units_sold` (no shaping).

**Episode end** — `terminated=True` when inventory sells out; `truncated=True`
when `max_steps` is reached. Price is always clamped to
`[minimum_price, maximum_price]`, inventory and demand never go negative, and
everything is seedable for reproducible runs. Both the demand-noise RNG and the
action-space RNG are seeded, so the same seed reproduces an episode exactly.

### Web dashboard (`frontend/`)

React 19 + Vite + TypeScript + Recharts. From the dashboard you can:

- Edit all product parameters (initial price, inventory, price bounds, base
  demand, elasticity, seasonality, noise) without touching YAML
- Pick a policy (`random` / `greedy`), set the greedy margin, seed, and
  episode length
- Run an episode and see: summary cards (total revenue, units sold /
  sell-through, average price, steps, sold-out vs time-up), a price + demand
  chart with price floor/cap reference lines, per-step and cumulative revenue,
  inventory remaining, and a full step-by-step episode log

## Project structure

```text
dynamic-pricing/
├── README.md
├── pyproject.toml
├── uv.lock
├── .gitignore
├── configs/
│   └── default.yaml
├── src/dynamic_pricing/
│   ├── __init__.py
│   ├── environment/pricing_env.py
│   ├── simulation/demand.py
│   ├── models/product.py
│   └── api/
│       ├── __init__.py
│       ├── app.py
│       ├── schemas.py
│       └── policies.py
├── examples/
│   └── random_agent.py
├── tests/
│   ├── test_environment.py
│   ├── test_demand.py
│   └── test_api.py
└── frontend/
    ├── index.html
    ├── package.json
    ├── vite.config.ts
    └── src/
        ├── main.tsx
        ├── App.tsx
        ├── api.ts
        ├── types.ts
        └── components/
            ├── ControlPanel.tsx
            ├── SummaryCards.tsx
            ├── PriceDemandChart.tsx
            ├── RevenueChart.tsx
            ├── InventoryChart.tsx
            └── EpisodeTable.tsx
```

## Setup

Requirements: [uv](https://docs.astral.sh/uv/) (Python) and Node.js ≥ 18
(frontend).

```bash
uv sync
```

This creates `.venv/` and installs the Python environment from
`pyproject.toml`, pinned by `uv.lock`, reproducibly on any machine with `uv`.

Frontend dependencies:

```bash
cd frontend
npm install
```

## Running

### 1. Start the backend (port 8000)

From the project root:

```bash
uv run uvicorn dynamic_pricing.api.app:app --reload --port 8000
```

- API health check: http://127.0.0.1:8000/api/health
- Interactive API docs (Swagger): http://127.0.0.1:8000/docs

### 2. Start the frontend (port 5173)

```bash
cd frontend
npm run dev
```

Open http://localhost:5173. The Vite dev server proxies `/api/*` requests to
the backend at `http://127.0.0.1:8000`, so no CORS setup is needed for local
development.

### 3. Terminal-only alternative

Run one episode with random actions straight from the CLI:

```bash
uv run python examples/random_agent.py
```

## API reference

### `GET /api/health`

Returns `{"status": "ok"}`.

### `GET /api/config`

Returns the default product and environment configuration from
`configs/default.yaml`, plus available policies and action labels.

### `POST /api/simulate`

Runs one episode and returns every step plus a summary.

Request body (all fields optional except `policy` defaults to `"random"`):

```json
{
  "product": { "base_demand": 25.0, "initial_inventory": 200 },
  "max_steps": 100,
  "seasonality_period": 30,
  "seed": 42,
  "policy": "greedy",
  "greedy_margin": 0.10
}
```

- `product` is a **partial override**: any field you omit falls back to
  `configs/default.yaml`
- `seed: null` or omitted gives a different random episode each run; a fixed
  seed reproduces the exact same episode
- `policy` is `"random"` or `"greedy"`; `greedy_margin` bounds how far above
  the initial price the greedy policy is willing to push

Response contains `summary` (total revenue, steps, units sold, price stats,
terminated/truncated flags), `steps` (one record per timestep: action, price,
demand, units sold, inventory, revenue, cumulative revenue), and the resolved
`product`.

Validation errors (unknown policy, invalid product values) return HTTP 422.

## Configuration

`configs/default.yaml` is the single place to change defaults:

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

environment:
  max_steps: 100
  seasonality_period: 30
  seed: 42
```

Both the CLI example and the API load defaults from here; the dashboard lets
you override them per-run without editing the file.

## Testing

Run all tests (simulator + API):

```bash
uv run pytest
```

Frontend type check:

```bash
cd frontend
npx tsc --noEmit
```

## Not built yet

- RL agent (PPO / DQN / SAC) trained against the environment — the
  `policies.py` registry is the plug-in point
- Learned demand model
- Reward shaping beyond raw revenue (e.g. holding costs, stockout penalties)
