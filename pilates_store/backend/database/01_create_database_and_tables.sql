-- =============================================================================
--  PILATES STORE — MySQL database
--  File 1 of 3: create the database, the app login and the 11 tables
--
--  How to run in MySQL Workbench:
--    File > Open SQL Script... > choose this file > click the lightning bolt (Execute all).
--    Or select one STEP and press Ctrl+Shift+Enter (Cmd+Shift+Enter on Mac) to run just that step.
--
--  Safe to run again: every statement uses IF NOT EXISTS, so nothing is deleted.
--  These tables match backend/models.py exactly. If you change a column here,
--  change it in models.py too, or the website will not be able to read it.
--
--  Money is stored in whole rupees (INT). Times are stored in UTC.
--  BOOL columns are TINYINT(1): 1 = yes, 0 = no.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- STEP 1. Create the database and select it
-- -----------------------------------------------------------------------------
CREATE DATABASE IF NOT EXISTS pilates_store
  CHARACTER SET utf8mb4            -- utf8mb4 stores every character, including ₹ and emoji
  COLLATE utf8mb4_unicode_ci;

USE pilates_store;


-- -----------------------------------------------------------------------------
-- STEP 2. Create a login for the website (recommended instead of using root)
--         Change the password here AND in backend/.env (DATABASE_URL).
--         Avoid the characters  @ : / ? # %  in this password: they break DATABASE_URL.
-- -----------------------------------------------------------------------------
CREATE USER IF NOT EXISTS 'pilates_app'@'localhost' IDENTIFIED BY 'Pilates_Store_2026';
GRANT ALL PRIVILEGES ON pilates_store.* TO 'pilates_app'@'localhost';
FLUSH PRIVILEGES;


