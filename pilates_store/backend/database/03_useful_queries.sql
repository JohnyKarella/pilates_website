-- =============================================================================
--  PILATES STORE — MySQL database
--  File 3 of 3: handy queries for MySQL Workbench
--
--  Don't run this whole file at once. Put the cursor on one query and press
--  Ctrl+Enter (Cmd+Enter on Mac) to run just that query.
--  Change the values in 'quotes' (emails, product ids, booking numbers) to your own.
-- =============================================================================

USE pilates_store;


-- =============================================================================
-- A. PRODUCTS, STOCK AND INVENTORY
-- =============================================================================

-- A1. Every product with price, MRP and stock
SELECT id, name, kind, category, price, was AS mrp, stock, is_active
FROM products
ORDER BY kind DESC, sort_order;

-- A2. Low stock: 5 or fewer left
SELECT id, name, stock
FROM products
WHERE stock <= 5 AND is_active = 1
ORDER BY stock;

-- A3. Sold out
SELECT id, name FROM products WHERE stock = 0;

-- A4. Set the stock of one product (e.g. after a new delivery from the factory)
UPDATE products SET stock = 40 WHERE id = 'aero-reformer';

-- A5. Add stock on top of what is there
UPDATE products SET stock = stock + 10 WHERE id = 'flow-yoga-mat';

-- A6. Hide a product from the shop / show it again
UPDATE products SET is_active = 0 WHERE id = 'hydration-bottle';
UPDATE products SET is_active = 1 WHERE id = 'hydration-bottle';

-- A7. Each product with its options ("Choose your setup") and their prices
SELECT p.name AS product, o.`key`, o.name AS option_name, o.price, o.was AS mrp, o.best
FROM products p
JOIN product_options o ON o.product_id = p.id
ORDER BY p.sort_order, o.sort_order;

-- A8. Change the price of one option.
--     The website shows the FIRST option's price on the product card, so if you change
--     the first option, change products.price to the same number (the admin page does both for you).
UPDATE product_options SET price = 1399, was = 1899
WHERE product_id = 'stability-ball' AND `key` = 'single';
UPDATE products SET price = 1399, was = 1899 WHERE id = 'stability-ball';

-- A9. Units booked per product (not counting cancelled orders) and stock left
SELECT p.id, p.name, COALESCE(b.units, 0) AS units_booked, p.stock AS stock_left
FROM products p
LEFT JOIN (
  SELECT oi.product_id, SUM(oi.qty) AS units
  FROM order_items oi
  JOIN orders o ON o.id = oi.order_id
  WHERE o.status <> 'cancelled'
  GROUP BY oi.product_id
) b ON b.product_id = p.id
ORDER BY units_booked DESC, p.sort_order;


-- =============================================================================
-- B. CUSTOMERS (users)
-- =============================================================================

-- B1. All customers (the password hash is left out on purpose)
SELECT id, name, email, phone, city, is_admin, created_at
FROM users
ORDER BY created_at DESC;

-- B2. Customers with how many orders they placed and how much they booked
SELECT u.id, u.name, u.email, COUNT(o.id) AS orders, COALESCE(SUM(o.total), 0) AS booked_value
FROM users u
LEFT JOIN orders o ON o.user_id = u.id AND o.status <> 'cancelled'
GROUP BY u.id, u.name, u.email
ORDER BY booked_value DESC;

-- B3. Make an existing account an admin (they can then open /admin)
UPDATE users SET is_admin = 1 WHERE email = 'someone@example.com';

-- B4. Passwords cannot be set here: they must be hashed by Python.
--     Use "Forgot password" on the website, or in the backend folder run:
--         flask --app app create-admin


-- =============================================================================
-- C. ORDERS AND ORDER ITEMS
-- =============================================================================

-- C1. Latest orders
SELECT booking_no, created_at, name, email, total, paid_amount, balance, status, payment_status
FROM orders
ORDER BY created_at DESC
LIMIT 50;

-- C2. One order with its items
SELECT o.booking_no, o.name, o.status, oi.product_name, oi.option_name, oi.qty, oi.unit_price, oi.line_total
FROM orders o
JOIN order_items oi ON oi.order_id = o.id
WHERE o.booking_no = 'PB-123456';

