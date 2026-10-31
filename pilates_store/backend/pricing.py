"""
pricing.py — the money and delivery-date rules of the store.

The browser shows the same figures, but the order is always priced here,
from the database, so a changed price in the browser cannot change what is charged.
"""
import math
from datetime import date, timedelta

from config import STORE
from db import get_db
from models import option_of


# --- Delivery dates and batches ---------------------------------------------
def delivery_window(today=None):
    today = today or date.today()
    first, last = STORE["delivery_weeks"]
    return today + timedelta(weeks=first), today + timedelta(weeks=last)


def open_batch(today=None):
    """The batch new pre-bookings go into, named after the month its delivery starts."""
    start, end = delivery_window(today)
    return {"name": f"{start.strftime('%B')} batch", "start": start, "end": end}


# --- Options ("Choose your setup") ------------------------------------------
def duo_price(price):
    """Duo pack: two pieces with an extra 10% off, rounded to a price ending in 9."""
    return int(math.floor(price * 1.8 / 10 + 0.5)) * 10 - 1


def default_options(product, catalogue):
    """Options for a product that does not list its own (same rules the old frontend used)."""
    if product.get("items"):  # bundle
        names = [catalogue[i]["name"] for i in product["items"]]
        was = sum(catalogue[i]["price"] for i in product["items"])
        return [{"key": "single", "name": "Complete set", "note": " · ".join(names),
                 "price": product["price"], "was": was}]
    return [
        {"key": "single", "name": "Single", "note": product["specs"][0], "price": product["price"],
         "was": product.get("was")},
        {"key": "duo", "name": "Duo pack", "note": f"2 × {product['name']} · extra 10% off",
         "price": duo_price(product["price"]), "was": (product.get("was") or product["price"]) * 2, "best": True},
    ]


# --- Cart lines and totals --------------------------------------------------
def clean_lines(raw_items):
    """
    Turn [{"id", "option", "qty"}, ...] from the browser into priced lines.
    Unknown or inactive products are dropped; quantities are kept between 1 and max_qty;
    the same product + option twice is merged.
    """
    merged = {}
    for raw in raw_items or []:
        if not isinstance(raw, dict):
            continue
        pid, opt_key = str(raw.get("id", "")), str(raw.get("option", "") or "")
        try:
            qty = int(raw.get("qty", 0))
        except (TypeError, ValueError):
            continue
        if qty <= 0:
            continue
        merged[(pid, opt_key)] = merged.get((pid, opt_key), 0) + qty

    lines = []
    ids = list({k[0] for k in merged})
    products = {p["_id"]: p for p in get_db().products.find({"_id": {"$in": ids}})} if merged else {}
    for (pid, opt_key), qty in merged.items():
        product = products.get(pid)
        if not product or not product.get("is_active", True) or not product.get("options"):
            continue
        option = option_of(product, opt_key) or product["options"][0]
        lines.append({
            "product": product, "option": option, "qty": min(qty, STORE["max_qty"]),
            "price": option["price"], "was": max(option.get("was") or 0, option["price"]),
        })
    # A product given once without an option and once with "single" ends up twice — merge again
    final = {}
    for line in lines:
        key = (line["product"]["_id"], line["option"]["key"])
        if key in final:
            final[key]["qty"] = min(final[key]["qty"] + line["qty"], STORE["max_qty"])
        else:
            final[key] = line
    return list(final.values())


def totals(lines, plan="deposit"):
    subtotal = sum(l["price"] * l["qty"] for l in lines)
    mrp = sum(l["was"] * l["qty"] for l in lines)
    shipping = 0 if subtotal == 0 or subtotal >= STORE["free_shipping_at"] else STORE["shipping_fee"]
    total = subtotal + shipping
    deposit = math.ceil(total * STORE["booking_share"])
    due = total if plan == "full" else deposit
    return {
        "n": sum(l["qty"] for l in lines), "mrp": mrp, "discount": mrp - subtotal, "subtotal": subtotal,
        "shipping": shipping, "total": total, "deposit": deposit, "due": due, "balance": total - due,
        "plan": plan,
    }


def lines_to_json(lines):
    return [{"id": l["product"]["_id"], "option": l["option"]["key"], "qty": l["qty"]} for l in lines]
