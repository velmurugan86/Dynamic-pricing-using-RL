# Fluxmart

A 5-product storefront where prices are set live by your DQN pricing model. 
Built using **React (Vite)**, **TailwindCSS**, and **Supabase** for auth + data. 
The UI is styled after the provided reference (white pill nav, bright green grid background, 
bold stacked headline, tilted polaroid-style product photography).

## 1. Install

```bash
npm install
```

## 2. Set up Supabase

1. Create a project at https://supabase.com.
2. Open the SQL editor and run, in order:
   - `supabase/schema.sql` — tables, RLS policies, and the `apply_price_update` function
   - `supabase/seed.sql` — the 5 demo products
3. In **Authentication → Providers**, email/password sign-up is enabled by
   default — that's all this app uses. (You can turn off "Confirm email" in
   **Authentication → Settings** while testing locally so sign-up logs
   straight in instead of waiting on a confirmation email.)
4. Copy `.env.example` to `.env` and fill in:
   - `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` from **Project Settings → API**
   - `VITE_DQN_PREDICT_URL` — your model's endpoint that accepts the pricing
     state and returns a new price
   - `VITE_DQN_FEEDBACK_URL` — optional, your model's second route for
     logging the applied price back (leave blank if you don't need it)

## 3. Run it

```bash
npm run dev
```

## How the pricing flow works

1. `src/api/pricingModel.js` — `getRepricingSuggestion(product)` POSTs to
   `VITE_DQN_PREDICT_URL` with:
   ```json
   {
     "product_id": "...",
     "product_price": 89.00,
     "remaining_inventory": 42,
     "seasonality": 1.1,
     "historical_demand": 120,
     "current_demand": 145,
     "price_elasticity": -1.35,
     "demand_velocity": 0.18
   }
   ```
   and expects back something with a `new_price` (or `price` / `action`)
   field. **Adjust the field names in `pricingModel.js` to match your
   model's actual contract.**

2. The app calls the `apply_price_update(product_id, new_price, source)`
   Postgres function (via `supabase.rpc(...)`) rather than updating the
   `products` table directly. That function is `security definer`, so it:
   - updates `products.current_price`
   - writes a row to `price_history`
   - both in one transaction, so the two can never drift apart

   Clients have **no direct UPDATE grant** on `products` — this keeps a
   logged-in user from editing arbitrary columns (name, image, etc.) and
   confines writes to that one controlled path.

3. If `VITE_DQN_FEEDBACK_URL` is set, `confirmPriceApplied()` posts the
   before/after price to it — useful if your model logs transitions for
   further training.

4. Every raw request/response to the model is also logged client-side into
   `model_requests_log`, and every price change is visible on the
   **Pricing Log** page (`/pricing-log`, requires login).

5. The **Model Inputs** tab (`/model-inputs`, requires login) lets you edit
   the per-product parameters the model reads — inventory, seasonality,
   historical/current demand, price elasticity, and demand velocity. Saving
   calls the `apply_product_inputs` Postgres function, which updates those
   columns on `products` and appends a `demand_metrics` snapshot row in one
   transaction (mirroring how price changes go through `apply_price_update`).
   If you already ran an older `schema.sql`, re-run just that function's
   block (section 8) to add it.

## Project structure

```
src/
  api/pricingModel.js     — talks to the two DQN routes
  lib/supabaseClient.js   — Supabase client
  context/AuthContext.jsx — session state, sign up / log in / log out
  components/             — Navbar, Hero, ProductCard, ProductGrid, Footer, ProtectedRoute
  pages/                  — Landing, Shop, Login, Signup, PricingLog, About
supabase/
  schema.sql              — tables, RLS, apply_price_update(), apply_product_inputs()
  seed.sql                — 5 starter products
```

## Extending toward checkout

`orders` and `order_items` tables are included in `schema.sql` but not
wired into the UI — the brief was product listing + live pricing, not a
full cart/checkout. They're there so you can add a cart flow without
changing the schema later.

## Deploying

Any static host works (Vercel, Netlify, Cloudflare Pages) — `npm run
build` outputs to `dist/`. Set the same env vars in your host's dashboard.
