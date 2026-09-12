-- FLUXMART — update all product prices to 900–1500 range

update public.products set
  base_price    = 1299.00,
  current_price = 1249.00,
  updated_at    = now()
where name = 'Aero Runner Sneaker';

update public.products set
  base_price    = 999.00,
  current_price = 1049.00,
  updated_at    = now()
where name = 'Nomad Canvas Backpack';

update public.products set
  base_price    = 1499.00,
  current_price = 1399.00,
  updated_at    = now()
where name = 'Halo Wireless Earbuds';

update public.products set
  base_price    = 949.00,
  current_price = 999.00,
  updated_at    = now()
where name = 'Drift Ceramic Mug Set';

update public.products set
  base_price    = 1199.00,
  current_price = 1149.00,
  updated_at    = now()
where name = 'Summit Rain Shell';
