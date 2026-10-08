from flask import jsonify, request
from pydantic import ValidationError
from sqlalchemy import func, select

from app.extensions import db


def validation_error(e: ValidationError, message: str = "Please correct the highlighted fields."):
    fields: dict[str, str] = {}
    for x in e.errors():
        name = ".".join(map(str, x["loc"])) or "form"
        fields.setdefault(name, x["msg"].removeprefix("Value error, "))
    return jsonify(error="validation_error", message=message, fields=fields), 422


def paginate(base, order_by: list, serialize, *options):
    """Standard admin list response: {"data": [...], "total": n}. Query args: page, per_page."""
    page = max(request.args.get("page", 1, type=int), 1)
    per_page = min(max(request.args.get("per_page", 25, type=int), 1), 100)
    total = db.session.scalar(select(func.count()).select_from(base.subquery()))
    stmt = base.order_by(*order_by).offset((page - 1) * per_page).limit(per_page).options(*options)
    rows = db.session.scalars(stmt).all()
    return jsonify(data=[serialize(r) for r in rows], total=total)