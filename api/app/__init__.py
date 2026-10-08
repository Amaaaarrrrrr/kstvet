from flask import Flask, jsonify
from werkzeug.exceptions import HTTPException

from app.config import Config
from app.extensions import db, jwt, migrate


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
    for bp in (health_bp, public_bp, applications_bp, admin_auth_bp, admin_apps_bp):
        app.register_blueprint(bp)

    from app.cli import register_cli
    register_cli(app)

    @app.errorhandler(HTTPException)
    def handle_http_error(err: HTTPException):
        return jsonify(error=err.name, message=err.description), err.code

    return app