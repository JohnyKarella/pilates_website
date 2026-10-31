"""
Catalogue and page data.

GET /api/bootstrap          everything a page needs on load: settings, products, bundles,
                            testimonials, FAQs, the signed-in user, cart and wishlist
GET /api/settings           store rules (shipping, delivery weeks, booking share)
GET /api/products           all products   ?q=ball  ?filter=yoga  ?sort=low|high|rating
GET /api/products/<id>      one product or bundle
"""
from flask import Blueprint, jsonify, request

from config import STORE
from db import get_db
from models import faq_dict, product_dict, testimonial_dict, user_dict
from pricing import open_batch
from utils import ApiError, current_user, owner_key

from .cart import cart_json, wishlist_json

bp = Blueprint("catalog", __name__, url_prefix="/api")


def settings_json():
    batch = open_batch()
    return {**STORE, "open_batch": {"name": batch["name"], "start": batch["start"].isoformat(),
                                     "end": batch["end"].isoformat()}}


def active(kind):
    return list(get_db().products.find({"kind": kind, "is_active": True}).sort([("sort_order", 1), ("name", 1)]))


@bp.get("/bootstrap")
def bootstrap():
    user = current_user()
    owner = owner_key(create=False)
    return jsonify(
        settings=settings_json(),
        products=[product_dict(p) for p in active("product")],
        # A bundle is only shown while every piece in it is on sale
        bundles=[product_dict(b) for b in active("bundle") if all_active(b.get("bundle_items"))],
        testimonials=[testimonial_dict(t) for t in get_db().testimonials.find().sort("sort_order", 1)],
        faqs=[faq_dict(f) for f in get_db().faqs.find().sort("sort_order", 1)],
        user=user_dict(user) if user else None,
        cart=cart_json(owner),
        wishlist=wishlist_json(owner),
    )


def all_active(ids):
    if not ids:
        return False
    return get_db().products.count_documents({"_id": {"$in": list(set(ids))}, "is_active": True}) == len(set(ids))


@bp.get("/settings")
def settings():
    return jsonify(settings_json())


@bp.get("/products")
def products():
    items = active("product")
    q = request.args.get("q", "").strip().lower()
    if q:
        words = q.split()
        items = [p for p in items
                 if all(w in f"{p['name']} {p['category']} {p.get('filter')} {p.get('description')}".lower()
                        for w in words)]
    flt = request.args.get("filter")
    if flt and flt != "all":
        items = [p for p in items if p.get("filter") == flt]
    sort = request.args.get("sort")
    if sort == "low":
        items.sort(key=lambda p: p["price"])
    elif sort == "high":
        items.sort(key=lambda p: -p["price"])
    elif sort == "rating":
        items.sort(key=lambda p: (-(p.get("rating") or 0), -(p.get("reviews") or 0)))
    return jsonify(products=[product_dict(p) for p in items])


@bp.get("/products/<product_id>")
def product(product_id):
    p = get_db().products.find_one({"_id": product_id})
    if not p or not p.get("is_active", True):
        raise ApiError("Product not found.", 404)
    return jsonify(product=product_dict(p))
