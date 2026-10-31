-- =============================================================================
--  PILATES STORE — MySQL database
--  File 2 of 3: starting data (the 16 products, 2 bundles, their options, FAQs and testimonials)
--
--  Run AFTER 01_create_database_and_tables.sql.
--  Made from backend/seed_data.json, the same data the website loads into an empty database.
--  INSERT IGNORE skips rows that are already there, so it is safe to run again.
--
--  You do NOT need to add users, orders, cart, wishlist, password resets or subscribers:
--  the website fills those tables when customers use it. The first admin account
--  (ADMIN_EMAIL / ADMIN_PASSWORD in backend/.env) is created the first time you run python app.py.
-- =============================================================================

USE pilates_store;
SET NAMES utf8mb4;

START TRANSACTION;

-- products: name, price, stock and inventory (kind = 'bundle' rows are the bundles)
INSERT IGNORE INTO products
  (id, kind, name, category, `filter`, price, was, stock, rating, reviews, badge, art, tone, description, photo, fallback, hover, cut, specs, gallery, bundle_items, is_active, sort_order)
VALUES
  ('stability-ball', 'product', 'Stability Ball 65 cm', 'Pilates & Core', 'pilates', 1499, 1899, 50, 4.8, 312, 'Best seller', 'ring', '#E6ECF6', 'A burst-resistant ball for core work, balance training, Pilates and posture. Hand pump included.', 'images/products/stability-ball.jpg', NULL, 'images/products/stability-ball-stone.jpg', 1, '["65 cm, for 168–185 cm height", "Burst-resistant", "Hand pump included"]', '[{"src": "images/products/stability-ball-blush.jpg", "cut": true}, {"src": "images/lifestyle/movement-balance.jpg"}]', '[]', 1, 0),
  ('stability-ball-blush', 'product', 'Stability Ball 55 cm', 'Pilates & Core', 'pilates', 1299, NULL, 50, 4.8, 204, 'New colour', 'ring', '#F6E4EC', 'The same studio-grade ball in a smaller size and a soft blush colour, sized for heights up to 168 cm.', 'images/products/stability-ball-blush.jpg', NULL, NULL, 1, '["55 cm, up to 168 cm height", "Burst-resistant", "Hand pump included"]', '[{"src": "images/products/stability-ball-stone.jpg", "cut": true}, {"src": "images/products/stability-ball.jpg", "cut": true}]', '[]', 1, 1),
  ('aero-reformer', 'product', 'Aero Reformer', 'Pilates Reformer', 'pilates', 149999, 169999, 15, 4.9, 214, 'Pre-sale', 'reformer', '#E8EDDF', 'A studio-grade reformer with whisper-quiet rails, five-spring resistance and an oak frame made to live in your home.', 'https://images.pexels.com/photos/25596894/pexels-photo-25596894.jpeg?auto=compress&cs=tinysrgb&w=900&h=1125&fit=crop', 'images/renders/aero-reformer.jpg', NULL, 0, '["5-spring resistance", "Solid oak frame", "Silent glide rails"]', '[{"src": "images/renders/aero-reformer.jpg"}, {"src": "images/lifestyle/featured-reformer.jpg"}, {"src": "images/hero/hero-reformer.jpg"}, {"src": "images/lifestyle/movement-strength.jpg"}, {"src": "images/categories/reformers.jpg"}]', '[]', 1, 2),
  ('foam-roller', 'product', 'Pilates Foam Roller', 'Pilates & Recovery', 'pilates', 999, NULL, 50, 4.7, 158, '', 'mat', '#E3EEF7', 'A firm, lightweight roller for spinal alignment, balance work and post-workout muscle release.', 'images/products/foam-roller.jpg', NULL, NULL, 1, '["90 cm × 15 cm", "High-density foam", "Holds its shape"]', '[{"src": "images/categories/everyday-pilates.jpg"}]', '[]', 1, 3),
  ('flow-yoga-mat', 'product', 'Flow Yoga Mat', 'Yoga Mat', 'yoga', 1799, 2199, 50, 4.9, 528, 'Best seller', 'mat', '#F4E6D9', 'Extra-thick, grippy and kind to joints. A natural rubber base keeps the mat grounded through every pose.', 'https://images.unsplash.com/photo-1646239646963-b0b9be56d6b5?auto=format&fit=crop&w=900&h=1125&q=72', 'images/renders/flow-mat-pro.jpg', NULL, 0, '["6 mm cushioning", "Natural rubber base", "Carry strap included"]', '[{"src": "images/renders/flow-mat-pro.jpg"}, {"src": "images/lifestyle/movement-recovery.jpg"}, {"src": "images/categories/everyday-pilates.jpg"}]', '[]', 1, 4),
  ('yoga-brick', 'product', 'Foam Yoga Brick', 'Yoga Props', 'yoga', 499, NULL, 50, 4.8, 267, '', 'barrel', '#E3EEF7', 'A light, firm brick that brings the floor closer, supports alignment and deepens stretches safely.', 'images/products/yoga-brick.jpg', NULL, NULL, 1, '["23 × 15 × 7.5 cm", "Bevelled edges", "Non-slip surface"]', '[{"src": "images/lifestyle/movement-recovery.jpg"}]', '[]', 1, 5),
  ('yoga-strap', 'product', 'Cotton Yoga Strap', 'Yoga Props', 'yoga', 449, NULL, 50, 4.7, 143, '', 'bands', '#E6EAF6', 'A soft, tightly woven cotton strap for deeper stretches, holds and alignment, with an easy-adjust buckle.', 'images/products/yoga-strap.jpg', NULL, NULL, 1, '["100% organic cotton", "2.4 m long", "Metal D-ring buckle"]', '[]', '[]', 1, 6),
  ('sculpt-dumbbells', 'product', 'Sculpt Dumbbell Pair', 'Dumbbells', 'strength', 1299, NULL, 50, 4.7, 133, '', 'dumbbells', '#F6E4EC', 'Soft-touch 2 kg weights that add focus to arm series and standing work without breaking your flow.', 'https://images.unsplash.com/photo-1591291621164-2c6367723315?auto=format&fit=crop&w=900&h=1125&q=72', 'images/renders/sculpt-dumbbells.jpg', NULL, 0, '["2 × 2 kg", "Soft-touch coating", "Anti-roll shape"]', '[{"src": "images/renders/sculpt-dumbbells.jpg"}]', '[]', 1, 7),
  ('weighted-core-ball', 'product', 'Dual-Grip Weighted Ball', 'Strength', 'strength', 2499, NULL, 50, 4.8, 96, 'Studio pick', 'dumbbells', '#ECEDEA', 'A 7 kg sand-filled ball with two handles for squats, twists, presses and full-body conditioning.', 'images/products/weighted-core-ball.jpg', NULL, 'images/products/weighted-core-ball-side.jpg', 1, '["7 kg sand fill", "Two moulded handles", "Durable shell"]', '[{"src": "images/categories/strength.jpg", "cut": true}]', '[]', 1, 8),
  ('resistance-tube', 'product', 'Resistance Tube', 'Strength', 'strength', 699, NULL, 50, 4.6, 187, '', 'bands', '#F1ECE4', 'A latex tube with foam handles for rows, presses and curls. Light enough to pack, strong enough to work.', 'images/products/resistance-tube.jpg', NULL, NULL, 1, '["Medium resistance", "Foam grip handles", "Latex tube"]', '[]', '[]', 1, 9),
  ('toning-band', 'product', 'Toning Band', 'Strength', 'strength', 599, NULL, 50, 4.6, 121, '', 'bands', '#ECEDEA', 'A lighter tube band for arm toning, warm-ups and rehab-friendly strength work.', 'images/products/toning-band.jpg', NULL, NULL, 1, '["Light resistance", "Cushioned handles", "Travel friendly"]', '[]', '[]', 1, 10),
  ('push-up-grips', 'product', 'Push-up Grips', 'Strength', 'strength', 799, NULL, 50, 4.7, 89, '', 'dumbbells', '#EEF1E8', 'Angled grips that ease pressure on your wrists and let you go deeper in every push-up.', 'images/products/push-up-grips.jpg', NULL, NULL, 1, '["Non-slip feet", "Foam handles", "Pair"]', '[]', '[]', 1, 11),
  ('morning-strength-kit', 'product', 'Morning Strength Kit', 'Morning Kit', 'kits', 1899, 2299, 50, 4.8, 176, 'Kit', 'bands', '#EDF2D6', 'Three resistance tubes, a door anchor and ankle straps in a mesh pouch. A full morning workout anywhere.', 'images/products/morning-strength-kit.jpg', NULL, NULL, 1, '["3 resistance levels", "Door anchor & straps", "Mesh carry pouch"]', '[]', '[]', 1, 12),
  ('speed-jump-rope', 'product', 'Speed Jump Rope', 'Morning Kit', 'kits', 549, NULL, 50, 4.7, 233, '', 'bands', '#ECEDEA', 'A steel-cable speed rope with cushioned handles for quick, energising morning cardio.', 'images/products/speed-jump-rope.jpg', NULL, NULL, 1, '["Adjustable length", "Steel cable", "Foam handles"]', '[]', '[]', 1, 13),
  ('classic-skipping-rope', 'product', 'Classic Skipping Rope', 'Morning Kit', 'kits', 349, NULL, 50, 4.6, 98, '', 'bands', '#F3E3D3', 'A light, colourful rope with wooden-feel handles for warm-ups, kids and casual cardio.', 'images/products/classic-skipping-rope.jpg', NULL, NULL, 0, '["2.7 m rope", "Lightweight handles", "Tangle-free"]', '[{"src": "images/categories/morning-kits.jpg"}]', '[]', 1, 14),
  ('hydration-bottle', 'product', 'Hydration Bottle 1 L', 'Morning Kit', 'kits', 449, NULL, 50, 4.7, 142, '', 'ring', '#E3EEF7', 'A shatter-resistant bottle with volume markings and a carabiner clip, so your water goes where you train.', 'images/products/hydration-bottle.jpg', NULL, NULL, 1, '["1 litre", "BPA-free", "Carabiner clip"]', '[]', '[]', 1, 15),
  ('bundle-morning', 'bundle', 'Morning Starter Kit', 'Bundle', NULL, 1299, NULL, 25, 4.9, 88, '', NULL, '#EDF2D6', 'Ten minutes of cardio and toning before breakfast: a speed rope, a toning band and a bottle to keep you going.', NULL, NULL, NULL, 0, '["Speed Jump Rope", "Toning Band", "Hydration Bottle 1 L"]', '[]', '["speed-jump-rope", "toning-band", "hydration-bottle"]', 1, 16),
  ('bundle-yoga', 'bundle', 'Yoga Essentials Set', 'Bundle', NULL, 2299, NULL, 25, 4.9, 61, '', NULL, '#F4E6D9', 'Everything for a steady home practice: a grippy mat, a supportive brick and a cotton strap for deeper stretches.', NULL, NULL, NULL, 0, '["Flow Yoga Mat", "Foam Yoga Brick", "Cotton Yoga Strap"]', '[]', '["flow-yoga-mat", "yoga-brick", "yoga-strap"]', 1, 17);

