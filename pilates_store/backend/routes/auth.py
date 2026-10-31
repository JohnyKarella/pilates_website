"""
Customer accounts.

POST /api/auth/signup     {"name", "email", "password"}            create an account and sign in
POST /api/auth/login      {"email", "password", "remember"}        sign in
POST /api/auth/logout                                              sign out
GET  /api/auth/me                                                  the signed-in user (or null)
POST /api/auth/forgot     {"email"}                                start a password reset
POST /api/auth/reset      {"token", "password"}                    choose a new password

Sign-up and sign-in return the user plus their cart and wishlist, because a guest's
cart is moved into the account the moment they sign in.
"""
import hashlib
import secrets
from datetime import timedelta

from flask import Blueprint, current_app, jsonify

from pymongo.errors import DuplicateKeyError

from db import get_db, next_id
from models import hash_password, check_password, user_dict, utcnow
from utils import EMAIL_RE, ApiError, body, current_user, login_user, logout_user, owner_key, text

from .cart import cart_json, wishlist_json

bp = Blueprint("auth", __name__, url_prefix="/api/auth")

MIN_PASSWORD = 8


def session_payload(user):
    owner = owner_key(create=False)
    return jsonify(user=user_dict(user) if user else None, cart=cart_json(owner), wishlist=wishlist_json(owner))


@bp.post("/signup")
def signup():
    data = body()
    name, email, password = text(data, "name", 120), text(data, "email").lower(), str(data.get("password", ""))
    fields = {}
    if not name:
        fields["name"] = "This field is required."
    if not EMAIL_RE.match(email):
        fields["email"] = "Enter a valid email address."
    if len(password) < MIN_PASSWORD:
        fields["password"] = f"Use at least {MIN_PASSWORD} characters."
    if fields:
        raise ApiError("Please check the highlighted fields.", 422, fields)
    taken = ApiError("An account with this email already exists.", 409,
                     {"email": "An account with this email already exists. Try signing in."})
    users = get_db().users
    if users.find_one({"email": email}):
        raise taken
    user = {"_id": next_id("users"), "name": name, "email": email, "password_hash": hash_password(password),
            "is_admin": False, "created_at": utcnow()}
    try:
        users.insert_one(user)
    except DuplicateKeyError:   # the same email was signed up a moment ago
        raise taken
    login_user(user, remember=True)
    return session_payload(user), 201


@bp.post("/login")
def login():
    data = body()
    email, password = text(data, "email").lower(), str(data.get("password", ""))
    user = get_db().users.find_one({"email": email})
    if not check_password(user, password):
        # Same message whether the email or the password is wrong
        raise ApiError("Email or password is incorrect.", 401, {"password": "Email or password is incorrect."})
    login_user(user, remember=data.get("remember", True) is not False)
    return session_payload(user)


@bp.post("/logout")
def logout():
    logout_user()
    return session_payload(None)


@bp.get("/me")
def me():
    return session_payload(current_user())


@bp.post("/forgot")
def forgot():
    email = text(body(), "email").lower()
    if not EMAIL_RE.match(email):
        raise ApiError("Enter the email address you signed up with.", 422,
                       {"email": "Enter a valid email address."})
    user = get_db().users.find_one({"email": email})
    if user:
        token = secrets.token_urlsafe(32)
        get_db().password_resets.insert_one({
            "_id": next_id("password_resets"), "user_id": user["_id"],
            "token_hash": hashlib.sha256(token.encode()).hexdigest(),
            "expires_at": utcnow() + timedelta(hours=1), "used": False})
        link = f"{current_app.config['SITE_URL']}/reset-password.html?token={token}"
        # No email service is connected yet, so the link is written to the server console.
        # Connect an email provider in send_reset_email() to send it to the customer.
        send_reset_email(user, link)
    # Same answer whether or not the account exists, so emails cannot be guessed
    return jsonify(message="If an account exists for that email, a reset link is on its way. It works for 1 hour.")


def send_reset_email(user, link):
    current_app.logger.warning("Password reset link for %s: %s", user["email"], link)


@bp.post("/reset")
def reset():
    data = body()
    token, password = text(data, "token", 200), str(data.get("password", ""))
    if len(password) < MIN_PASSWORD:
        raise ApiError(f"Use at least {MIN_PASSWORD} characters.", 422,
                       {"password": f"Use at least {MIN_PASSWORD} characters."})
    database = get_db()
    expired = ApiError("This reset link has expired. Ask for a new one from the sign-in window.", 400)
    # Mark the link used in the same step that checks it, so it can only ever work once
    row = database.password_resets.find_one_and_update(
        {"token_hash": hashlib.sha256(token.encode()).hexdigest(), "used": False, "expires_at": {"$gte": utcnow()}},
        {"$set": {"used": True}})
    user = database.users.find_one({"_id": row["user_id"]}) if row else None
    if not user:
        raise expired
    database.users.update_one({"_id": user["_id"]}, {"$set": {"password_hash": hash_password(password)}})
    login_user(user, remember=True)
    return session_payload(user)
