# Pilates equipment store: frontend + Python backend

Your HTML/CSS/JS website now runs on a Python backend (Flask) with a **MongoDB Atlas** database (`pilates_db`).
Products, prices, customer accounts, carts, wishlists, pre-bookings (orders) and newsletter
sign-ups are all saved on the server. There is also an admin dashboard for running the store.

```
pilates_store/
├── frontend/                 ← your website (same design, now connected to the API)
│   ├── index.html  product.html  cart.html  terms.html
│   ├── admin.html            ← NEW: store admin dashboard   (/admin)
│   ├── reset-password.html   ← NEW: "choose a new password" page
│   ├── css/style.css         (+ styles for "Your pre-bookings")
│   ├── css/admin.css         ← NEW
│   ├── js/script.js          (now loads data from and saves to the backend)
│   ├── js/admin.js           ← NEW
│   └── images/
├── backend/                  ← NEW: Python
│   ├── app.py                start here: runs the website + API
│   ├── config.py             settings: shipping, delivery weeks, 10% booking
│   ├── db.py                 MongoDB Atlas connection, collections and indexes
│   ├── models.py             how each document looks and its JSON for the frontend
│   ├── pricing.py            prices, totals, shipping, delivery batches
│   ├── utils.py              login helpers, validation
│   ├── seed.py               loads the starting products into an empty database
│   ├── seed_data.json        the 16 products, 2 bundles, reviews and FAQs
│   ├── inventory.py          stock: taken on each order, given back on cancel
│   ├── check_atlas.py        checks the Atlas connection and counts the documents
│   ├── migrate_mysql_to_atlas.py   one-time copy of the old MySQL data into Atlas
│   ├── requirements.txt
│   ├── .env                  your settings and Atlas password (private, never upload)
│   ├── .env.example          the same settings without passwords
│   └── routes/               the API, one file per topic
│       ├── catalog.py  auth.py  cart.py  orders.py  newsletter.py  admin.py
├── start-windows.bat         double-click to run on Windows
└── start-mac-linux.sh        run on macOS / Linux
```

## 1. Run it (MongoDB Atlas)

You need **Python 3.10 or newer** and a MongoDB Atlas cluster.

In `backend/.env`, set your Atlas connection string (Atlas → Clusters → Connect → Drivers) and the database name:

```
MONGO_URI=mongodb+srv://USERNAME:PASSWORD@sbldatabase.w8vxcj3.mongodb.net/?retryWrites=true&w=majority
MONGO_DB=pilates_db
```

Your computer's IP address must be allowed in Atlas → **Network Access**. Check the connection with
`python check_atlas.py` (inside `backend`).

**Windows:** double-click `start-windows.bat`.
**macOS / Linux:** `bash start-mac-linux.sh`

Or by hand:

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows
source .venv/bin/activate       # macOS / Linux
pip install -r requirements.txt
python app.py
```

Then open:

| Page  | Address |
|-------|---------|
| Shop  | http://127.0.0.1:5000 |
| Admin | http://127.0.0.1:5000/admin, signed in with `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `.env` |
| Check | http://127.0.0.1:5000/api/health shows `"ok": true` when Atlas is connected |

The first start on an empty `pilates_db` creates the collections and indexes, loads the products and
creates the admin account.

> Open the site through `http://127.0.0.1:5000`, not by double-clicking `index.html`.
> The page needs the Python server for its data, and it shows a message if the server isn't running.

## 2. Moving from MySQL Workbench (one time)

The store used to save everything in MySQL. To copy all of it (products with your prices and stock,
customers with their passwords, orders, carts, wishlists, subscribers, reviews, FAQs) into Atlas:

1. Keep MySQL running, and keep the old `DATABASE_URL=mysql+pymysql://...` line in `backend/.env`.
2. Inside `backend` (virtual environment active): `python migrate_mysql_to_atlas.py` and type `yes`.
   It empties `pilates_db` in Atlas and fills it with the MySQL data, so it is safe to run again.
3. `python app.py`.

After that, MySQL is no longer used. `DATABASE_URL`, `test_mysql.py`, `MYSQL_WORKBENCH_SETUP.md` and the
`database/` and `instance/` folders are only kept for reference.

## 3. How the frontend and backend are linked

`js/script.js` calls the API with `fetch()` through one helper, `api()`. Every page loads
`GET /api/bootstrap` first, which returns the settings, products, bundles, reviews, FAQs, the
signed-in customer, their cart and their wishlist.

