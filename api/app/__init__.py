from flask import Flask, abort, jsonify, send_from_directory
from werkzeug.exceptions import HTTPException
import os
from app.config import Config
from app.extensions import db, jwt, migrate
from app.routes.track import track_bp
from werkzeug.security import safe_join

def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)

    from app import models  # noqa: F401  (so Alembic sees the tables)
    from app import auth  # noqa: F401  (registers JWT loaders)

    from app.routes.admin_applications import admin_apps_bp
    from app.routes.admin_auth import admin_auth_bp
    from app.routes.applications import applications_bp
    from app.routes.health import health_bp
    from app.routes.public import public_bp
    from app.routes.admin_catalogue import admin_cat_bp
    for bp in (health_bp, public_bp, applications_bp, admin_auth_bp,track_bp, admin_apps_bp, admin_cat_bp):
        app.register_blueprint(bp)

    from app.cli import register_cli
    register_cli(app)

    @app.errorhandler(HTTPException)
    def handle_http_error(err: HTTPException):
        return jsonify(error=err.name, message=err.description), err.code


        # Production: serve the built React app; any non-API path returns index.html (client-side routing).
    dist = app.config.get("FRONTEND_DIST")
    if dist:
        dist = os.path.abspath(dist)
    if dist and os.path.isdir(dist):
        @app.get("/", defaults={"path": ""})
        @app.get("/<path:path>")
        def spa(path: str):
            if path.startswith("api/"):
                abort(404)
            full = safe_join(dist, path) if path else None
            if full and os.path.isfile(full):
                return send_from_directory(dist, path)
            return send_from_directory(dist, "index.html")

    return app