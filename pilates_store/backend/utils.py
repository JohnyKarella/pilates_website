"""
utils.py — small helpers shared by all the API routes.
"""
import re
import secrets
from functools import wraps

from flask import jsonify, request, session

from pymongo.errors import DuplicateKeyError

from db import get_db

EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]{2,}$")
PHONE_RE = re.compile(r"^\+?[\d\s()-]{7,17}$")
ZIP_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9 -]{2,9}$")


class ApiError(Exception):
    """Raise anywhere in a route to send {"error": message, "fields": {...}} to the browser."""

    def __init__(self, message, status=400, fields=None):
        super().__init__(message)
        self.message, self.status, self.fields = message, status, fields or {}


def error_response(err):
    body = {"error": err.message}
    if err.fields:
        body["fields"] = err.fields
    return jsonify(body), err.status


def body():
    """The JSON the browser sent (always a dict)."""
    data = request.get_json(silent=True)
    return data if isinstance(data, dict) else {}


def text(data, key, max_len=255):
    value = data.get(key, "")
    return str(value).strip()[:max_len] if value is not None else ""


# --- Who is visiting ---------------------------------------------------------
def current_user():
    uid = session.get("uid")
    if not uid:
        return None
    user = get_db().users.find_one({"_id": uid})
    if not user:
        session.pop("uid", None)
    return user


def owner_key(create=True):
    """
    Cart and wishlist owner: "u:<id>" for a signed-in customer, otherwise
    "g:<random id>" kept in the visitor's session cookie.
    """
    user = current_user()
    if user:
        return f"u:{user['_id']}"
    gid = session.get("gid")
    if not gid and create:
        gid = secrets.token_urlsafe(16)
        session["gid"] = gid
    return f"g:{gid}" if gid else None


def login_user(user, remember=True):
    """Sign a user in, moving the guest cart and wishlist into their account."""
    guest = owner_key(create=False) if not session.get("uid") else None
    owned_orders = session.get("orders", [])
    session.clear()                         # new session = protection against session fixation
    session["uid"] = user["_id"]
    session["orders"] = owned_orders
    session.permanent = bool(remember)
    if guest:
        merge_owner(guest, f"u:{user['_id']}")


def logout_user():
    session.clear()


def merge_owner(src, dst):
    """Move a guest's cart and wishlist into the signed-in account."""
    from config import STORE
    database = get_db()
    for item in list(database.cart_items.find({"owner": src}).sort("_id", 1)):
        line = {"owner": dst, "product_id": item["product_id"], "option_key": item["option_key"]}
        existing = database.cart_items.find_one(line)
        if existing:
            database.cart_items.update_one(
                {"_id": existing["_id"]}, {"$set": {"qty": min(existing["qty"] + item["qty"], STORE["max_qty"])}})
            database.cart_items.delete_one({"_id": item["_id"]})
        else:
            database.cart_items.update_one({"_id": item["_id"]}, {"$set": {"owner": dst}})
    for wish in list(database.wishlist_items.find({"owner": src})):
        if database.wishlist_items.find_one({"owner": dst, "product_id": wish["product_id"]}):
            database.wishlist_items.delete_one({"_id": wish["_id"]})   # already saved in the account
            continue
        try:
            database.wishlist_items.update_one({"_id": wish["_id"]}, {"$set": {"owner": dst}})
        except DuplicateKeyError:
            database.wishlist_items.delete_one({"_id": wish["_id"]})


def login_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        if not current_user():
            raise ApiError("Please sign in first.", 401)
        return fn(*args, **kwargs)
    return wrapper


def admin_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        user = current_user()
        if not user:
            raise ApiError("Please sign in as an admin.", 401)
        if not user.get("is_admin"):
            raise ApiError("This area is for store admins only.", 403)
        return fn(*args, **kwargs)
    return wrapper
