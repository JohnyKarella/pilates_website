"""
config.py — every setting the backend uses, in one place.

Values can be overridden with environment variables or a `.env` file placed
next to this file (copy `.env.example` to `.env` and edit it).
"""
import os
from datetime import timedelta
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")


def _bool(name, default=False):
    return os.getenv(name, str(default)).strip().lower() in ("1", "true", "yes", "on")


class Config:
    # --- Security -----------------------------------------------------------
    # Used to sign the login cookie. ALWAYS set your own long random value in .env
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-only-change-this-secret-key")

    # --- Database: MongoDB Atlas ---------------------------------------------
    # Atlas > Clusters > Connect > Drivers. Put the real password in backend/.env:
    #   MONGO_URI=mongodb+srv://USER:PASSWORD@sbldatabase.xxxxx.mongodb.net/?retryWrites=true&w=majority
    MONGO_URI = os.getenv("MONGO_URI", "").strip()
    MONGO_DB = os.getenv("MONGO_DB", "pilates_db").strip() or "pilates_db"

    # --- Login cookie -------------------------------------------------------
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = "Lax"
    SESSION_COOKIE_SECURE = _bool("SESSION_COOKIE_SECURE", False)  # set true when the site runs on https
    PERMANENT_SESSION_LIFETIME = timedelta(days=30)                  # "Keep me signed in"

    # --- Files --------------------------------------------------------------
    FRONTEND_DIR = (BASE_DIR.parent / "frontend").resolve()
    SEND_FILE_MAX_AGE_DEFAULT = 0  # always serve fresh HTML/CSS/JS while developing

    # --- First admin account (created automatically if no admin exists) ----
    ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@pilates.local")
    ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin12345")
    ADMIN_NAME = os.getenv("ADMIN_NAME", "Store Admin")

    # The public address of the site, used in password-reset links
    SITE_URL = os.getenv("SITE_URL", "http://127.0.0.1:5000")


# --- Store rules (shared with the frontend through /api/bootstrap) ----------
# The browser shows these numbers, but every price and total is re-calculated
# here on the server when an order is placed, so they cannot be tampered with.
STORE = {
    "free_shipping_at": 999,      # rupees — orders at or above this ship free
    "shipping_fee": 99,           # rupees
    "delivery_weeks": [3, 4],     # pre-booked orders arrive 3–4 weeks after booking
    "booking_share": 0.10,        # "Reserve with 10%"
    "sold_out_batches": 1,        # earlier batches shown as "Sold out"
    "max_qty": 99,                # most of one cart line
    "currency": "INR",
}

PAY_METHODS = ["Card", "UPI", "Net banking"]
PLANS = ["deposit", "full"]

ORDER_STATUSES = ["booked", "in_production", "dispatched", "delivered", "cancelled"]
PAYMENT_STATUSES = ["part_paid", "paid", "refund_due", "refunded"]
CANCELLABLE = ["booked", "in_production"]  # customers can cancel any time before dispatch
