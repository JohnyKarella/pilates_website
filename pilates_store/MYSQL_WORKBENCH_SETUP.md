# Connect the Pilates store to a MySQL Workbench database: step by step

You will:

1. create the `pilates_store` database and its 11 tables in MySQL Workbench,
2. load the starting products,
3. point the Python backend at it (one line in `backend/.env`),
4. run the website and see the data arrive in Workbench.

```
Browser (frontend/*.html + js/script.js)
      │  fetch("/api/...")  JSON
      ▼
Python backend (backend/app.py, Flask)
      │  SQLAlchemy + PyMySQL, using DATABASE_URL in backend/.env
      ▼
MySQL server  ←── you look at and edit the same data in MySQL Workbench
   database: pilates_store   (11 tables)
```

The SQL files are in `backend/database/`:

| File | What it does | When |
|---|---|---|
| `01_create_database_and_tables.sql` | Creates the database, a login for the website and the 11 tables | Once |
| `02_sample_data.sql` | Loads the 16 products, 2 bundles, their options, FAQs and testimonials | Once |
| `03_useful_queries.sql` | Ready-made queries: stock, orders, customers, carts, sales | Whenever you need them |

---

## Step 1. Open your MySQL connection in Workbench

1. Make sure the MySQL server is running. On Windows: press Win+R, type `services.msc`, find **MySQL80** and check that it says *Running*.
2. Open **MySQL Workbench** and click your connection under *MySQL Connections* (usually *Local instance MySQL80*, user `root`). Enter the root password.

## Step 2. Create the database, the login and the tables

1. **File → Open SQL Script…** → choose `backend/database/01_create_database_and_tables.sql`.
2. Click the **lightning bolt** (Execute all), or press **Ctrl+Shift+Enter**.
3. In the *Output* panel at the bottom every line should have a green tick. The last result shows the 11 tables.
4. In the left sidebar (*Schemas*), click the refresh icon. You'll see **pilates_store → Tables**.

What the script creates:

| Table | What it holds |
|---|---|
| `products` | Product name, price, **stock** (inventory) and shop details. Bundles are rows too (`kind = 'bundle'`). |
| `product_options` | Product variations ("Choose your setup"): Single, Duo pack, Studio Combo…, each with its own price |
| `users` | Customer name, email, phone, saved address and **hashed** password. `is_admin = 1` can open /admin. |
| `password_resets` | "Forgot password" tokens (stored hashed) and their expiry time |
| `orders` | Order number (`booking_no`, e.g. PB-482913), customer, date, totals, status, payment status |
| `order_items` | Products, option, quantity and price for each order |
| `cart_items` | Products in a customer's or guest's cart |
| `wishlist_items` | Products saved with the heart button |
| `faqs` | Frequently asked questions |
| `subscribers` | Newsletter emails |
| `testimonials` | Customer reviews on the home page |

How the tables connect (foreign keys):

```
products ──< product_options          (one product, many options)
products ──< cart_items               (owner = 'u:<users.id>' or 'g:<guest code>')
products ──< wishlist_items
users    ──< orders ──< order_items   (user_id is empty for guest orders)
users    ──< password_resets
```

> **The password in Step 2 of the script.** The script makes a MySQL login `pilates_app` with the
> password `Pilates_Store_2026`, used only by the website. If you change it, change it in `backend/.env` too
> (Step 4), and don't use `@ : / ? # %` in it, because they break the `DATABASE_URL` line.
>
> If you get *"Your password does not satisfy the current policy requirements"*, choose a longer password
> with upper case, lower case, a number and a symbol like `_`.

## Step 3. Load the starting products

1. **File → Open SQL Script…** → `backend/database/02_sample_data.sql` → lightning bolt.
2. The last result shows: products 18, product_options 34, faqs 5, testimonials 6.
3. To look at them: in the sidebar, right-click **products → Select Rows – Limit 1000**.

This step is optional: if `products` is empty, the website loads the same products by itself the first time
it starts. You don't add users, orders or carts by hand. The website fills those.

## Step 4. Tell the website to use this database

Open `backend/.env` in VS Code (or Notepad) and check this line:

```
DATABASE_URL=mysql+pymysql://pilates_app:Pilates_Store_2026@localhost:3306/pilates_store?charset=utf8mb4
```

Each part means:

