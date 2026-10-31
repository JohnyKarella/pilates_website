"""
inventory.py — stock (inventory) rules.

Every product and bundle has a `stock` number in the `products` collection: how many more
units can be booked. It goes down when a pre-booking is placed and back up when the
pre-booking is cancelled. A bundle has its own stock, separate from the products inside it.

Stock is taken with one update "only if stock >= qty", so two customers booking
the last unit at the same moment cannot both get it.
"""
from db import get_db
from utils import ApiError


def reserve_stock(lines):
    """Take stock for each order line ({"product_id", "name", "qty"}). Raises ApiError if there isn't enough."""
    products = get_db().products
    taken = []
    for line in lines:
        result = products.update_one({"_id": line["product_id"], "stock": {"$gte": line["qty"]}},
                                     {"$inc": {"stock": -line["qty"]}})
        if result.modified_count == 0:
            for done in taken:   # give back the lines already taken
                products.update_one({"_id": done["product_id"]}, {"$inc": {"stock": done["qty"]}})
            doc = products.find_one({"_id": line["product_id"]}, {"stock": True}) or {}
            left = doc.get("stock") or 0
            if left <= 0:
                message = f"Sorry, {line['name']} is sold out."
            else:
                message = f"Sorry, only {left} of {line['name']} left. Please lower the quantity in your cart."
            raise ApiError(message, 409)
        taken.append(line)


def release_stock(order):
    """Put the stock of a cancelled order back."""
    products = get_db().products
    for item in order.get("items") or []:
        products.update_one({"_id": item["product_id"]}, {"$inc": {"stock": item["qty"]}})


def order_lines(order):
    return [{"product_id": i["product_id"], "name": i["product_name"], "qty": i["qty"]}
            for i in order.get("items") or []]


def cart_stock_lines(lines):
    """Priced cart lines (from pricing.clean_lines) → stock lines, merging options of the same product."""
    merged = {}
    for l in lines:
        p = l["product"]
        row = merged.setdefault(p["_id"], {"product_id": p["_id"], "name": p["name"], "qty": 0})
        row["qty"] += l["qty"]
    return list(merged.values())
