"""
seed.py — fills an empty database with the store's products, bundles,
testimonials and FAQs (from seed_data.json) and creates the first admin.

Runs automatically the first time the app starts. To start again from scratch:
    flask --app app init-db --reset
"""
import json
from pathlib import Path

from flask import current_app

from db import get_db, next_id
from models import hash_password, utcnow
from pricing import default_options

SEED_FILE = Path(__file__).resolve().parent / "seed_data.json"


def seed_catalogue():
    database = get_db()
    data = json.loads(SEED_FILE.read_text(encoding="utf-8"))
    catalogue = {p["id"]: p for p in data["products"] + data["bundles"]}

    docs = []
    for n, p in enumerate(data["products"] + data["bundles"]):
        bundle = bool(p.get("items"))
        options = []
        for o in p.get("options") or default_options(p, catalogue):
            options.append({
                "key": o["key"], "name": o["name"], "note": o.get("note", ""), "price": o["price"],
                "was": o.get("was") if (o.get("was") or 0) > o["price"] else None, "best": o.get("best", False)})
        docs.append({
            "_id": p["id"], "kind": "bundle" if bundle else "product", "name": p["name"], "category": p["category"],
            "filter": p.get("filter"), "price": p["price"], "was": p.get("was"), "stock": p.get("stock", 50),
            "rating": p.get("rating", 0), "reviews": p.get("reviews", 0), "badge": p.get("badge", ""),
            "art": p.get("art"), "tone": p.get("tone"), "description": p.get("description", ""),
            "photo": p.get("photo"), "fallback": p.get("fallback"), "hover": p.get("hover"),
            "cut": p.get("cut", False),
            "specs": [catalogue[i]["name"] for i in p["items"]] if bundle else p.get("specs", []),
            "gallery": p.get("more", []), "bundle_items": p.get("items", []), "is_active": True,
            "sort_order": n, "updated_at": utcnow(), "options": options,
        })
    database.products.insert_many(docs)
    database.testimonials.insert_many([{"sort_order": n, **t} for n, t in enumerate(data["testimonials"])])
    database.faqs.insert_many([{"question": f["q"], "answer": f["a"], "sort_order": n}
                               for n, f in enumerate(data["faqs"])])


def ensure_admin():
    users = get_db().users
    if users.find_one({"is_admin": True}):
        return
    cfg = current_app.config
    email = cfg["ADMIN_EMAIL"].lower()
    if users.find_one({"email": email}):
        users.update_one({"email": email}, {"$set": {"is_admin": True,
                                                     "password_hash": hash_password(cfg["ADMIN_PASSWORD"])}})
    else:
        users.insert_one({"_id": next_id("users"), "name": cfg["ADMIN_NAME"], "email": email,
                          "password_hash": hash_password(cfg["ADMIN_PASSWORD"]), "is_admin": True,
                          "created_at": utcnow()})
    current_app.logger.warning("Admin account created: %s (change the password in .env before going live)", email)


def seed_if_empty():
    if get_db().products.find_one({}, {"_id": True}) is None:
        seed_catalogue()
    ensure_admin()
