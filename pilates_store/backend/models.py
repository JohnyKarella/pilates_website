"""
models.py — how each MongoDB document looks, and how it is turned into the JSON the frontend reads.

The JSON is exactly the same as in the old MySQL version, so no HTML/JS file had to change.

users        {_id: 1, name, email, password_hash, is_admin, phone, address, city, state, zip, country, created_at}
products     {_id: "aero-reformer", kind: "product"|"bundle", name, category, filter, price, was, stock,
              rating, reviews, badge, art, tone, description, photo, fallback, hover, cut, specs, gallery,
              bundle_items, is_active, sort_order, updated_at,
              options: [{key, name, note, price, was, best}]}
orders       {_id: 1, booking_no, user_id, guest_owner, name, email, phone, address, city, state, zip, country,
              note, pay_method, plan, mrp, discount, subtotal, shipping, total, paid_amount, balance,
              batch_name, delivery_start: "YYYY-MM-DD", delivery_end, status, payment_status,
              created_at, updated_at,
              items: [{product_id, product_name, option_key, option_name, unit_price, unit_mrp, qty, line_total}]}
"""
from datetime import datetime, timezone

from werkzeug.security import check_password_hash, generate_password_hash

SAVED_FIELDS = ("phone", "address", "city", "state", "zip", "country")


def utcnow():
    """Current time in UTC, without a timezone (MongoDB stores it as UTC)."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def iso(dt):
    return dt.isoformat() + "Z" if dt else None


# --- Customers and admins ----------------------------------------------------
def hash_password(password):
    # Passwords are never stored — only a salted hash of them
    return generate_password_hash(password)


def check_password(user, password):
    return bool(user and user.get("password_hash")) and check_password_hash(user["password_hash"], password)


def user_dict(user):
    return {
        "id": user["_id"],
        "name": user.get("name", ""),
        "email": user["email"],
        "is_admin": bool(user.get("is_admin")),
        "saved": {k: user.get(k) or "" for k in SAVED_FIELDS},
    }


# --- Catalogue -----------------------------------------------------------------
def option_of(product, key):
    return next((o for o in product.get("options") or [] if o["key"] == key), None)


def option_dict(o):
    d = {"key": o["key"], "name": o["name"], "note": o.get("note") or "", "price": o["price"],
         "was": max(o.get("was") or 0, o["price"])}
    if o.get("best"):
        d["best"] = True
    return d


def product_dict(p, admin=False):
    d = {
        "id": p["_id"], "name": p["name"], "category": p["category"], "price": p["price"],
        "stock": p.get("stock", 0), "rating": p.get("rating", 0), "reviews": p.get("reviews", 0),
        "tone": p.get("tone"), "description": p.get("description"), "specs": p.get("specs") or [],
        "options": [option_dict(o) for o in p.get("options") or []],
    }
    if p.get("kind") == "bundle":
        d["items"] = p.get("bundle_items") or []
    else:
        d.update({"filter": p.get("filter"), "badge": p.get("badge") or "", "art": p.get("art"),
                  "photo": p.get("photo"), "cut": bool(p.get("cut"))})
        if p.get("was") and p["was"] > p["price"]:
            d["was"] = p["was"]
        for key in ("fallback", "hover"):
            if p.get(key):
                d[key] = p[key]
        if p.get("gallery"):
            d["more"] = p["gallery"]
    if admin:
        d.update({"kind": p.get("kind", "product"), "is_active": bool(p.get("is_active", True)),
                  "was": p.get("was"), "badge": p.get("badge") or ""})
    return d


# --- Orders (pre-bookings) -----------------------------------------------------
def item_dict(i):
    return {"id": i["product_id"], "name": i["product_name"], "option": i["option_key"],
            "option_name": i.get("option_name") or "", "price": i["unit_price"], "was": i["unit_mrp"],
            "qty": i["qty"], "line_total": i["line_total"]}


def order_dict(o):
    items = o.get("items") or []
    return {
        "booking_no": o["booking_no"],
        "created_at": iso(o.get("created_at")),
        "status": o["status"],
        "payment_status": o["payment_status"],
        "customer": {"name": o["name"], "email": o["email"], "phone": o["phone"]},
        "delivery": {k: o.get(k) for k in ("address", "city", "state", "zip", "country")},
        "note": o.get("note") or "",
        "pay_method": o["pay_method"],
        "plan": o["plan"],
        "totals": {"n": sum(i["qty"] for i in items), "mrp": o["mrp"], "discount": o["discount"],
                   "subtotal": o["subtotal"], "shipping": o["shipping"], "total": o["total"],
                   "paid": o["paid_amount"], "balance": o["balance"]},
        "batch": {"name": o["batch_name"], "start": o["delivery_start"], "end": o["delivery_end"]},
        "items": [item_dict(i) for i in items],
        "user_id": o.get("user_id"),
    }


# --- Content -------------------------------------------------------------------
def testimonial_dict(t):
    return {"quote": t["quote"], "name": t["name"], "role": t.get("role") or "", "product": t.get("product") or ""}


def faq_dict(f):
    return {"q": f["question"], "a": f["answer"]}