-- product_options: the choices on each product page, each with its own price
INSERT IGNORE INTO product_options
  (id, product_id, `key`, name, note, price, was, best, sort_order)
VALUES
  (1, 'stability-ball', 'single', 'Single', '65 cm, for 168–185 cm height', 1499, 1899, 0, 0),
  (2, 'stability-ball', 'duo', 'Duo pack', '2 × Stability Ball 65 cm · extra 10% off', 2699, 3798, 1, 1),
  (3, 'stability-ball-blush', 'single', 'Single', '55 cm, up to 168 cm height', 1299, NULL, 0, 0),
  (4, 'stability-ball-blush', 'duo', 'Duo pack', '2 × Stability Ball 55 cm · extra 10% off', 2339, 2598, 1, 1),
  (5, 'aero-reformer', 'starter', 'Reformer Starter', 'Aero Reformer with 5 springs, foot bar and straps', 149999, 169999, 0, 0),
  (6, 'aero-reformer', 'combo', 'Studio Combo', 'Reformer + sitting box, jump board and Flow Yoga Mat', 164999, 194999, 1, 1),
  (7, 'foam-roller', 'single', 'Single', '90 cm × 15 cm', 999, NULL, 0, 0),
  (8, 'foam-roller', 'duo', 'Duo pack', '2 × Pilates Foam Roller · extra 10% off', 1799, 1998, 1, 1),
  (9, 'flow-yoga-mat', 'single', 'Single', '6 mm cushioning', 1799, 2199, 0, 0),
  (10, 'flow-yoga-mat', 'duo', 'Duo pack', '2 × Flow Yoga Mat · extra 10% off', 3239, 4398, 1, 1),
  (11, 'yoga-brick', 'single', 'Single', '23 × 15 × 7.5 cm', 499, NULL, 0, 0),
  (12, 'yoga-brick', 'duo', 'Duo pack', '2 × Foam Yoga Brick · extra 10% off', 899, 998, 1, 1),
  (13, 'yoga-strap', 'single', 'Single', '100% organic cotton', 449, NULL, 0, 0),
  (14, 'yoga-strap', 'duo', 'Duo pack', '2 × Cotton Yoga Strap · extra 10% off', 809, 898, 1, 1),
  (15, 'sculpt-dumbbells', 'single', 'Single', '2 × 2 kg', 1299, NULL, 0, 0),
  (16, 'sculpt-dumbbells', 'duo', 'Duo pack', '2 × Sculpt Dumbbell Pair · extra 10% off', 2339, 2598, 1, 1),
  (17, 'weighted-core-ball', 'single', 'Single', '7 kg sand fill', 2499, NULL, 0, 0),
  (18, 'weighted-core-ball', 'duo', 'Duo pack', '2 × Dual-Grip Weighted Ball · extra 10% off', 4499, 4998, 1, 1),
  (19, 'resistance-tube', 'single', 'Single', 'Medium resistance', 699, NULL, 0, 0),
  (20, 'resistance-tube', 'duo', 'Duo pack', '2 × Resistance Tube · extra 10% off', 1259, 1398, 1, 1),
  (21, 'toning-band', 'single', 'Single', 'Light resistance', 599, NULL, 0, 0),
  (22, 'toning-band', 'duo', 'Duo pack', '2 × Toning Band · extra 10% off', 1079, 1198, 1, 1),
  (23, 'push-up-grips', 'single', 'Single', 'Non-slip feet', 799, NULL, 0, 0),
  (24, 'push-up-grips', 'duo', 'Duo pack', '2 × Push-up Grips · extra 10% off', 1439, 1598, 1, 1),
  (25, 'morning-strength-kit', 'single', 'Single', '3 resistance levels', 1899, 2299, 0, 0),
  (26, 'morning-strength-kit', 'duo', 'Duo pack', '2 × Morning Strength Kit · extra 10% off', 3419, 4598, 1, 1),
  (27, 'speed-jump-rope', 'single', 'Single', 'Adjustable length', 549, NULL, 0, 0),
  (28, 'speed-jump-rope', 'duo', 'Duo pack', '2 × Speed Jump Rope · extra 10% off', 989, 1098, 1, 1),
  (29, 'classic-skipping-rope', 'single', 'Single', '2.7 m rope', 349, NULL, 0, 0),
  (30, 'classic-skipping-rope', 'duo', 'Duo pack', '2 × Classic Skipping Rope · extra 10% off', 629, 698, 1, 1),
  (31, 'hydration-bottle', 'single', 'Single', '1 litre', 449, NULL, 0, 0),
  (32, 'hydration-bottle', 'duo', 'Duo pack', '2 × Hydration Bottle 1 L · extra 10% off', 809, 898, 1, 1),
  (33, 'bundle-morning', 'single', 'Complete set', 'Speed Jump Rope · Toning Band · Hydration Bottle 1 L', 1299, 1597, 0, 0),
  (34, 'bundle-yoga', 'single', 'Complete set', 'Flow Yoga Mat · Foam Yoga Brick · Cotton Yoga Strap', 2299, 2747, 0, 0);

