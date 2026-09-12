-- =========================================================
-- FLUXMART — Supabase schema
-- Run this once in the Supabase SQL editor (or via the CLI)
-- on a fresh project. Safe to re-run: guarded with IF NOT EXISTS
-- / DROP ... IF EXISTS where it matters.
-- =========================================================

create extension if not exists "pgcrypto";  -- gen_random_uuid()

-- ---------------------------------------------------------
-- 1. profiles
--    One row per auth user. Populated automatically by the
--    trigger below whenever someone signs up.
-- ---------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text,
  email       text,
  created_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles are viewable by owner" on public.profiles;
create policy "profiles are viewable by owner"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "profiles are updatable by owner" on public.profiles;
create policy "profiles are updatable by owner"
  on public.profiles for update
  using (auth.uid() = id);

-- auto-create a profile row whenever a new auth user is created
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, new.raw_user_meta_data ->> 'full_name', new.email);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ---------------------------------------------------------
-- 2. products
--    The 5 (or more) items in the store, plus every field the
--    DQN model needs as input for repricing.
-- ---------------------------------------------------------
create table if not exists public.products (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  description         text,
  image_url           text,
  category            text,

  base_price          numeric(10,2) not null check (base_price >= 0),
  current_price       numeric(10,2) not null check (current_price >= 0),

  -- model inputs -------------------------------------------------
  inventory_count     integer not null default 0 check (inventory_count >= 0),
  seasonality_factor  numeric(6,3)  not null default 1.0,   -- e.g. 0.8 (off-season) .. 1.5 (peak)
  historical_demand   numeric(10,2) not null default 0,     -- avg units/period, trailing
  current_demand      numeric(10,2) not null default 0,     -- units in the current period
  price_elasticity    numeric(6,3)  not null default 0,     -- % demand change per % price change
  demand_velocity     numeric(10,3) not null default 0,     -- rate of change of demand

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table public.products enable row level security;

-- anyone (including logged-out visitors) can browse the shop
drop policy if exists "products are publicly readable" on public.products;
create policy "products are publicly readable"
  on public.products for select
  using (true);

-- NOTE: there is intentionally no INSERT/UPDATE/DELETE policy for
-- normal users here. Price changes must go through apply_price_update()
-- below, so a client can never overwrite arbitrary columns (name,
-- image_url, etc.) directly. Manage inventory/catalog edits from the
-- Supabase dashboard or with the service_role key from a trusted backend.


-- ---------------------------------------------------------
-- 3. price_history
--    Every price change, who/what triggered it, and when.
-- ---------------------------------------------------------
create table if not exists public.price_history (
  id           uuid primary key default gen_random_uuid(),
  product_id   uuid not null references public.products (id) on delete cascade,
  old_price    numeric(10,2) not null,
  new_price    numeric(10,2) not null,
  source       text not null default 'dqn_model',  -- 'dqn_model' | 'manual'
  changed_by   uuid references auth.users (id),
  changed_at   timestamptz not null default now()
);

alter table public.price_history enable row level security;

drop policy if exists "price history readable by authenticated users" on public.price_history;
create policy "price history readable by authenticated users"
  on public.price_history for select
  to authenticated
  using (true);

-- no direct insert policy: rows are only ever written by
-- apply_price_update() (security definer), never by the client.


-- ---------------------------------------------------------
-- 4. demand_metrics
--    Optional point-in-time snapshots of the signals sent to the
--    model — useful for retraining/auditing the DQN later.
-- ---------------------------------------------------------
create table if not exists public.demand_metrics (
  id                  uuid primary key default gen_random_uuid(),
  product_id          uuid not null references public.products (id) on delete cascade,
  historical_demand   numeric(10,2),
  current_demand      numeric(10,2),
  demand_velocity     numeric(10,3),
  price_elasticity    numeric(6,3),
  seasonality_factor  numeric(6,3),
  inventory_count     integer,
  recorded_at         timestamptz not null default now()
);

alter table public.demand_metrics enable row level security;

drop policy if exists "demand metrics readable by authenticated users" on public.demand_metrics;
create policy "demand metrics readable by authenticated users"
  on public.demand_metrics for select
  to authenticated
  using (true);

drop policy if exists "demand metrics insertable by authenticated users" on public.demand_metrics;
create policy "demand metrics insertable by authenticated users"
  on public.demand_metrics for insert
  to authenticated
  with check (true);


-- ---------------------------------------------------------
-- 5. model_requests_log
--    Raw request/response payloads to and from the DQN model's
--    two routes (predict + feedback), for debugging/audit.
-- ---------------------------------------------------------
create table if not exists public.model_requests_log (
  id                uuid primary key default gen_random_uuid(),
  product_id        uuid references public.products (id) on delete set null,
  route             text not null default 'predict',  -- 'predict' | 'feedback'
  request_payload   jsonb,
  response_payload  jsonb,
  created_at        timestamptz not null default now()
);

alter table public.model_requests_log enable row level security;

drop policy if exists "model log readable by authenticated users" on public.model_requests_log;
create policy "model log readable by authenticated users"
  on public.model_requests_log for select
  to authenticated
  using (true);

drop policy if exists "model log insertable by authenticated users" on public.model_requests_log;
create policy "model log insertable by authenticated users"
  on public.model_requests_log for insert
  to authenticated
  with check (true);


-- ---------------------------------------------------------
-- 6. orders / order_items
--    Optional — not wired into the demo UI, included so the
--    schema is a complete ecommerce foundation you can extend
--    into an actual checkout flow later.
-- ---------------------------------------------------------
create table if not exists public.orders (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  status       text not null default 'pending',  -- 'pending' | 'paid' | 'cancelled' | 'fulfilled'
  total_amount numeric(10,2) not null default 0,
  created_at   timestamptz not null default now()
);

create table if not exists public.order_items (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references public.orders (id) on delete cascade,
  product_id   uuid not null references public.products (id),
  quantity     integer not null check (quantity > 0),
  unit_price   numeric(10,2) not null  -- price at time of purchase
);

alter table public.orders enable row level security;
alter table public.order_items enable row level security;

drop policy if exists "orders are owned by the buyer" on public.orders;
create policy "orders are owned by the buyer"
  on public.orders for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "order items follow their order" on public.order_items;
create policy "order items follow their order"
  on public.order_items for all
  to authenticated
  using (exists (
    select 1 from public.orders o
    where o.id = order_items.order_id and o.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.orders o
    where o.id = order_items.order_id and o.user_id = auth.uid()
  ));


-- ---------------------------------------------------------
-- 7. apply_price_update()
--    The ONLY way a price may change. Runs as security definer
--    so authenticated users can call it (via RPC) without having
--    direct UPDATE rights on products, and it keeps the price
--    change + history row consistent in one transaction.
-- ---------------------------------------------------------
create or replace function public.apply_price_update(
  p_product_id uuid,
  p_new_price  numeric,
  p_source     text default 'dqn_model'
)
returns public.products
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_price numeric;
  v_row       public.products;
begin
  if p_new_price is null or p_new_price < 0 then
    raise exception 'p_new_price must be a non-negative number';
  end if;

  select current_price into v_old_price
  from public.products
  where id = p_product_id
  for update;

  if not found then
    raise exception 'product % not found', p_product_id;
  end if;

  update public.products
  set current_price = p_new_price,
      updated_at = now()
  where id = p_product_id
  returning * into v_row;

  insert into public.price_history (product_id, old_price, new_price, source, changed_by)
  values (p_product_id, v_old_price, p_new_price, coalesce(p_source, 'dqn_model'), auth.uid());

  return v_row;
end;
$$;

-- only logged-in users may call this RPC
revoke all on function public.apply_price_update(uuid, numeric, text) from public;
grant execute on function public.apply_price_update(uuid, numeric, text) to authenticated;


-- ---------------------------------------------------------
-- 8. helpful indexes
-- ---------------------------------------------------------
create index if not exists idx_price_history_product on public.price_history (product_id, changed_at desc);
create index if not exists idx_demand_metrics_product on public.demand_metrics (product_id, recorded_at desc);
create index if not exists idx_model_log_product on public.model_requests_log (product_id, created_at desc);
create index if not exists idx_order_items_order on public.order_items (order_id);
