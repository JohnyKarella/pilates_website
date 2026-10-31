"""
db.py — the MongoDB Atlas connection, collections and indexes.

Collections (database "pilates_db"):
    users            customers and admins (password hashes, saved delivery details)
    password_resets  one-hour reset links
    products         products and bundles, each with its "Choose your setup" options inside
    cart_items       one row per cart line ("owner" = "u:<user id>" or "g:<guest id>")
    wishlist_items   saved products
    orders           pre-bookings, each with its order lines inside
    subscribers      newsletter list
    testimonials     home page quotes
    faqs             questions and answers
    counters         running numbers for user / order ids
"""
from flask import current_app
from pymongo import ASCENDING, DESCENDING, MongoClient, ReturnDocument

# Collections whose _id is a whole number (1, 2, 3 ...), like the old MySQL ids
NUMBERED = ("users", "orders", "subscribers", "password_resets")


def init_db(app, client=None):
    """Connect to MongoDB Atlas. Tests pass an in-memory client instead."""
    if client is None:
        uri = app.config["MONGO_URI"]
        if not uri.startswith("mongodb+srv://"):
            raise RuntimeError("MONGO_URI must be your MongoDB Atlas connection string "
                               "(mongodb+srv://...). Set it in backend/.env.")
        client = MongoClient(uri, serverSelectionTimeoutMS=8000)
    database = client[app.config["MONGO_DB"]]
    app.extensions["mongo_client"] = client
    app.extensions["mongo_db"] = database
    ensure_indexes(database)
    sync_counters(database)
    return database


def get_db():
    return current_app.extensions["mongo_db"]


def ensure_indexes(database):
    database.users.create_index([("email", ASCENDING)], unique=True)
    database.password_resets.create_index([("token_hash", ASCENDING)], unique=True)
    database.products.create_index([("kind", ASCENDING), ("sort_order", ASCENDING)])
    database.cart_items.create_index(
        [("owner", ASCENDING), ("product_id", ASCENDING), ("option_key", ASCENDING)], unique=True)
    database.wishlist_items.create_index([("owner", ASCENDING), ("product_id", ASCENDING)], unique=True)
    database.orders.create_index([("booking_no", ASCENDING)], unique=True)
    database.orders.create_index([("user_id", ASCENDING), ("created_at", DESCENDING)])
    database.orders.create_index([("created_at", DESCENDING)])
    database.orders.create_index([("email", ASCENDING)])
    database.subscribers.create_index([("email", ASCENDING)], unique=True)


def sync_counters(database):
    """Make sure each counter is at least the highest id already saved (e.g. after copying data in)."""
    for name in NUMBERED:
        top = database[name].find_one({}, sort=[("_id", DESCENDING)], projection={"_id": True})
        if top and isinstance(top["_id"], int):
            database.counters.update_one({"_id": name}, {"$max": {"seq": top["_id"]}}, upsert=True)


def next_id(name):
    """Next whole-number id for a collection (safe when two requests arrive at once)."""
    doc = get_db().counters.find_one_and_update(
        {"_id": name}, {"$inc": {"seq": 1}}, upsert=True, return_document=ReturnDocument.AFTER)
    return doc["seq"]
