"""
app.py — starts the Pilates store: the Python API and the HTML/CSS/JS website together.

Run it:
    python app.py
Then open http://127.0.0.1:5000          (the shop)
          http://127.0.0.1:5000/admin    (the admin dashboard)

Database: MongoDB Atlas (MONGO_URI and MONGO_DB in backend/.env).

Useful commands (run inside the backend folder):
    python check_atlas.py                check the Atlas connection and count the documents
    flask --app app init-db --reset      delete everything and load the starting products again
    flask --app app create-admin         add or update an admin account
"""
import os

import click
from flask import Flask, jsonify, request, send_from_directory
from pymongo.errors import PyMongoError
from werkzeug.exceptions import HTTPException

from config import Config
from db import get_db, init_db, next_id
from models import hash_password, utcnow
from routes import all_blueprints
from seed import seed_if_empty
from utils import ApiError, error_response


def create_app(config=Config, mongo_client=None):
    frontend = str(config.FRONTEND_DIR)
    # The frontend folder is served as the website: /index.html, /css/style.css, /images/...
    app = Flask(__name__, static_folder=frontend, static_url_path="")
    app.config.from_object(config)

    # ---- Database: connect to MongoDB Atlas and fill an empty database --------
    try:
        init_db(app, mongo_client)
        with app.app_context():
            seed_if_empty()
    except (RuntimeError, PyMongoError) as err:
        raise SystemExit(
            f"\nCannot use MongoDB Atlas: {err}\n\nCheck MONGO_URI (password) in backend/.env and that your "
            "IP address is allowed in Atlas > Network Access.\n")

    for bp in all_blueprints:
        app.register_blueprint(bp)

    # ---- Pages -----------------------------------------------------------
    @app.get("/")
    def home():
        return send_from_directory(frontend, "index.html")

    @app.get("/admin")
    def admin_page():
        return send_from_directory(frontend, "admin.html")

    @app.get("/api/health")
    def health():
        app.extensions["mongo_client"].admin.command("ping")
        return jsonify(ok=True, database=app.config["MONGO_DB"])

    # ---- Safety checks for the API ----------------------------------------
    @app.before_request
    def json_only_writes():
        # Changes must be sent as JSON. Browsers cannot send JSON to another site
        # without permission, which protects signed-in customers from forged requests (CSRF).
        if request.path.startswith("/api/") and request.method in ("POST", "PUT", "PATCH", "DELETE"):
            if request.content_length and not request.is_json:
                return jsonify(error="Send data as JSON."), 415
            origin = request.headers.get("Origin")
            if origin and origin.rstrip("/") != request.host_url.rstrip("/"):
                return jsonify(error="Requests from other sites are not allowed."), 403

    @app.after_request
    def headers(resp):
        resp.headers.setdefault("X-Content-Type-Options", "nosniff")
        resp.headers.setdefault("Referrer-Policy", "same-origin")
        if request.path.startswith("/api/"):
            resp.headers["Cache-Control"] = "no-store"
        return resp

    # ---- Errors: JSON for the API, plain pages for the website ---------------
    app.register_error_handler(ApiError, error_response)

    @app.errorhandler(HTTPException)
    def http_error(err):
        if request.path.startswith("/api/"):
            return jsonify(error=err.description or err.name), err.code
        return err

    @app.errorhandler(PyMongoError)
    def database_error(err):
        app.logger.exception("Database error")
        if request.path.startswith("/api/"):
            return jsonify(error="The store database is not reachable right now. Please try again in a minute."), 503
        return "The store database is not reachable right now.", 503

    @app.errorhandler(Exception)
    def server_error(err):
        app.logger.exception("Unexpected error")
        if request.path.startswith("/api/"):
            return jsonify(error="Something went wrong on our side. Please try again."), 500
        return "Something went wrong.", 500

    register_commands(app)
    return app


def register_commands(app):
    @app.cli.command("init-db")
    @click.option("--reset", is_flag=True, help="Delete all store data first (removes orders and customers!).")
    def init_db_command(reset):
        """Load the starting products (and with --reset, delete everything first)."""
        database = get_db()
        if reset:
            click.confirm(f"This deletes every order, customer and product in '{database.name}'. Continue?",
                          abort=True)
            for name in database.list_collection_names():
                database.drop_collection(name)
            init_db(app, app.extensions["mongo_client"])   # indexes again
        seed_if_empty()
        click.echo("Database ready.")

    @app.cli.command("create-admin")
    @click.option("--email", prompt=True)
    @click.option("--name", prompt=True, default="Store Admin")
    @click.password_option()
    def create_admin(email, name, password):
        """Create an admin account, or make an existing account an admin."""
        users, email = get_db().users, email.strip().lower()
        if users.find_one({"email": email}):
            users.update_one({"email": email}, {"$set": {"is_admin": True, "password_hash": hash_password(password)}})
        else:
            users.insert_one({"_id": next_id("users"), "name": name, "email": email, "is_admin": True,
                              "password_hash": hash_password(password), "created_at": utcnow()})
        click.echo(f"{email} is now an admin.")


app = create_app()

if __name__ == "__main__":
    app.run(host=os.getenv("HOST", "127.0.0.1"), port=int(os.getenv("PORT", "5000")),
            debug=os.getenv("FLASK_DEBUG", "1") == "1")
