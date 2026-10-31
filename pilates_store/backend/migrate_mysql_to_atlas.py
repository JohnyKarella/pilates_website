"""
migrate_mysql_to_atlas.py — copy every product, customer, order, cart, wishlist, subscriber,
testimonial and FAQ from your old MySQL Workbench database into MongoDB Atlas.

Run ONCE inside the backend folder, with MySQL still running:
    python migrate_mysql_to_atlas.py

- Reads from:  DATABASE_URL in backend/.env   (your MySQL database)
- Writes to:   MONGO_URI + MONGO_DB in backend/.env   (Atlas, database "pilates_db")

The Atlas database is emptied first and then filled with the MySQL data, so you can run it
again if something went wrong. Customers keep their passwords, and orders keep their booking numbers.

Needs the MySQL packages the old version used (already in your .venv). If they are missing:
    pip install SQLAlchemy PyMySQL cryptography
"""
import json
import sys
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path

from dotenv import dotenv_values
from pymongo import MongoClient

try:
    from sqlalchemy import create_engine, inspect, text
except ImportError:
    sys.exit("SQLAlchemy is not installed. Run:  pip install SQLAlchemy PyMySQL cryptography")

ENV = dotenv_values(Path(__file__).resolve().parent / ".env")
MYSQL_URL = (ENV.get("DATABASE_URL") or "").strip()
ATLAS_URI = (ENV.get("MONGO_URI") or "").strip()
DB_NAME = (ENV.get("MONGO_DB") or "pilates_db").strip() or "pilates_db"

DATETIME_COLUMNS = {"created_at", "updated_at", "expires_at"}

TARGET = ["users", "password_resets", "products", "cart_items", "wishlist_items", "orders",
          "subscribers", "testimonials", "faqs", "counters"]


def clean(value, column=""):
    """MySQL values → MongoDB values."""
    if column in DATETIME_COLUMNS and isinstance(value, str) and value:
        try:
            return datetime.fromisoformat(value.replace("Z", "")).replace(tzinfo=None)
        except ValueError:
            return value
    if isinstance(value, Decimal):
        return int(value) if value == value.to_integral_value() else float(value)
    if isinstance(value, datetime):
        return value.replace(tzinfo=None)
    if isinstance(value, date):
        return value.isoformat()
    return value


def as_list(value):
    if value in (None, ""):
        return []
    if isinstance(value, (bytes, bytearray)):
        value = value.decode("utf-8")
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except ValueError:
            return []
    return value if isinstance(value, list) else []


def rows(conn, tables, name, order_by="id"):
    if name not in tables:
        print(f"  (no {name} table in MySQL, skipped)")
        return []
    sql = f"SELECT * FROM {name}" + (f" ORDER BY {order_by}" if order_by else "")
    return [{k: clean(v, k) for k, v in r.items()} for r in conn.execute(text(sql)).mappings()]


