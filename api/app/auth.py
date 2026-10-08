from functools import wraps

from flask import abort, jsonify
from flask_jwt_extended import current_user, jwt_required

from app.extensions import db, jwt
from app.models import User


@jwt.user_lookup_loader
def load_user(_header, data):
    return db.session.get(User, int(data["sub"]))


def _unauthorized(message="Please log in"):
    return jsonify(error="Unauthorized", message=message), 401


@jwt.unauthorized_loader
def missing_token(reason):
    # Also called for CSRF failures; show those plainly.
    return _unauthorized(reason if "CSRF" in reason else "Please log in")


@jwt.expired_token_loader
def expired_token(_header, _data):
    return _unauthorized("Your session has expired. Please log in again.")


@jwt.invalid_token_loader
def invalid_token(_reason):
    return _unauthorized()


@jwt.user_lookup_error_loader
def user_missing(_header, _data):
    return _unauthorized()


def roles_required(*roles: str):
    """Require a logged-in, active admin user. Optionally restrict to roles, e.g. roles_required("admin", "officer")."""
    def decorator(fn):
        @wraps(fn)
        @jwt_required()
        def wrapper(*args, **kwargs):
            user: User | None = current_user
            if user is None or not user.is_active:
                abort(401, description="Please log in")
            if roles and user.role.value not in roles:
                abort(403, description="You do not have permission to do this.")
            return fn(*args, **kwargs)
        return wrapper
    return decorator


def user_json(user: User) -> dict:
    return {"id": user.id, "email": user.email, "full_name": user.full_name, "role": user.role.value}