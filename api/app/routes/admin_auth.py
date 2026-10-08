from datetime import datetime, timezone

from flask import Blueprint, abort, jsonify, request
from flask_jwt_extended import create_access_token, current_user, set_access_cookies, unset_jwt_cookies
from sqlalchemy import select

from app.auth import roles_required, user_json
from app.extensions import db
from app.models import User

admin_auth_bp = Blueprint("admin_auth", __name__, url_prefix="/api/admin/auth")


@admin_auth_bp.post("/login")
def login():
    body = request.get_json(silent=True) or {}
    email = str(body.get("email", "")).strip().lower()
    password = str(body.get("password", ""))

    user = db.session.scalar(select(User).where(User.email == email))
    if user is None or not user.is_active or not user.check_password(password):
        abort(401, description="Invalid email or password.")

    user.last_login_at = datetime.now(timezone.utc)
    db.session.commit()

    resp = jsonify(user=user_json(user))
    set_access_cookies(resp, create_access_token(identity=str(user.id)))
    return resp


@admin_auth_bp.post("/logout")
def logout():
    resp = jsonify(message="Logged out")
    unset_jwt_cookies(resp)
    return resp


@admin_auth_bp.get("/me")
@roles_required()
def me():
    return jsonify(user=user_json(current_user))