```
mysql+pymysql://  pilates_app : Pilates_Store_2026 @ localhost : 3306 / pilates_store ?charset=utf8mb4
   driver          MySQL user     its password       server     port   database name
```

- If your MySQL uses another port (Workbench shows it on the connection tile), change `3306`.
- To use root instead: `mysql+pymysql://root:YOUR_ROOT_PASSWORD@localhost:3306/pilates_store?charset=utf8mb4`.

This line is the only thing that connects the website to MySQL. `backend/config.py` reads it, and every
route in `backend/routes/` talks to the database through the tables in `backend/models.py`.

## Step 5. Install the Python packages (first time only)

Open a terminal in the `backend` folder (in VS Code: right-click the folder → *Open in Integrated Terminal*):

```bat
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

On macOS / Linux use `source .venv/bin/activate` instead of the second line.
`PyMySQL` and `cryptography` in `requirements.txt` are what let Python sign in to MySQL 8.

## Step 6. Test the connection

```bat
python test_mysql.py
```

You should see `Connected successfully!` and `OK` next to all 11 tables. If it fails:

| Message | Fix |
|---|---|
| `Access denied for user 'pilates_app'@'localhost'` | Password in `.env` differs from the script, or Step 2 wasn't run |
| `Unknown database 'pilates_store'` | Run Step 2 |
| `Can't connect to MySQL server on 'localhost'` | MySQL service isn't running, or the port isn't 3306 |
| `No module named 'pymysql'` | Activate `.venv` and run `pip install -r requirements.txt` |
| `cryptography package is required` | `pip install cryptography` |

## Step 7. Run the website

```bat
python app.py
```

Open **http://127.0.0.1:5000** for the shop and **http://127.0.0.1:5000/admin** for the admin
(email and password are `ADMIN_EMAIL` / `ADMIN_PASSWORD` in `.env`; the admin account is created the first time
the app starts).

Always open the site through `http://127.0.0.1:5000`, not by double-clicking `index.html`.

## Step 8. Watch the data arrive in Workbench

Do something on the website, then run the matching query in Workbench (or open
`03_useful_queries.sql` and run one query with **Ctrl+Enter**):

| On the website | Run in Workbench |
|---|---|
| Sign up | `SELECT id, name, email, phone, created_at FROM users;` |
| Add to cart | `SELECT * FROM cart_items;` |
| Tap the heart | `SELECT * FROM wishlist_items;` |
| Confirm a pre-booking | `SELECT * FROM orders;` and `SELECT * FROM order_items;` |
| Stock after the order | `SELECT id, name, stock FROM products;` |
| Forgot password | `SELECT * FROM password_resets;` |
| Join the newsletter | `SELECT * FROM subscribers;` |

## How stock (inventory) works

- Each row in `products` has a `stock` number: how many more units can be booked.
- When a customer confirms a pre-booking, the stock of each product goes down by the quantity.
  If there isn't enough, the order is refused with *"Sorry, only 3 of Aero Reformer left"* and nothing is saved.
- When an order is cancelled (by the customer, or in /admin), the stock goes back up.
- The shop shows **Sold out** at 0 and **Only N left** on the product page at 10 or fewer.
- Change stock in **/admin → Products → Stock → Save**, or in Workbench:
  `UPDATE products SET stock = 40 WHERE id = 'aero-reformer';`
- A bundle has its own stock, separate from the products inside it.

## Good to know

- **Editing data in Workbench is fine** for products, prices, stock, FAQs and testimonials. Refresh the website to see it.
  If you change the first option's price in `product_options`, also change `products.price` (the card price).
  /admin does both for you.
- **Passwords** can't be typed into `users` by hand, because the website stores a hash. Use "Forgot password", or
  `flask --app app create-admin` for an admin.
- **Safe Updates.** Workbench blocks `UPDATE`/`DELETE` without a key in `WHERE`. The queries in file 3 already work
  with it on.
- **Changing a table.** If you add a column in Workbench, add it to the class in `backend/models.py` too,
  or the website won't use it.
- **Times** are stored in UTC (India time minus 5:30).
- **Starting over.** In Workbench run `DROP DATABASE pilates_store;` and then repeat Steps 2–3.
  This deletes every order and customer.
- **An older database** (for example `pilates_store_fresh`) still works: when `python app.py` starts, it adds the
  `stock` column if it is missing.
