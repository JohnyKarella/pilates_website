"""
test_mysql.py — check that Python can reach your MySQL Workbench database.

Run inside the backend folder (with the virtual environment active):
    python test_mysql.py
It uses DATABASE_URL from backend/.env and lists every table with its number of rows.
"""
from sqlalchemy import create_engine, inspect, text

from config import Config

TABLES = ["products", "product_options", "users", "password_resets", "orders", "order_items",
          "cart_items", "wishlist_items", "faqs", "subscribers", "testimonials"]

url = Config.SQLALCHEMY_DATABASE_URI
engine = create_engine(url)
print("Connecting to:", engine.url.render_as_string(hide_password=True))


try:
    with engine.connect() as conn:
        print("Connected successfully!")
        if engine.dialect.name == "mysql":
            print("MySQL version:", conn.execute(text("SELECT VERSION()")).scalar())
            print("Database:     ", conn.execute(text("SELECT DATABASE()")).scalar())
        found = set(inspect(conn).get_table_names())
        print()
        for name in TABLES:
            if name in found:
                rows = conn.execute(text(f"SELECT COUNT(*) FROM {name}")).scalar()
                print(f"  OK       {name:<16} {rows} rows")
            else:
                print(f"  MISSING  {name:<16} run database/01_create_database_and_tables.sql")
        if "products" in found and "stock" not in {c["name"] for c in inspect(conn).get_columns("products")}:
            print("\n  products has no stock column yet: python app.py adds it automatically.")
except Exception as error:
    print("Database connection failed:")
    print(error)
    print("\nCheck that MySQL is running and that the user, password and database name in")
    print("DATABASE_URL (backend/.env) are the same as in MySQL Workbench.")
finally:
    engine.dispose()
