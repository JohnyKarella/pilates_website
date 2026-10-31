"""
Admin API (store owner only — the user must have is_admin = True). Used by /admin.

GET   /api/admin/stats                        numbers for the dashboard
GET   /api/admin/orders                       ?status=booked  ?q=PB-123 / name / email
GET   /api/admin/orders.csv                   download every order as a spreadsheet
GET   /api/admin/orders/<booking_no>          one order
PATCH /api/admin/orders/<booking_no>          {"status", "payment_status"}
GET   /api/admin/products                     every product and bundle (also hidden ones)
PATCH /api/admin/products/<id>                {"name", "badge", "description", "is_active", "stock", "options": [{key, price, was}]}
GET   /api/admin/customers                    customers with order counts
GET   /api/admin/subscribers                  newsletter list
"""
import csv
import io
import re

from flask import Blueprint, Response, jsonify, request

from config import ORDER_STATUSES, PAYMENT_STATUSES
from db import get_db
from inventory import order_lines, release_stock, reserve_stock
from models import iso, option_of, order_dict, product_dict, user_dict, utcnow
from utils import ApiError, admin_required, body, text

bp = Blueprint("admin", __name__, url_prefix="/api/admin")

LIVE = {"status": {"$ne": "cancelled"}}


def money_sums(match):
    rows = list(get_db().orders.aggregate([
        {"$match": match},
        {"$group": {"_id": None, "total": {"$sum": "$total"}, "paid": {"$sum": "$paid_amount"},
                    "balance": {"$sum": "$balance"}}},
    ]))
    return rows[0] if rows else {"total": 0, "paid": 0, "balance": 0}


@bp.get("/stats")
@admin_required
def stats():
    database = get_db()
    by_status = {r["_id"]: r["n"] for r in database.orders.aggregate(
        [{"$group": {"_id": "$status", "n": {"$sum": 1}}}])}
    sums = money_sums(LIVE)
    return jsonify(
        orders=database.orders.count_documents({}),
        open_orders=database.orders.count_documents({"status": {"$in": ["booked", "in_production"]}}),
        booked_value=int(sums["total"]),
        collected=int(sums["paid"]),
        balance_due=int(sums["balance"]),
        customers=database.users.count_documents({"is_admin": {"$ne": True}}),
        subscribers=database.subscribers.count_documents({}),
        by_status={s: by_status.get(s, 0) for s in ORDER_STATUSES},
    )


def order_query():
    query = {}
    status = request.args.get("status")
    if status in ORDER_STATUSES:
        query["status"] = status
    q = request.args.get("q", "").strip()
    if q:
        like = {"$regex": re.escape(q), "$options": "i"}
        query["$or"] = [{field: like} for field in ("booking_no", "name", "email", "phone", "city")]
    return get_db().orders.find(query).sort("created_at", -1)


@bp.get("/orders")
@admin_required
def orders():
    return jsonify(orders=[order_dict(o) for o in order_query().limit(500)])


@bp.get("/orders.csv")
@admin_required
def orders_csv():
    out = io.StringIO()
    w = csv.writer(out)
    w.writerow(["Booking", "Date (UTC)", "Status", "Payment", "Name", "Email", "Phone", "Address", "City", "State",
                "PIN", "Country", "Items", "Total", "Paid", "Balance", "Plan", "Method", "Batch", "Note"])
    for o in order_query():
        w.writerow([o["booking_no"], iso(o.get("created_at")), o["status"], o["payment_status"], o["name"],
                    o["email"], o["phone"], o["address"], o["city"], o["state"], o["zip"], o["country"],
                    "; ".join(f"{i['qty']} x {i['product_name']}"
                              f"{' (' + i['option_name'] + ')' if i.get('option_name') else ''}"
                              for i in o.get("items") or []),
                    o["total"], o["paid_amount"], o["balance"], o["plan"], o["pay_method"], o["batch_name"],
                    o.get("note") or ""])
    return Response(out.getvalue(), mimetype="text/csv",
                    headers={"Content-Disposition": "attachment; filename=pilates-orders.csv"})


def get_order(booking_no):
    order = get_db().orders.find_one({"booking_no": booking_no.upper()})
    if not order:
        raise ApiError("Order not found.", 404)
    return order


@bp.get("/orders/<booking_no>")
@admin_required
def order(booking_no):
    return jsonify(order=order_dict(get_order(booking_no)))