def main():
    if not MYSQL_URL:
        sys.exit("DATABASE_URL (your MySQL address) is missing in backend/.env.")
    if not ATLAS_URI.startswith("mongodb+srv://"):
        sys.exit("MONGO_URI in backend/.env must be your Atlas connection string (mongodb+srv://...).")

    engine = create_engine(MYSQL_URL)
    try:
        conn = engine.connect()
    except Exception as exc:
        sys.exit(f"Cannot reach MySQL. Start MySQL and check DATABASE_URL in backend/.env.\n{exc}")

    client = MongoClient(ATLAS_URI, serverSelectionTimeoutMS=10000)
    try:
        client.admin.command("ping")
    except Exception as exc:
        sys.exit(f"Cannot reach Atlas. Check the password in MONGO_URI and your IP in Network Access.\n{exc}")
    atlas = client[DB_NAME]

    print(f"From MySQL: {engine.url.render_as_string(hide_password=True)}")
    print(f"To Atlas:   {ATLAS_URI.split('@')[-1]}  database '{DB_NAME}'")
    if "--yes" not in sys.argv:
        answer = input(f"\nThis replaces everything in Atlas database '{DB_NAME}' with the MySQL data. "
                       "Type yes to continue: ")
        if answer.strip().lower() != "yes":
            sys.exit("Stopped. Nothing was changed.")

    with conn:
        tables = set(inspect(conn).get_table_names())

        # Products, with their options inside
        options = {}
        for o in rows(conn, tables, "product_options", "product_id, sort_order, id"):
            options.setdefault(o["product_id"], []).append({
                "key": o["key"], "name": o["name"], "note": o.get("note") or "", "price": o["price"],
                "was": o.get("was"), "best": bool(o.get("best"))})
        products = []
        for p in rows(conn, tables, "products", "sort_order"):
            products.append({
                "_id": p["id"], "kind": p.get("kind") or "product", "name": p["name"], "category": p["category"],
                "filter": p.get("filter"), "price": p["price"], "was": p.get("was"),
                "stock": p["stock"] if p.get("stock") is not None else 50,
                "rating": float(p.get("rating") or 0), "reviews": p.get("reviews") or 0, "badge": p.get("badge") or "",
                "art": p.get("art"), "tone": p.get("tone"), "description": p.get("description") or "",
                "photo": p.get("photo"), "fallback": p.get("fallback"), "hover": p.get("hover"),
                "cut": bool(p.get("cut")), "specs": as_list(p.get("specs")), "gallery": as_list(p.get("gallery")),
                "bundle_items": as_list(p.get("bundle_items")), "is_active": bool(p.get("is_active", True)),
                "sort_order": p.get("sort_order") or 0, "updated_at": p.get("updated_at"),
                "options": options.get(p["id"], []),
            })

        users = [{**{k: v for k, v in u.items() if k != "id"}, "_id": u["id"], "is_admin": bool(u.get("is_admin"))}
                 for u in rows(conn, tables, "users")]
        resets = [{"_id": r["id"], "user_id": r["user_id"], "token_hash": r["token_hash"],
                   "expires_at": r["expires_at"], "used": bool(r.get("used"))}
                  for r in rows(conn, tables, "password_resets")]

        # Orders, with their lines inside
        lines = {}
        for i in rows(conn, tables, "order_items", "order_id, id"):
            lines.setdefault(i["order_id"], []).append({
                "product_id": i["product_id"], "product_name": i["product_name"], "option_key": i["option_key"],
                "option_name": i.get("option_name") or "", "unit_price": i["unit_price"],
                "unit_mrp": i["unit_mrp"], "qty": i["qty"], "line_total": i["line_total"]})
        orders = [{**{k: v for k, v in o.items() if k != "id"}, "_id": o["id"], "items": lines.get(o["id"], [])}
                  for o in rows(conn, tables, "orders")]

        cart = [{"owner": c["owner"], "product_id": c["product_id"], "option_key": c["option_key"],
                 "qty": c["qty"], "updated_at": c.get("updated_at")} for c in rows(conn, tables, "cart_items")]
        wishes = [{"owner": w["owner"], "product_id": w["product_id"], "created_at": w.get("created_at")}
                  for w in rows(conn, tables, "wishlist_items")]
        subscribers = [{"_id": s["id"], "email": s["email"], "created_at": s.get("created_at")}
                       for s in rows(conn, tables, "subscribers")]
        testimonials = [{"quote": t["quote"], "name": t["name"], "role": t.get("role") or "",
                         "product": t.get("product") or "", "sort_order": t.get("sort_order") or 0}
                        for t in rows(conn, tables, "testimonials", "sort_order, id")]
        faqs = [{"question": f["question"], "answer": f["answer"], "sort_order": f.get("sort_order") or 0}
                for f in rows(conn, tables, "faqs", "sort_order, id")]
    engine.dispose()

    data = {"users": users, "password_resets": resets, "products": products, "cart_items": cart,
            "wishlist_items": wishes, "orders": orders, "subscribers": subscribers,
            "testimonials": testimonials, "faqs": faqs}

    for name in TARGET:
        atlas.drop_collection(name)
    print()
    for name, docs in data.items():
        if docs:
            atlas[name].insert_many(docs)
        print(f"  {name:<16} {len(docs):>5} copied")
    # New ids continue after the highest MySQL id
    for name in ("users", "orders", "subscribers", "password_resets"):
        top = max((d["_id"] for d in data[name]), default=0)
        atlas.counters.insert_one({"_id": name, "seq": top})

    print("\nDone. Start the site with:  python app.py")
    print("(app.py creates the indexes and, if no admin exists, the admin account from .env)")


if __name__ == "__main__":
    main()
