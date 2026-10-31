"""
Pre-bookings (orders).

POST /api/orders                          place a pre-booking (prices are worked out here)
GET  /api/orders                          the signed-in customer's pre-bookings
GET  /api/orders/<booking_no>             one pre-booking (its owner only)
POST /api/orders/<booking_no>/cancel      cancel before dispatch

Payment: no payment gateway is connected yet, so the amount "paid now" is recorded
as paid. Plug a gateway (Razorpay, Stripe, PayU…) into `take_payment()` before going live.
"""
import secrets

from flask import Blueprint, jsonify, session

from config import CANCELLABLE, PAY_METHODS, PLANS
from db import get_db, next_id
from inventory import cart_stock_lines, release_stock, reserve_stock
from models import SAVED_FIELDS, order_dict, utcnow
from pricing import clean_lines, open_batch, totals
from utils import EMAIL_RE, PHONE_RE, ZIP_RE, ApiError, body, current_user, login_required, owner_key, text

from .cart import cart_lines

bp = Blueprint("orders", __name__, url_prefix="/api/orders")

REQUIRED = {"email": 255, "phone": 30, "name": 120, "address": 255, "city": 100, "state": 100,
            "zip": 20, "country": 80}


def validate_checkout(data):
    values = {k: text(data, k, n) for k, n in REQUIRED.items()}
    fields = {k: "This field is required." for k, v in values.items() if not v}
    if values["email"] and not EMAIL_RE.match(values["email"]):
        fields["email"] = "Enter a valid email address."
    if values["phone"] and not PHONE_RE.match(values["phone"]):
        fields["phone"] = "Enter a valid phone number."
    if values["zip"] and not ZIP_RE.match(values["zip"]):
        fields["zip"] = "Enter a valid PIN / ZIP code."
    if data.get("agree") not in (True, "on", "true", 1):
        fields["agree"] = "Please tick this box to continue."
    if fields:
        raise ApiError("Please check the highlighted fields.", 422, fields)
    values["email"] = values["email"].lower()
    return values


def new_booking_no():
    while True:
        no = f"PB-{secrets.randbelow(900000) + 100000}"
        if not get_db().orders.find_one({"booking_no": no}, {"_id": True}):
            return no


def take_payment(order):
    """
    Placeholder for a real payment gateway. Today it simply records the amount due now as paid.
    With a gateway you would create a payment here, return its checkout details to the browser,
    and mark the order paid from the gateway's webhook instead.
    """
    order["payment_status"] = "paid" if order["balance"] == 0 else "part_paid"


@bp.post("")
def place_order():
    data = body()
    details = validate_checkout(data)
    plan = data.get("plan") if data.get("plan") in PLANS else "deposit"
    pay = data.get("pay") if data.get("pay") in PAY_METHODS else PAY_METHODS[0]

    owner = owner_key()
    # The browser sends its cart so nothing is lost if a save was still on the way;
    # every price still comes from the database.
    lines = clean_lines(data["items"]) if isinstance(data.get("items"), list) else cart_lines(owner)
    if not lines:
        raise ApiError("Your cart is empty.", 400)

    # Take the stock first: if something has sold out, nothing is saved
    reserve_stock(cart_stock_lines(lines))

    database = get_db()
    try:
        t = totals(lines, plan)
        batch = open_batch()
        user = current_user()
        now = utcnow()
        order = {
            "_id": next_id("orders"), "booking_no": new_booking_no(), "user_id": user["_id"] if user else None,
            "guest_owner": None if user else owner, **details, "note": text(data, "note", 1000),
            "pay_method": pay, "plan": plan, "mrp": t["mrp"], "discount": t["discount"],
            "subtotal": t["subtotal"], "shipping": t["shipping"], "total": t["total"],
            "paid_amount": t["due"], "balance": t["balance"],
            "batch_name": batch["name"], "delivery_start": batch["start"].isoformat(),
            "delivery_end": batch["end"].isoformat(),
            "status": "booked", "payment_status": "part_paid", "created_at": now, "updated_at": now,
            "items": [{
                "product_id": l["product"]["_id"], "product_name": l["product"]["name"],
                "option_key": l["option"]["key"],
                "option_name": l["option"]["name"] if len(l["product"]["options"]) > 1 else "",
                "unit_price": l["price"], "unit_mrp": l["was"], "qty": l["qty"],
                "line_total": l["price"] * l["qty"]} for l in lines],
        }
        take_payment(order)
        database.orders.insert_one(order)
    except Exception:
        release_stock({"items": [{"product_id": s["product_id"], "qty": s["qty"]}
                                 for s in cart_stock_lines(lines)]})   # nothing was booked: give the stock back
        raise

    # Remember the delivery details for next time
    if user:
        database.users.update_one({"_id": user["_id"]}, {"$set": {k: details[k] for k in SAVED_FIELDS}})

    database.cart_items.delete_many({"owner": owner})

    session["orders"] = (session.get("orders", []) + [order["booking_no"]])[-20:]
    return jsonify(order=order_dict(order)), 201


def find_own_order(booking_no):
    order = get_db().orders.find_one({"booking_no": booking_no.upper()})
    user = current_user()
    allowed = order and (
        (user and (order.get("user_id") == user["_id"] or user.get("is_admin")))
        or order["booking_no"] in session.get("orders", [])
    )
    if not allowed:
        raise ApiError("Pre-booking not found.", 404)
    return order


@bp.get("")
@login_required
def my_orders():
    user = current_user()
    orders = get_db().orders.find({"user_id": user["_id"]}).sort("created_at", -1)
    return jsonify(orders=[order_dict(o) for o in orders])


@bp.get("/<booking_no>")
def one_order(booking_no):
    return jsonify(order=order_dict(find_own_order(booking_no)))


@bp.post("/<booking_no>/cancel")
def cancel(booking_no):
    order = find_own_order(booking_no)
    if order["status"] not in CANCELLABLE:
        raise ApiError("This pre-booking has already been dispatched and can no longer be cancelled.", 409)
    payment = "refund_due" if order["paid_amount"] > 0 else order["payment_status"]
    # Only one cancel can win, so a double click cannot give the stock back twice
    result = get_db().orders.update_one(
        {"_id": order["_id"], "status": {"$in": CANCELLABLE}},
        {"$set": {"status": "cancelled", "payment_status": payment, "updated_at": utcnow()}})
    if result.modified_count:
        release_stock(order)   # the units can be booked by someone else again
    return jsonify(order=order_dict(get_db().orders.find_one({"_id": order["_id"]})))