-- faqs: frequently asked questions
INSERT IGNORE INTO faqs
  (id, question, answer, sort_order)
VALUES
  (1, 'When will my pre-booked order arrive?', 'Every piece is made to order and delivered within 3–4 weeks of booking, to the address you choose at checkout. We message you when it is built, dispatched and out for delivery.', 0),
  (2, 'How does reserving with 10% work?', 'Pay 10% today to lock in your order and price. The balance is due before dispatch. You can also pay the full amount when you pre-book.', 1),
  (3, 'Can I cancel or change a pre-booking?', 'Yes. Change the delivery address or cancel any time before dispatch for a full refund of everything you have paid.', 2),
  (4, 'Is assembly included?', 'Large equipment arrives 90% assembled with tools and a step-by-step guide. Most customers finish setup in under 30 minutes.', 3),
  (5, 'What does the warranty cover?', 'Frames are covered for 5 years. Springs, ropes and upholstery are covered for 2 years against manufacturing defects.', 4);

-- testimonials: customer reviews
INSERT IGNORE INTO testimonials
  (id, quote, name, `role`, product, sort_order)
VALUES
  (1, 'Everything feels intentional — from the equipment to the smallest detail.', 'Maya R.', 'Pilates Instructor', 'Aero Reformer', 0),
  (2, 'The reformer is so quiet I train before the house wakes up. It changed my mornings.', 'Jonas L.', 'Home studio owner', 'Aero Reformer', 1),
  (3, 'I recommend the stability ball to every client now. Solid, grippy and it holds its shape.', 'Anika P.', 'Physiotherapist', 'Stability Ball 65 cm', 2),
  (4, 'The mat grips beautifully and my knees finally stopped complaining during roll-ups.', 'Sara K.', 'Verified buyer', 'Flow Yoga Mat', 3),
  (5, 'Pre-booked on a Monday, delivered in just over three weeks, exactly as promised. Packed beautifully.', 'Daniel V.', 'Verified buyer', 'Morning Strength Kit', 4),
  (6, 'The yoga brick and strap made my morning practice so much easier. They go everywhere with me.', 'Priya S.', 'Yoga & Pilates teacher', 'Yoga Essentials Set', 5);

COMMIT;

-- Check: how many rows each table has now
SELECT 'products' AS table_name, COUNT(*) AS row_count FROM products
UNION ALL SELECT 'product_options', COUNT(*) FROM product_options
UNION ALL SELECT 'faqs', COUNT(*) FROM faqs
UNION ALL SELECT 'testimonials', COUNT(*) FROM testimonials;
