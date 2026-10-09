import os
from dotenv import load_dotenv
from datetime import timedelta

load_dotenv()

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

def _database_url() -> str:
    url = os.environ["DATABASE_URL"]
    # Render gives postgres:// or postgresql://; we use the psycopg 3 driver.
    for prefix in ("postgres://", "postgresql://"):
        if url.startswith(prefix):
            return "postgresql+psycopg://" + url[len(prefix):]
    return url
class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-change-me")
    SQLALCHEMY_DATABASE_URI = _database_url()
    FRONTEND_DIST = os.environ.get("FRONTEND_DIST", "")   # folder with the built React app (production)
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    UPLOAD_FOLDER = os.environ.get("UPLOAD_FOLDER", os.path.join(BASE_DIR, "storage", "uploads"))
    MAX_CONTENT_LENGTH = 25 * 1024 * 1024  # 25 MB per request
        # Admin authentication (JWT in httpOnly cookies + CSRF double-submit)
    JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY", SECRET_KEY)
    JWT_TOKEN_LOCATION = ["cookies"]
    JWT_COOKIE_SECURE = os.environ.get("JWT_COOKIE_SECURE", "false").lower() == "true"  # true in production (HTTPS)
    JWT_COOKIE_SAMESITE = "Lax"
    JWT_COOKIE_CSRF_PROTECT = True
    JWT_ACCESS_COOKIE_PATH = "/api/"
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=8)

    # Public URL of the React site (used in letters and emails)
    PUBLIC_BASE_URL = os.environ.get("PUBLIC_BASE_URL", "http://localhost:5173")

    # Email: "console" writes .eml files to storage/outbox; "smtp" sends for real
    MAIL_BACKEND = os.environ.get("MAIL_BACKEND", "console")
    MAIL_SERVER = os.environ.get("MAIL_SERVER", "")
    MAIL_PORT = int(os.environ.get("MAIL_PORT", "587"))
    MAIL_USE_TLS = os.environ.get("MAIL_USE_TLS", "true").lower() == "true"
    MAIL_USERNAME = os.environ.get("MAIL_USERNAME", "")
    MAIL_PASSWORD = os.environ.get("MAIL_PASSWORD", "")
    MAIL_FROM = os.environ.get("MAIL_FROM", "KSTVET CPD Office <cpd@kstvet.ac.ke>")
    OUTBOX_FOLDER = os.path.join(BASE_DIR, "storage", "outbox")