# Dynamic Pricing Simulator Dashboard

> **Component:** Interactive Simulation & Policy Visualizer Dashboard  
> **Ecosystem:** [Dynamic Pricing RL Ecosystem](../../README.md)  
> **Parent Engine:** [dynamic-pricing-RL Backend](../README.md)  
> **Storefront Counterpart:** [Fluxmart Storefront](../../fluxmart/README.md)

An interactive, high-performance web dashboard built with **React 19**, **TypeScript**, **Vite**, and **Recharts**. It provides machine learning researchers, data scientists, and operators with a rich visual workbench to simulate pricing episodes, adjust market dynamics, and analyze policy behaviors in real-time.

---

## 📑 Table of Contents

- [Component Role in Ecosystem](#component-role-in-ecosystem)
- [Key Features](#key-features)
- [Architecture & Tech Stack](#architecture--tech-stack)
- [Directory Structure](#directory-structure)
- [Interactive Features & Views](#interactive-features--views)
  - [1. Parameter Control Panel](#1-parameter-control-panel)
  - [2. Summary KPI Cards](#2-summary-kpi-cards)
  - [3. Price & Demand Dynamics Chart](#3-price--demand-dynamics-chart)
  - [4. Revenue & Inventory Trajectory Charts](#4-revenue--inventory-trajectory-charts)
  - [5. Step-by-Step Episode Telemetry Table](#5-step-by-step-episode-telemetry-table)
- [Backend Integration & Proxy](#backend-integration--proxy)
- [Getting Started](#getting-started)
- [Available Scripts](#available-scripts)

---

## Component Role in Ecosystem

While **Fluxmart** is the customer-facing storefront where pricing models run live in production, the **Simulator Dashboard** serves as the **offline sandbox**:
- Allows testing new demand curves and elasticity regimes before deploying them to production.
- Visualizes how action policies (`random`, `greedy`, `oracle`) respond to seasonal fluctuations and inventory pressure.
- Provides immediate visual validation of episode termination, inventory sell-through rate, and margin performance.

---

## Key Features

- **No-Code Parameter Tuning**: Interactively edit product attributes (initial price, price floor/ceiling, initial inventory, base demand, price elasticity, seasonality strength, and demand noise) directly from the browser without modifying configuration files.
- **Policy Comparison**: Switch between different action selection strategies, adjust greedy profit margins, set deterministic RNG seeds for exact run reproduction, and define episode horizons (`max_steps`).
- **Real-Time Visualizations**:
  - Dual-axis Price vs. Demand timeline with reference boundaries for price limits.
  - Per-step revenue and cumulative revenue area charts.
  - Step-by-step inventory depletion curves.
- **Detailed Telemetry Table**: Fully expandable per-timestep logs showing exact action taken (`-10%`, `-5%`, `Hold`, `+5%`, `+10%`), realized demand, units sold, step revenue, and remaining stock.
- **Zero-CORS Dev Workflow**: Vite's built-in dev proxy routes all `/api/*` network requests directly to the FastAPI server running on port 8000.

---

## Architecture & Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **UI Framework** | React 19 (`^19.2.8`) | State management, component tree, and hooks |
| **Language** | TypeScript (`~6.0.2`) | Strict typing for API schemas and component props |
| **Bundler & Dev Server** | Vite (`^8.3.0`) | Instant HMR, asset compilation, and API proxying |
| **Data Visualization** | Recharts (`^3.10.1`) | Responsive SVG charts (lines, areas, reference lines, tooltips) |
| **Linting** | Oxlint (`^1.81.0`) | High-performance linting and code quality checks |

---

## Directory Structure

```text
dynamic-pricing-RL/frontend/
├── README.md                           # ← This File
├── index.html                          # Single-page application entry HTML
├── package.json                        # Dependencies, scripts, and metadata
├── vite.config.ts                      # Vite configuration with /api reverse proxy
├── tsconfig.json                       # Root TypeScript project references
├── tsconfig.app.json                   # Client-side TypeScript configuration
├── tsconfig.node.json                  # Node environment TypeScript configuration
├── .oxlintrc.json                      # Oxlint linter rules
├── public/                             # Static assets (favicons, SVG icons)
└── src/
    ├── main.tsx                        # React application bootstrap
    ├── App.tsx                         # Main container orchestrating simulation state
    ├── App.css                         # App-wide layout, glassmorphic themes, and grid styles
    ├── index.css                       # Base typography and CSS resets
    ├── api.ts                          # Fetch client for FastAPI (/api/config, /api/simulate)
    ├── types.ts                        # TypeScript interfaces matching backend Pydantic models
    └── components/
        ├── ControlPanel.tsx            # Form controls for product & episode parameters
        ├── SummaryCards.tsx            # KPI metric cards (revenue, average price, sell-through)
        ├── PriceDemandChart.tsx        # Dual-axis price & demand trajectory visualization
        ├── RevenueChart.tsx            # Step & cumulative revenue area charts
        ├── InventoryChart.tsx          # Inventory depletion curve chart
        └── EpisodeTable.tsx            # Granular step-by-step episode telemetry table
```

---

## Interactive Features & Views

### 1. Parameter Control Panel
Located on the left sidebar, this panel lets users override product settings fetched from `/api/config`:
- **Pricing Bounds**: Set `Initial Price`, `Minimum Price` (floor), and `Maximum Price` (ceiling).
- **Demand Dynamics**: Adjust `Base Demand`, `Price Elasticity` ($\epsilon$), `Seasonality Strength`, and Gaussian `Demand Noise`.
- **Episode Settings**: Configure `Initial Inventory`, `Max Steps`, `Policy` (`random`, `greedy`), `Greedy Margin`, and `Random Seed`.
- **Reset to Defaults**: Quickly revert back to values specified in `configs/default.yaml`.

### 2. Summary KPI Cards
Appears immediately after running an episode to summarize performance at a glance:
- **Total Revenue**: Total earnings realized across all completed timesteps.
- **Units Sold & Sell-Through**: Total units sold compared against initial inventory with percentage completion.
- **Average Price**: Mean realized price per unit sold.
- **Episode Duration**: Steps executed before termination (`Sold Out` vs. `Time Limit Reached`).

### 3. Price & Demand Dynamics Chart
Visualizes the relationship between the policy's pricing choices and the environment's realized demand:
- **Green Solid Line**: Product price over time.
- **Red Dashed Lines**: Price floor and ceiling boundaries.
- **Blue Line**: Observed customer demand at each step.

### 4. Revenue & Inventory Trajectory Charts
- **Revenue**: Tracks both discrete per-step revenue spikes and cumulative gross revenue growth.
- **Inventory**: Plots remaining stock units decreasing toward zero over the episode horizon.

### 5. Step-by-Step Episode Telemetry Table
A structured data table listing every timestep with:
- Step number
- Action taken (`-10%`, `-5%`, `Hold`, `+5%`, `+10%`)
- Applied unit price
- Realized demand vs. units sold
- Step revenue and cumulative total
- Remaining stock count

---

## Backend Integration & Proxy

The dashboard expects the FastAPI backend from [dynamic-pricing-RL](../README.md) to be running on `http://127.0.0.1:8000`.

In `vite.config.ts`, requests to `/api/*` are transparently proxied:

```typescript
server: {
  proxy: {
    '/api': {
      target: 'http://127.0.0.1:8000',
      changeOrigin: true,
    },
  },
}
```

This eliminates CORS issues during local development and enables clean, relative API calls in `src/api.ts`.

---

## Getting Started

### Prerequisites
- Node.js ≥ 18.0.0
- Running [dynamic-pricing-RL backend](../README.md) (`uv run uvicorn ...` on port 8000)

### 1. Install Dependencies
```bash
cd dynamic-pricing-RL/frontend
npm install
```

### 2. Start Development Server
```bash
npm run dev
```

The application will start at [http://localhost:5173](http://localhost:5173).

---

## Available Scripts

| Command | Action |
|---------|--------|
| `npm run dev` | Starts the Vite development server with HMR on port 5173 |
| `npm run build` | Compiles TypeScript and builds production bundles into `dist/` |
| `npm run lint` | Runs Oxlint across the TypeScript codebase |
| `npm run preview` | Locally serves the production build in `dist/` |