-- C3. Orders per status
SELECT status, COUNT(*) AS orders, SUM(total) AS value
FROM orders
GROUP BY status;

-- C4. Money: booked, collected, still to collect (cancelled orders left out)
SELECT SUM(total) AS booked_value, SUM(paid_amount) AS collected, SUM(balance) AS balance_due
FROM orders
WHERE status <> 'cancelled';

-- C5. Sales per month
SELECT DATE_FORMAT(created_at, '%Y-%m') AS month, COUNT(*) AS orders, SUM(total) AS value
FROM orders
WHERE status <> 'cancelled'
GROUP BY month
ORDER BY month;

-- C6. Best-selling products
SELECT oi.product_name, SUM(oi.qty) AS units, SUM(oi.line_total) AS revenue
FROM order_items oi
JOIN orders o ON o.id = oi.order_id
WHERE o.status <> 'cancelled'
GROUP BY oi.product_name
ORDER BY units DESC;

-- C7. Change an order's status. Better: use the admin page (/admin), because it also
--     gives the stock back when an order is cancelled. A cancel done here does NOT.
UPDATE orders SET status = 'dispatched' WHERE booking_no = 'PB-123456';


-- =============================================================================
-- D. CARTS AND WISHLISTS
-- =============================================================================

-- D1. What is in customers' carts right now (signed-in customers only)
SELECT u.name, u.email, p.name AS product, c.option_key, c.qty, c.updated_at
FROM cart_items c
JOIN users u    ON c.owner = CONCAT('u:', u.id)
JOIN products p ON p.id = c.product_id
ORDER BY c.updated_at DESC;

-- D2. Guest carts (people not signed in)
SELECT c.owner, p.name AS product, c.qty, c.updated_at
FROM cart_items c
JOIN products p ON p.id = c.product_id
WHERE c.owner LIKE 'g:%';

-- D3. Most wished-for products
SELECT p.name, COUNT(*) AS times_saved
FROM wishlist_items w
JOIN products p ON p.id = w.product_id
GROUP BY p.name
ORDER BY times_saved DESC;


-- =============================================================================
-- E. PASSWORD RESETS, NEWSLETTER, FAQS, TESTIMONIALS
-- =============================================================================

-- E1. Reset links that can still be used
SELECT u.email, r.expires_at
FROM password_resets r
JOIN users u ON u.id = r.user_id
WHERE r.used = 0 AND r.expires_at > UTC_TIMESTAMP();

-- E2. Clean up old reset links
DELETE FROM password_resets WHERE id > 0 AND (used = 1 OR expires_at < UTC_TIMESTAMP());

-- E3. Newsletter subscribers
SELECT email, created_at FROM subscribers ORDER BY created_at DESC;

-- E4. Add a FAQ (shown on the home page, in sort_order)
INSERT INTO faqs (question, answer, sort_order)
VALUES ('Do you ship outside India?', 'Not yet. We deliver across India only for now.', 10);

-- E5. Add a testimonial
INSERT INTO testimonials (quote, name, `role`, product, sort_order)
VALUES ('Lovely quality, arrived on time.', 'Priya S.', 'Home workout', 'Flow Yoga Mat', 10);


-- =============================================================================
-- F. OPTIONAL: saved views (appear under "Views" in the Workbench sidebar)
-- =============================================================================

CREATE OR REPLACE VIEW v_inventory AS
SELECT id, name, kind, price, stock,
       CASE WHEN stock = 0 THEN 'Sold out' WHEN stock <= 5 THEN 'Low' ELSE 'OK' END AS stock_level,
       is_active
FROM products;

CREATE OR REPLACE VIEW v_order_summary AS
SELECT o.booking_no, o.created_at, o.name, o.email, o.phone, o.city,
       SUM(oi.qty) AS items, o.total, o.paid_amount, o.balance, o.status, o.payment_status
FROM orders o
JOIN order_items oi ON oi.order_id = o.id
GROUP BY o.id;

-- Use them like tables:
SELECT * FROM v_inventory WHERE stock_level <> 'OK';
SELECT * FROM v_order_summary ORDER BY created_at DESC;
