from flask import Flask, jsonify
from werkzeug.exceptions import HTTPException

from app.config import Config
from app.extensions import db, migrate


def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    db.init_app(app)
    migrate.init_app(app, db)

    from app import models  # noqa: F401  (so Alembic sees the tables)

    from app.routes.health import health_bp
    from app.routes.public import public_bp
    app.register_blueprint(health_bp)
    app.register_blueprint(public_bp)

    from app.cli import register_cli
    register_cli(app)

    @app.errorhandler(HTTPException)
    def handle_http_error(err: HTTPException):
        # Every error from the API comes back as JSON the React app can read.
        return jsonify(error=err.name, message=err.description), err.code

    return app