| What the customer does | Browser → server | Saved in collection |
|---|---|---|
| Opens any page | `GET /api/bootstrap` | reads `products` (options inside), `testimonials`, `faqs` |
| Adds / changes / removes cart items | `PUT /api/cart` | `cart_items` |
| Taps the heart | `PUT` / `DELETE /api/wishlist/<id>` | `wishlist_items` |
| Signs up / signs in / signs out | `POST /api/auth/signup` · `/login` · `/logout` | `users` (password stored as a hash) |
| Forgot password | `POST /api/auth/forgot` → `reset-password.html` → `POST /api/auth/reset` | `password_resets` |
| Confirms a pre-booking | `POST /api/orders` | `orders` (items inside); lowers `stock` in `products` |
| Account → Your pre-bookings | `GET /api/orders` | |
| Cancels before dispatch | `POST /api/orders/<booking no>/cancel` | gives `products.stock` back |
| Joins the newsletter | `POST /api/newsletter` | `subscribers` |

**Guests and accounts.** A guest's cart and wishlist are kept under a private cookie. When the guest
signs in or signs up, they move into the account. Guests can also check out without an account.

**Prices are checked on the server.** The browser sends only product IDs, options and quantities.
`pricing.py` looks up every price in the database and works out the discount, shipping
(free from ₹999, otherwise ₹99), the 10% booking amount, the balance and the delivery batch.
If someone changes a price in their browser, it has no effect on the order.

## 4. Admin dashboard (`/admin`)

- **Overview:** order count, booked value, money collected, balance still due, latest orders.
- **Orders:** search, filter by status, open an order to see items, address and note, and change
  its status (*Booked → In production → Dispatched → Delivered* or *Cancelled*) and payment
  (*Part paid → Paid in full*, *Refund due → Refunded*). **Download CSV** gives you a spreadsheet.
- **Products:** change prices and MRP for each option (Single, Duo pack, Studio Combo…), edit
  badges, set the **stock**, or hide a product from the shop.
- **Customers** and **Newsletter** lists.

To add another admin: `cd backend` then `flask --app app create-admin`.

## 5. Settings you may want to change

- **Store rules** (`backend/config.py`, `STORE`): free-shipping threshold, shipping fee, delivery weeks, booking %, sold-out batches.
- **Starting products** (`backend/seed_data.json`): used only when the database is empty.
  To reload them, run `flask --app app init-db --reset`. **This deletes all orders and customers.**
- **Admin login, secret key, Atlas connection** (`backend/.env`).

## 6. Before going live

1. **Payment gateway.** No payment provider is connected yet. When a customer confirms, the order is
   saved and the amount due now is recorded as paid. Connect Razorpay, Stripe, PayU or another provider
   in `take_payment()` in `backend/routes/orders.py`, and mark orders as paid from the provider's webhook.
2. **Email.** Password-reset links are written to the server console. Connect an email service
   in `send_reset_email()` in `backend/routes/auth.py`. Order-confirmation emails can be sent from the same place.
3. **Security settings.** In `.env`, set your own `SECRET_KEY` and `ADMIN_PASSWORD`, set `FLASK_DEBUG=0`,
   and set `SESSION_COOKIE_SECURE=true` once the site uses https.
4. **Production server.** Don't use `python app.py` in production. Use a production server instead, for example
   `pip install waitress` and then `waitress-serve --port=5000 app:app` (works on Windows), or
   `gunicorn app:app` on Linux, behind Nginx with https.
5. **Terms page.** Fill in the highlighted placeholders in `terms.html` (business name, address, GSTIN and so on).
6. **Images.** The online Unsplash/Pexels photos still fall back to the local images if they can't load.

## API quick reference

```
GET    /api/bootstrap                 GET  /api/products?q=&filter=&sort=      GET /api/products/<id>
GET    /api/cart      PUT /api/cart   DELETE /api/cart
GET    /api/wishlist  PUT|DELETE /api/wishlist/<id>
POST   /api/auth/signup | login | logout | forgot | reset       GET /api/auth/me
POST   /api/orders    GET /api/orders    GET /api/orders/<no>    POST /api/orders/<no>/cancel
POST   /api/newsletter
Admin: GET /api/admin/stats | orders | orders.csv | orders/<no> | products | customers | subscribers
       PATCH /api/admin/orders/<no>    PATCH /api/admin/products/<id>
```

All requests and answers use JSON. Errors come back as `{"error": "...", "fields": {"email": "..."}}`,
and the website shows each message under the field it belongs to.