-- =============================================================================
-- STEP 3. Create the tables
--         The order matters: a table that points to another table (FOREIGN KEY)
--         must be created after the table it points to.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 3.1  products — product name, price, stock (inventory) and shop details
--      One row per product AND per bundle (kind = 'bundle').
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS products (
  id            VARCHAR(80)   NOT NULL                    COMMENT 'Product code used in the website address, e.g. aero-reformer',
  kind          VARCHAR(10)   NOT NULL DEFAULT 'product'  COMMENT 'product or bundle',
  name          VARCHAR(160)  NOT NULL                    COMMENT 'Product name',
  category      VARCHAR(80)   NOT NULL                    COMMENT 'e.g. Pilates Reformer, Pilates & Core',
  `filter`      VARCHAR(30)   NULL                        COMMENT 'Shop filter button: pilates, yoga, strength, kits',
  price         INT           NOT NULL                    COMMENT 'Selling price in rupees (= price of the first option)',
  was           INT           NULL                        COMMENT 'MRP in rupees, when the product is discounted',
  stock         INT           NOT NULL DEFAULT 50         COMMENT 'Inventory: units that can still be booked. Goes down on each order, back up on cancel',
  rating        FLOAT         NULL DEFAULT 0              COMMENT 'Average star rating shown on the card',
  reviews       INT           NULL DEFAULT 0              COMMENT 'Number of reviews shown on the card',
  badge         VARCHAR(60)   NULL DEFAULT ''             COMMENT 'Small label on the card, e.g. Best seller',
  art           VARCHAR(30)   NULL                        COMMENT 'Drawing used when there is no photo',
  tone          VARCHAR(20)   NULL                        COMMENT 'Card background colour, e.g. #E6ECF6',
  description   TEXT          NULL,
  photo         VARCHAR(500)  NULL                        COMMENT 'Main photo (path in frontend/images or a web address)',
  fallback      VARCHAR(500)  NULL                        COMMENT 'Local photo used if the web photo cannot load',
  hover         VARCHAR(500)  NULL                        COMMENT 'Photo shown when the mouse is over the card',
  cut           TINYINT(1)    NULL DEFAULT 0              COMMENT '1 = photo is a cut-out on a plain background',
  specs         JSON          NULL                        COMMENT 'List of short feature lines',
  gallery       JSON          NULL                        COMMENT 'Extra photos for the product page',
  bundle_items  JSON          NULL                        COMMENT 'For bundles: the product ids inside the bundle',
  is_active     TINYINT(1)    NOT NULL DEFAULT 1          COMMENT '0 = hidden from the shop',
  sort_order    INT           NOT NULL DEFAULT 0          COMMENT 'Position in the shop (smallest first)',
  updated_at    DATETIME      NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_products_shop (kind, is_active, sort_order),
  CONSTRAINT ck_products_kind  CHECK (kind IN ('product', 'bundle')),
  CONSTRAINT ck_products_price CHECK (price > 0),
  CONSTRAINT ck_products_stock CHECK (stock >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Products and bundles: name, price, stock and inventory';


-- -----------------------------------------------------------------------------
-- 3.2  product_options — product variations ("Choose your setup")
--      e.g. Single / Duo pack / Studio Combo, each with its own price.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS product_options (
  id            INT           NOT NULL AUTO_INCREMENT,
  product_id    VARCHAR(80)   NOT NULL                    COMMENT 'Which product (products.id)',
  `key`         VARCHAR(40)   NOT NULL                    COMMENT 'Option code, e.g. single, duo, starter',
  name          VARCHAR(120)  NOT NULL                    COMMENT 'Option name shown to the customer',
  note          VARCHAR(255)  NULL DEFAULT ''             COMMENT 'Small line under the name',
  price         INT           NOT NULL                    COMMENT 'Price of this option in rupees',
  was           INT           NULL                        COMMENT 'MRP of this option, if discounted',
  best          TINYINT(1)    NULL DEFAULT 0              COMMENT '1 = show the "Best value" label',
  sort_order    INT           NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uq_option_product_key (product_id, `key`),
  CONSTRAINT fk_options_product FOREIGN KEY (product_id) REFERENCES products (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT ck_options_price CHECK (price > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Product variations or options';


-- -----------------------------------------------------------------------------
-- 3.3  users — customers (and admins): name, email, phone, hashed password
--      The password is NEVER stored. The website stores a salted hash of it.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            INT           NOT NULL AUTO_INCREMENT,
  name          VARCHAR(120)  NOT NULL                    COMMENT 'Customer name',
  email         VARCHAR(255)  NOT NULL                    COMMENT 'Login email (always lowercase)',
  password_hash VARCHAR(255)  NOT NULL                    COMMENT 'Hashed password, made by the Python backend',
  is_admin      TINYINT(1)    NOT NULL DEFAULT 0          COMMENT '1 = can open /admin',
  phone         VARCHAR(30)   NULL                        COMMENT 'Saved from the last order',
  address       VARCHAR(255)  NULL,
  city          VARCHAR(100)  NULL,
  state         VARCHAR(100)  NULL,
  zip           VARCHAR(20)   NULL                        COMMENT 'PIN / ZIP code',
  country       VARCHAR(80)   NULL,
  created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY ix_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Customer name, email, phone and hashed password';


-- -----------------------------------------------------------------------------
-- 3.4  password_resets — "Forgot password" tokens and when they expire
--      Only a hash of the token is stored; the real token is in the emailed link.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS password_resets (
  id            INT           NOT NULL AUTO_INCREMENT,
  user_id       INT           NOT NULL                    COMMENT 'Which customer (users.id)',
  token_hash    VARCHAR(64)   NOT NULL                    COMMENT 'SHA-256 of the reset token',
  expires_at    DATETIME      NOT NULL                    COMMENT 'Link stops working after this time (UTC)',
  used          TINYINT(1)    NOT NULL DEFAULT 0          COMMENT '1 = already used',
  PRIMARY KEY (id),
  UNIQUE KEY uq_reset_token (token_hash),
  KEY ix_resets_user (user_id),
  CONSTRAINT fk_resets_user FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Password reset tokens and expiry';


-- -----------------------------------------------------------------------------
-- 3.5  orders — pre-bookings: order number, customer, date, totals and status
--      Guests can order too: then user_id is empty (NULL).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
  id             INT           NOT NULL AUTO_INCREMENT,
  booking_no     VARCHAR(20)   NOT NULL                   COMMENT 'Order number shown to the customer, e.g. PB-482913',
  user_id        INT           NULL                       COMMENT 'Customer account (users.id). NULL = guest checkout',
  guest_owner    VARCHAR(80)   NULL                       COMMENT 'Lets a guest see their own order',
  -- customer and delivery address
  name           VARCHAR(120)  NOT NULL,
  email          VARCHAR(255)  NOT NULL,
  phone          VARCHAR(30)   NOT NULL,
  address        VARCHAR(255)  NOT NULL,
  city           VARCHAR(100)  NOT NULL,
  state          VARCHAR(100)  NOT NULL,
  zip            VARCHAR(20)   NOT NULL,
  country        VARCHAR(80)   NOT NULL,
  note           TEXT          NULL                       COMMENT 'Note for the seller from the cart page',
  -- payment and totals (rupees, worked out by the server)
  pay_method     VARCHAR(30)   NOT NULL                   COMMENT 'Card, UPI or Net banking',
  plan           VARCHAR(10)   NOT NULL                   COMMENT 'deposit (pay 10% now) or full',
  mrp            INT           NOT NULL                   COMMENT 'Total MRP before discount',
  discount       INT           NOT NULL,
  subtotal       INT           NOT NULL,
  shipping       INT           NOT NULL,
  total          INT           NOT NULL                   COMMENT 'Grand total',
  paid_amount    INT           NOT NULL                   COMMENT 'Paid so far',
  balance        INT           NOT NULL                   COMMENT 'Still to pay',
  -- pre-booking batch
  batch_name     VARCHAR(60)   NOT NULL                   COMMENT 'e.g. November batch',
  delivery_start DATE          NOT NULL,
  delivery_end   DATE          NOT NULL,
  -- status
  status         VARCHAR(20)   NOT NULL DEFAULT 'booked'  COMMENT 'booked, in_production, dispatched, delivered, cancelled',
  payment_status VARCHAR(20)   NOT NULL DEFAULT 'part_paid' COMMENT 'part_paid, paid, refund_due, refunded',
  created_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Order date (UTC)',
  updated_at     DATETIME      NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY ix_orders_booking_no (booking_no),
  KEY ix_orders_user (user_id),
  KEY ix_orders_email (email),
  KEY ix_orders_created_at (created_at),
  KEY ix_orders_status (status),
  CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE SET NULL,
  CONSTRAINT ck_orders_status  CHECK (status IN ('booked', 'in_production', 'dispatched', 'delivered', 'cancelled')),
  CONSTRAINT ck_orders_payment CHECK (payment_status IN ('part_paid', 'paid', 'refund_due', 'refunded')),
  CONSTRAINT ck_orders_plan    CHECK (plan IN ('deposit', 'full')),
  CONSTRAINT ck_orders_money   CHECK (total >= 0 AND paid_amount >= 0 AND balance >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Order number, customer, date, totals and status';


-- -----------------------------------------------------------------------------
-- 3.6  order_items — the products, quantity and price inside each order
--      A copy taken at the moment of booking, so later price changes don't change old orders.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_items (
  id            INT           NOT NULL AUTO_INCREMENT,
  order_id      INT           NOT NULL                    COMMENT 'Which order (orders.id)',
  product_id    VARCHAR(80)   NOT NULL                    COMMENT 'Product code at the time of booking',
  product_name  VARCHAR(160)  NOT NULL,
  option_key    VARCHAR(40)   NOT NULL,
  option_name   VARCHAR(120)  NOT NULL,
  unit_price    INT           NOT NULL                    COMMENT 'Price of one unit in rupees',
  unit_mrp      INT           NOT NULL,
  qty           INT           NOT NULL                    COMMENT 'Quantity',
  line_total    INT           NOT NULL                    COMMENT 'unit_price x qty',
  PRIMARY KEY (id),
  KEY ix_order_items_order (order_id),
  KEY ix_order_items_product (product_id),
  CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders (id)
    ON DELETE CASCADE,
  CONSTRAINT ck_order_items_qty CHECK (qty > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Products, quantity and price for each order';


-- -----------------------------------------------------------------------------
-- 3.7  cart_items — products in a customer's (or guest's) cart
--      owner = 'u:<users.id>' for a signed-in customer, e.g. 'u:7'
--      owner = 'g:<random code>' for a guest (kept in a browser cookie).
--      When a guest signs in, their rows move to 'u:<id>'.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cart_items (
  id            INT           NOT NULL AUTO_INCREMENT,
  owner         VARCHAR(80)   NOT NULL                    COMMENT 'u:<user id> or g:<guest code>',
  product_id    VARCHAR(80)   NOT NULL                    COMMENT 'products.id',
  option_key    VARCHAR(40)   NOT NULL                    COMMENT 'product_options.key',
  qty           INT           NOT NULL DEFAULT 1,
  updated_at    DATETIME      NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_cart_line (owner, product_id, option_key),
  KEY ix_cart_product (product_id),
  CONSTRAINT fk_cart_product FOREIGN KEY (product_id) REFERENCES products (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT ck_cart_qty CHECK (qty > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Products added to a customer''s cart';


-- -----------------------------------------------------------------------------
-- 3.8  wishlist_items — products a customer saved with the heart button
--      owner works the same way as in cart_items.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS wishlist_items (
  id            INT           NOT NULL AUTO_INCREMENT,
  owner         VARCHAR(80)   NOT NULL                    COMMENT 'u:<user id> or g:<guest code>',
  product_id    VARCHAR(80)   NOT NULL                    COMMENT 'products.id',
  created_at    DATETIME      NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_wish_line (owner, product_id),
  KEY ix_wish_product (product_id),
  CONSTRAINT fk_wish_product FOREIGN KEY (product_id) REFERENCES products (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Customer wishlist products';


-- -----------------------------------------------------------------------------
-- 3.9  faqs — frequently asked questions shown on the home page
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS faqs (
  id            INT           NOT NULL AUTO_INCREMENT,
  question      VARCHAR(255)  NOT NULL,
  answer        TEXT          NOT NULL,
  sort_order    INT           NULL DEFAULT 0              COMMENT 'Position on the page (smallest first)',
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Frequently asked questions';


-- -----------------------------------------------------------------------------
-- 3.10 subscribers — newsletter sign-ups (one row per email)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS subscribers (
  id            INT           NOT NULL AUTO_INCREMENT,
  email         VARCHAR(255)  NOT NULL,
  created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY ix_subscribers_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Newsletter subscribers';


-- -----------------------------------------------------------------------------
-- 3.11 testimonials — customer reviews shown on the home page
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS testimonials (
  id            INT           NOT NULL AUTO_INCREMENT,
  quote         TEXT          NOT NULL                    COMMENT 'What the customer said',
  name          VARCHAR(120)  NOT NULL                    COMMENT 'Customer name',
  `role`        VARCHAR(120)  NULL DEFAULT ''             COMMENT 'e.g. Pilates instructor, Mumbai',
  product       VARCHAR(160)  NULL DEFAULT ''             COMMENT 'Product they bought',
  sort_order    INT           NULL DEFAULT 0,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Customer reviews or testimonials';


-- -----------------------------------------------------------------------------
-- STEP 4. Check: this should list the 11 tables
-- -----------------------------------------------------------------------------
SHOW TABLES;
