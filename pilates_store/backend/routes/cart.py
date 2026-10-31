"""
Cart and wishlist.

GET    /api/cart                 the visitor's cart with totals
PUT    /api/cart                 replace the whole cart   {"items": [{"id", "option", "qty"}], "plan"?}
DELETE /api/cart                 empty the cart
GET    /api/wishlist             list of saved product ids
PUT    /api/wishlist/<id>        save a product
DELETE /api/wishlist/<id>        remove a product
"""
from flask import Blueprint, jsonify

from pymongo.errors import DuplicateKeyError

from db import get_db
from models import utcnow
from pricing import clean_lines, lines_to_json, totals
from utils import ApiError, body, owner_key

bp = Blueprint("cart", __name__, url_prefix="/api")


def cart_lines(owner):
    rows = list(get_db().cart_items.find({"owner": owner}).sort("_id", 1)) if owner else []
    return clean_lines([{"id": r["product_id"], "option": r["option_key"], "qty": r["qty"]} for r in rows])


def cart_json(owner):
    return lines_to_json(cart_lines(owner))


def wishlist_json(owner):
    if not owner:
        return []
    database = get_db()
    rows = list(database.wishlist_items.find({"owner": owner}).sort("_id", 1))
    live = {p["_id"] for p in database.products.find(
        {"_id": {"$in": [r["product_id"] for r in rows]}, "is_active": True}, {"_id": True})}
    return [r["product_id"] for r in rows if r["product_id"] in live]


def save_cart(owner, lines):
    cart = get_db().cart_items
    cart.delete_many({"owner": owner})
    if lines:
        cart.insert_many([{"owner": owner, "product_id": l["product"]["_id"], "option_key": l["option"]["key"],
                           "qty": l["qty"], "updated_at": utcnow()} for l in lines])


@bp.get("/cart")
def get_cart():
    lines = cart_lines(owner_key(create=False))
    return jsonify(items=lines_to_json(lines), totals=totals(lines))


@bp.put("/cart")
def put_cart():
    data = body()
    items = data.get("items")
    if not isinstance(items, list):
        raise ApiError("Send the cart as {\"items\": [...]}.")
    lines = clean_lines(items)
    save_cart(owner_key(), lines)
    plan = "full" if data.get("plan") == "full" else "deposit"
    return jsonify(items=lines_to_json(lines), totals=totals(lines, plan))


@bp.delete("/cart")
def clear_cart():
    owner = owner_key(create=False)
    if owner:
        get_db().cart_items.delete_many({"owner": owner})
    return jsonify(items=[], totals=totals([]))


@bp.get("/wishlist")
def get_wishlist():
    return jsonify(items=wishlist_json(owner_key(create=False)))


@bp.put("/wishlist/<product_id>")
def add_wish(product_id):
    product = get_db().products.find_one({"_id": product_id})
    if not product or not product.get("is_active", True):
        raise ApiError("Product not found.", 404)
    owner = owner_key()
    if not get_db().wishlist_items.find_one({"owner": owner, "product_id": product_id}):
        try:
            get_db().wishlist_items.insert_one({"owner": owner, "product_id": product_id, "created_at": utcnow()})
        except DuplicateKeyError:   # a double click saved it a moment ago
            pass
    return jsonify(items=wishlist_json(owner))


@bp.delete("/wishlist/<product_id>")
def remove_wish(product_id):
    owner = owner_key(create=False)
    if owner:
        get_db().wishlist_items.delete_many({"owner": owner, "product_id": product_id})
    return jsonify(items=wishlist_json(owner))
