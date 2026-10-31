"""
check_atlas.py — check that Python can reach your MongoDB Atlas database.

Run inside the backend folder (with the virtual environment active):
    python check_atlas.py
It uses MONGO_URI and MONGO_DB from backend/.env and lists every collection with its number of documents.
"""
from pymongo import MongoClient

from config import Config

COLLECTIONS = ["products", "users", "orders", "cart_items", "wishlist_items", "subscribers",
               "testimonials", "faqs", "password_resets", "counters"]

uri = Config.MONGO_URI
if not uri.startswith("mongodb+srv://"):
    raise SystemExit("MONGO_URI in backend/.env must be your Atlas connection string (mongodb+srv://...).")
print("Connecting to:", uri.split("@")[-1], "  database:", Config.MONGO_DB)

client = MongoClient(uri, serverSelectionTimeoutMS=8000)
try:
    client.admin.command("ping")
    print("Connected successfully!\n")
    database = client[Config.MONGO_DB]
    found = set(database.list_collection_names())
    for name in COLLECTIONS:
        if name in found:
            print(f"  OK       {name:<16} {database[name].count_documents({})} documents")
        else:
            print(f"  EMPTY    {name:<16} (created when first used)")
except Exception as error:
    print("Database connection failed:")
    print(error)
    print("\nCheck the password in MONGO_URI (backend/.env) and that your IP address is")
    print("allowed in Atlas > Network Access.")
finally:
    client.close()
