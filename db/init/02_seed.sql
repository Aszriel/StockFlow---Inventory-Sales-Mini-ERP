-- Seed data for StockFlow Mini ERP

-- 1. Insert Products (14 realistic items: mix of healthy stock, low stock <= 10, and inactive)
INSERT INTO products (id, sku, name, price, stock, is_active, created_at) VALUES
(1, 'ELEC-KB-001', 'Keychron K2 Mechanical Keyboard', 1250000, 25, true, NOW() - INTERVAL '14 days'),
(2, 'ELEC-MS-002', 'Logitech MX Master 3S Wireless Mouse', 1450000, 8, true, NOW() - INTERVAL '12 days'),     -- Low stock (<= 10)
(3, 'ELEC-MN-003', 'Dell UltraSharp 27" 4K Monitor', 6800000, 4, true, NOW() - INTERVAL '10 days'),       -- Low stock (<= 10)
(4, 'ELEC-HP-004', 'Sony WH-1000XM5 Wireless Headphones', 4200000, 15, true, NOW() - INTERVAL '9 days'),
(5, 'ELEC-CB-005', 'Anker USB-C to USB-C Cable 100W 2m', 135000, 120, true, NOW() - INTERVAL '8 days'),
(6, 'FURN-DK-006', 'Ergonomic Standing Desk 140x70', 3600000, 6, true, NOW() - INTERVAL '7 days'),        -- Low stock (<= 10)
(7, 'FURN-CH-007', 'Sihoo Ergonomic Office Chair V1', 2850000, 12, true, NOW() - INTERVAL '6 days'),
(8, 'STAT-NB-008', 'Moleskine Classic Hardcover Notebook', 240000, 65, true, NOW() - INTERVAL '5 days'),
(9, 'STAT-PN-009', 'Lamy Safari Fountain Pen Charcoal', 380000, 40, true, NOW() - INTERVAL '5 days'),
(10, 'ACC-LP-010', 'Nulaxy Aluminum Laptop Stand', 290000, 3, true, NOW() - INTERVAL '4 days'),            -- Low stock (<= 10)
(11, 'ACC-MP-011', 'Felt Desk Mat Mouse Pad 90x40cm', 115000, 85, true, NOW() - INTERVAL '4 days'),
(12, 'ELEC-HB-012', 'Baseus 8-in-1 USB-C Hub Adapter', 490000, 30, true, NOW() - INTERVAL '3 days'),
(13, 'LEG-KB-013', 'Vintage IBM Model M (Legacy Refurbished)', 1950000, 0, false, NOW() - INTERVAL '20 days'), -- Inactive & 0 stock
(14, 'DISC-HP-014', 'Audio-Technica ATH-M50x (Discontinued Edition)', 2100000, 5, false, NOW() - INTERVAL '15 days'); -- Inactive & low stock

SELECT setval('products_id_seq', (SELECT MAX(id) FROM products));

-- 2. Initial Stock Movements
INSERT INTO stock_movements (product_id, type, qty, note, created_at) VALUES
(1, 'in', 30, 'Initial supplier batch reception', NOW() - INTERVAL '14 days'),
(2, 'in', 10, 'Initial stock import', NOW() - INTERVAL '12 days'),
(3, 'in', 5, 'Warehouse inbound batch #104', NOW() - INTERVAL '10 days'),
(4, 'in', 20, 'Shipment from Singapore hub', NOW() - INTERVAL '9 days'),
(5, 'in', 150, 'Bulk purchase cables', NOW() - INTERVAL '8 days'),
(6, 'in', 8, 'Furniture supplier direct delivery', NOW() - INTERVAL '7 days'),
(7, 'in', 15, 'Chairs inbound storage', NOW() - INTERVAL '6 days'),
(8, 'in', 70, 'Stationery bulk inventory', NOW() - INTERVAL '5 days'),
(9, 'in', 45, 'German pens import batch', NOW() - INTERVAL '5 days'),
(10, 'in', 5, 'Initial sample shipment', NOW() - INTERVAL '4 days'),
(11, 'in', 100, 'Accessories restock', NOW() - INTERVAL '4 days'),
(12, 'in', 35, 'Hub restock', NOW() - INTERVAL '3 days');

-- 3. Historical Sales Orders
-- Order 1: Completed order
INSERT INTO sales_orders (id, customer, status, total, created_at, cancelled_at) VALUES
(1, 'PT Solusi Teknologi Nusantara', 'CREATED', 4150000, NOW() - INTERVAL '2 days', NULL);

INSERT INTO sales_order_items (order_id, sku, qty, unit_price) VALUES
(1, 'ELEC-KB-001', 1, 1250000),
(1, 'ELEC-MS-002', 2, 1450000);

-- Record corresponding stock movements for Order 1
INSERT INTO stock_movements (product_id, type, qty, note, created_at) VALUES
(1, 'out', 1, 'Sales Order #1 deduction', NOW() - INTERVAL '2 days'),
(2, 'out', 2, 'Sales Order #1 deduction', NOW() - INTERVAL '2 days');

-- Order 2: Cancelled order (items were returned to stock)
INSERT INTO sales_orders (id, customer, status, total, created_at, cancelled_at) VALUES
(2, 'CV Mandiri Kreasi Media', 'CANCELLED', 7090000, NOW() - INTERVAL '1 day', NOW() - INTERVAL '18 hours');

INSERT INTO sales_order_items (order_id, sku, qty, unit_price) VALUES
(2, 'ELEC-MN-003', 1, 6800000),
(2, 'ACC-LP-010', 1, 290000);

-- Movements for Order 2: out when created, in when cancelled
INSERT INTO stock_movements (product_id, type, qty, note, created_at) VALUES
(3, 'out', 1, 'Sales Order #2 deduction', NOW() - INTERVAL '1 day'),
(10, 'out', 1, 'Sales Order #2 deduction', NOW() - INTERVAL '1 day'),
(3, 'in', 1, 'Sales Order #2 cancellation return', NOW() - INTERVAL '18 hours'),
(10, 'in', 1, 'Sales Order #2 cancellation return', NOW() - INTERVAL '18 hours');

-- Order 3: Recent valid order
INSERT INTO sales_orders (id, customer, status, total, created_at, cancelled_at) VALUES
(3, 'Startup Studio Jakarta', 'CREATED', 11985000, NOW() - INTERVAL '6 hours', NULL);

INSERT INTO sales_order_items (order_id, sku, qty, unit_price) VALUES
(3, 'ELEC-KB-001', 4, 1250000),
(3, 'FURN-DK-006', 1, 3600000),
(3, 'FURN-CH-007', 1, 2850000),
(3, 'ACC-MP-011', 3, 115000),
(3, 'STAT-NB-008', 5, 240000);

INSERT INTO stock_movements (product_id, type, qty, note, created_at) VALUES
(1, 'out', 4, 'Sales Order #3 deduction', NOW() - INTERVAL '6 hours'),
(6, 'out', 1, 'Sales Order #3 deduction', NOW() - INTERVAL '6 hours'),
(7, 'out', 1, 'Sales Order #3 deduction', NOW() - INTERVAL '6 hours'),
(11, 'out', 3, 'Sales Order #3 deduction', NOW() - INTERVAL '6 hours'),
(8, 'out', 5, 'Sales Order #3 deduction', NOW() - INTERVAL '6 hours');

-- Update sequences
SELECT setval('sales_orders_id_seq', (SELECT MAX(id) FROM sales_orders));
SELECT setval('sales_order_items_id_seq', (SELECT MAX(id) FROM sales_order_items));
SELECT setval('stock_movements_id_seq', (SELECT MAX(id) FROM stock_movements));
