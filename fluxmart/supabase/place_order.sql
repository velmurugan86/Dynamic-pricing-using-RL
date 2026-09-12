-- =========================================================
-- FLUXMART — demo checkout
-- Creates an order + order_items in one atomic call and
-- decrements inventory. Refuses the order (and rolls the
-- whole thing back) if any quantity exceeds available stock.
-- No payment processing: this is a demonstration storefront.
-- Run once in the Supabase SQL editor.
-- =========================================================

create or replace function public.place_order(
  p_items jsonb  -- e.g. '[{"product_id":"...","quantity":2,"unit_price":7499.00}]'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id  uuid := auth.uid();
  v_order_id uuid;
  v_item     jsonb;
  v_stock    integer;
  v_qty      integer;
begin
  if v_user_id is null then
    raise exception 'must be logged in to place an order';
  end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'p_items must be a non-empty array';
  end if;

  -- Validate every line against live stock BEFORE creating anything.
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item ->> 'quantity')::integer;
    if v_qty is null or v_qty <= 0 then
      raise exception 'invalid quantity for product %', v_item ->> 'product_id';
    end if;

    select inventory_count into v_stock
    from public.products
    where id = (v_item ->> 'product_id')::uuid
    for update;

    if not found then
      raise exception 'product % not found', v_item ->> 'product_id';
    end if;
    if v_stock < v_qty then
      raise exception 'insufficient stock for product %: requested %, available %',
        v_item ->> 'product_id', v_qty, v_stock;
    end if;
  end loop;

  -- All lines validated — create the order.
  insert into public.orders (user_id, status, total_amount)
  values (v_user_id, 'paid', 0)
  returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    insert into public.order_items (order_id, product_id, quantity, unit_price)
    values (
      v_order_id,
      (v_item ->> 'product_id')::uuid,
      (v_item ->> 'quantity')::integer,
      (v_item ->> 'unit_price')::numeric(10,2)
    );

    update public.orders
    set total_amount = total_amount + (v_item ->> 'quantity')::integer
                      * (v_item ->> 'unit_price')::numeric(10,2)
    where id = v_order_id;

    update public.products
    set inventory_count = inventory_count - (v_item ->> 'quantity')::integer,
        updated_at = now()
    where id = (v_item ->> 'product_id')::uuid;
  end loop;

  return v_order_id;
end;
$$;

revoke all on function public.place_order(jsonb) from public;
grant execute on function public.place_order(jsonb) to authenticated;
