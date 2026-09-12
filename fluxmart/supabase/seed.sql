-- =========================================================
-- FLUXMART — seed data
-- Run after schema.sql. Inserts the 5 demo products.
-- =========================================================

insert into public.products
  (name, description, image_url, category, base_price, current_price,
   inventory_count, seasonality_factor, historical_demand, current_demand,
   price_elasticity, demand_velocity)
values
  ('Aero Runner Sneaker', 'Lightweight knit trainer, everyday cushioning.',
   'https://picsum.photos/seed/product-1/600/600', 'Footwear',
   7499.00, 7499.00, 42, 1.10, 120, 145, -1.35, 0.18),

  ('Nomad Canvas Backpack', '22L pack, water-resistant canvas, laptop sleeve.',
   'https://picsum.photos/seed/product-2/600/600', 'Bags',
   2199.00, 2199.00, 18, 0.95, 60, 52, -0.80, -0.05),

  ('Halo Wireless Earbuds', 'Active noise cancelling, 30hr case battery.',
   'https://picsum.photos/seed/product-3/600/600', 'Electronics',
   6999.00, 6999.00, 7, 1.30, 200, 260, -1.90, 0.32),

  ('Drift Ceramic Mug Set', 'Set of 2, hand-glazed stoneware, 12oz.',
   'https://picsum.photos/seed/product-4/600/600', 'Home',
   799.00, 799.00, 65, 1.00, 40, 38, -0.55, 0.02),

  ('Summit Rain Shell', 'Packable 2.5-layer waterproof jacket.',
   'https://picsum.photos/seed/product-5/600/600', 'Apparel',
   4499.00, 4499.00, 3, 1.45, 30, 55, -1.10, 0.41);
