-- =========================================================
-- FLUXMART — Inventory Management RPCs
-- Run this in the Supabase SQL editor after the main schema.
-- Provides two security-definer functions:
--   * override_inventory()  — set inventory to an exact value
--   * add_inventory()       — add N units to existing inventory
-- Both enforce non-negative constraints and require authentication.
-- =========================================================


-- ---------------------------------------------------------
-- 1. override_inventory()
--    Set a product s inventory_count to a specific value,
--    completely replacing the current figure.
--    Records the change in demand_metrics for audit/training.
-- ---------------------------------------------------------
create or replace function public.override_inventory(
  p_product_id    uuid,
  p_new_inventory integer
)
returns public.products
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.products;
begin
  if p_product_id is null then
    raise exception ''p_product_id is required'';
  end if;
  if p_new_inventory is null or p_new_inventory < 0 then
    raise exception ''p_new_inventory must be a non-negative integer'';
  end if;

  update public.products
  set inventory_count = p_new_inventory,
      updated_at      = now()
  where id = p_product_id
  returning * into v_row;

  if not found then
    raise exception ''product % not found'', p_product_id;
  end if;

  insert into public.demand_metrics (
    product_id, inventory_count,
    historical_demand, current_demand,
    demand_velocity, price_elasticity, seasonality_factor
  )
  select
    p_product_id,
    p_new_inventory,
    v_row.historical_demand,
    v_row.current_demand,
    v_row.demand_velocity,
    v_row.price_elasticity,
    v_row.seasonality_factor;

  return v_row;
end;
$$;

revoke all on function public.override_inventory(uuid, integer) from public;
grant execute on function public.override_inventory(uuid, integer) to authenticated;


-- ---------------------------------------------------------
-- 2. add_inventory()
--    Increment a product s inventory_count by p_units_added.
--    Useful for recording a new stock shipment.
--    Records the change in demand_metrics for audit/training.
-- ---------------------------------------------------------
create or replace function public.add_inventory(
  p_product_id  uuid,
  p_units_added integer
)
returns public.products
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.products;
begin
  if p_product_id is null then
    raise exception ''p_product_id is required'';
  end if;
  if p_units_added is null or p_units_added <= 0 then
    raise exception ''p_units_added must be a positive integer'';
  end if;

  update public.products
  set inventory_count = inventory_count + p_units_added,
      updated_at      = now()
  where id = p_product_id
  returning * into v_row;

  if not found then
    raise exception ''product % not found'', p_product_id;
  end if;

  insert into public.demand_metrics (
    product_id, inventory_count,
    historical_demand, current_demand,
    demand_velocity, price_elasticity, seasonality_factor
  )
  select
    p_product_id,
    v_row.inventory_count,
    v_row.historical_demand,
    v_row.current_demand,
    v_row.demand_velocity,
    v_row.price_elasticity,
    v_row.seasonality_factor;

  return v_row;
end;
$$;

revoke all on function public.add_inventory(uuid, integer) from public;
grant execute on function public.add_inventory(uuid, integer) to authenticated;
