"""API routes, grouped by topic. Every URL starts with /api."""
from .admin import bp as admin_bp
from .auth import bp as auth_bp
from .cart import bp as cart_bp
from .catalog import bp as catalog_bp
from .newsletter import bp as newsletter_bp
from .orders import bp as orders_bp

all_blueprints = [catalog_bp, auth_bp, cart_bp, orders_bp, newsletter_bp, admin_bp]
