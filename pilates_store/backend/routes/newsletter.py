"""
Newsletter sign-up.

POST /api/newsletter    {"email"}
"""
from flask import Blueprint, jsonify

from pymongo.errors import DuplicateKeyError

from db import get_db, next_id
from models import utcnow
from utils import EMAIL_RE, ApiError, body, text

bp = Blueprint("newsletter", __name__, url_prefix="/api")


@bp.post("/newsletter")
def subscribe():
    email = text(body(), "email").lower()
    if not EMAIL_RE.match(email):
        raise ApiError("Please enter a valid email address.", 422, {"email": "Please enter a valid email address."})
    subscribers = get_db().subscribers
    if subscribers.find_one({"email": email}):
        return jsonify(message="You’re already on the list. Thank you!", created=False)
    try:
        subscribers.insert_one({"_id": next_id("subscribers"), "email": email, "created_at": utcnow()})
    except DuplicateKeyError:
        return jsonify(message="You’re already on the list. Thank you!", created=False)
    return jsonify(message="You’re in. Look out for your first note from us soon.", created=True), 201