@bp.patch("/orders/<booking_no>")
@admin_required
def update_order(booking_no):
    order, data = get_order(booking_no), body()
    changes = {}
    if "payment_status" in data and data["payment_status"] not in PAYMENT_STATUSES:
        raise ApiError("Unknown payment status.")
    if "status" in data:
        if data["status"] not in ORDER_STATUSES:
            raise ApiError("Unknown order status.")
        # Cancelling gives the stock back; un-cancelling takes it again
        if data["status"] == "cancelled" and order["status"] != "cancelled":
            release_stock(order)
        elif data["status"] != "cancelled" and order["status"] == "cancelled":
            reserve_stock(order_lines(order))
        changes["status"] = data["status"]
    if "payment_status" in data:
        changes["payment_status"] = data["payment_status"]
        if data["payment_status"] == "paid":       # balance received
            changes["paid_amount"], changes["balance"] = order["total"], 0
        elif data["payment_status"] == "refunded":
            changes["balance"] = 0
    if changes:
        changes["updated_at"] = utcnow()
        get_db().orders.update_one({"_id": order["_id"]}, {"$set": changes})
    return jsonify(order=order_dict(get_db().orders.find_one({"_id": order["_id"]})))


@bp.get("/products")
@admin_required
def products():
    items = get_db().products.find().sort([("kind", -1), ("sort_order", 1)])
    return jsonify(products=[product_dict(p, admin=True) for p in items])


@bp.patch("/products/<product_id>")
@admin_required
def update_product(product_id):
    product, data = get_db().products.find_one({"_id": product_id}), body()
    if not product:
        raise ApiError("Product not found.", 404)
    changes = {}
    for key, n in (("name", 160), ("badge", 60), ("category", 80)):
        if key in data:
            value = text(data, key, n)
            if key != "badge" and not value:
                raise ApiError(f"{key.title()} cannot be empty.", 422)
            changes[key] = value
    if "description" in data:
        changes["description"] = text(data, "description", 2000)
    if "is_active" in data:
        changes["is_active"] = bool(data["is_active"])
    if "stock" in data:
        try:
            stock = int(data["stock"])
        except (TypeError, ValueError):
            raise ApiError("Stock must be a whole number.", 422)
        if stock < 0:
            raise ApiError("Stock cannot be below 0.", 422)
        changes["stock"] = stock
    options = [dict(o) for o in product.get("options") or []]
    for change in data.get("options", []) or []:
        option = option_of({"options": options}, str(change.get("key")))
        if not option:
            raise ApiError(f"Unknown option {change.get('key')!r}.", 422)
        try:
            price = int(change.get("price", option["price"]))
            was = int(change["was"]) if change.get("was") not in (None, "") else None
        except (TypeError, ValueError):
            raise ApiError("Prices must be whole rupees.", 422)
        if price <= 0:
            raise ApiError("Price must be more than 0.", 422)
        option["price"], option["was"] = price, (was if was and was > price else None)
        changes["options"] = options
    # The card price is the first option's price
    if options:
        first = options[0]
        changes["price"] = first["price"]
        changes["was"] = first["was"] if first.get("was") and first["was"] > first["price"] else None
    changes["updated_at"] = utcnow()
    get_db().products.update_one({"_id": product_id}, {"$set": changes})
    return jsonify(product=product_dict(get_db().products.find_one({"_id": product_id}), admin=True))


@bp.get("/customers")
@admin_required
def customers():
    database = get_db()
    per_user = {r["_id"]: r for r in database.orders.aggregate([
        {"$match": {"user_id": {"$ne": None}}},
        {"$group": {"_id": "$user_id", "n": {"$sum": 1}, "spent": {"$sum": "$total"}}},
    ])}
    rows = []
    for u in database.users.find().sort("created_at", -1):
        stats = per_user.get(u["_id"], {})
        rows.append({**user_dict(u), "created_at": iso(u.get("created_at")),
                     "orders": stats.get("n", 0), "spent": int(stats.get("spent", 0))})
    return jsonify(customers=rows)


@bp.get("/subscribers")
@admin_required
def subscribers():
    rows = get_db().subscribers.find().sort("created_at", -1)
    return jsonify(subscribers=[{"email": s["email"], "created_at": iso(s.get("created_at"))} for s in rows])
