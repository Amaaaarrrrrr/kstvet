from flask import Flask

from app.config import Config
from app.extensions import db, migrate


def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    db.init_app(app)
    migrate.init_app(app, db)

    from app import models  # noqa: F401  (so Alembic sees the tables)

    from app.routes.health import health_bp
    app.register_blueprint(health_bp)

    from app.cli import register_cli
    register_cli(app)

    return app