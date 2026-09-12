-- =========================================================
-- FLUXMART — one-time INR price migration
-- Converts the demo prices from USD to realistic INR levels.
-- Run once in the Supabase SQL editor.
-- =========================================================

update public.products
set base_price = 7499.00, current_price = 7499.00, updated_at = now()
where name = 'Aero Runner Sneaker';

update public.products
set base_price = 2199.00, current_price = 2199.00, updated_at = now()
where name = 'Nomad Canvas Backpack';

update public.products
set base_price = 6999.00, current_price = 6999.00, updated_at = now()
where name = 'Halo Wireless Earbuds';

update public.products
set base_price = 799.00, current_price = 799.00, updated_at = now()
where name = 'Drift Ceramic Mug Set';

update public.products
set base_price = 4499.00, current_price = 4499.00, updated_at = now()
where name = 'Summit Rain Shell';
