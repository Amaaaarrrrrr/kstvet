from datetime import date

from flask import Blueprint, abort, jsonify, request
from sqlalchemy import extract, select
from sqlalchemy.orm import contains_eager

from app.extensions import db
from app.models import DeliveryMode, Intake, IntakeStatus, Programme
from app.schemas import IntakeBrief, IntakeOut, ProgrammeDetail

public_bp = Blueprint("public", __name__, url_prefix="/api")


def _upcoming(intake: Intake) -> bool:
    return intake.status != IntakeStatus.CANCELLED and intake.end_date >= date.today()


@public_bp.get("/intakes")
def list_intakes():
    """CPD Calendar. Optional filters: month=YYYY-MM, category, mode, q (search title)."""
    stmt = (
        select(Intake)
        .join(Intake.programme)
        .options(contains_eager(Intake.programme))
        .where(
            Programme.is_published.is_(True),
            Intake.status != IntakeStatus.CANCELLED,
            Intake.end_date >= date.today(),
        )
        .order_by(Intake.start_date, Programme.title)
    )

    month = request.args.get("month", "").strip()
    if month:
        try:
            year, mon = (int(x) for x in month.split("-"))
        except ValueError:
            abort(400, description="month must be YYYY-MM")
        stmt = stmt.where(
            extract("year", Intake.start_date) == year,
            extract("month", Intake.start_date) == mon,
        )

    category = request.args.get("category", "").strip()
    if category:
        stmt = stmt.where(Programme.category == category)

    mode = request.args.get("mode", "").strip()
    if mode:
        try:
            stmt = stmt.where(Programme.mode == DeliveryMode(mode))
        except ValueError:
            abort(400, description="mode must be physical, online or blended")

    q = request.args.get("q", "").strip()
    if q:
        stmt = stmt.where(Programme.title.ilike(f"%{q}%"))

    intakes = db.session.scalars(stmt).unique().all()
    return jsonify([IntakeOut.model_validate(i).model_dump(mode="json") for i in intakes])


@public_bp.get("/categories")
def list_categories():
    stmt = (
        select(Programme.category)
        .where(Programme.is_published.is_(True))
        .distinct()
        .order_by(Programme.category)
    )
    return jsonify(db.session.scalars(stmt).all())


@public_bp.get("/programmes/<slug>")
def programme_detail(slug: str):
    programme = db.session.scalar(
        select(Programme).where(Programme.slug == slug, Programme.is_published.is_(True))
    )
    if programme is None:
        abort(404, description="Programme not found")

    detail = ProgrammeDetail.model_validate(programme).model_copy(
        update={"intakes": [IntakeBrief.model_validate(i) for i in programme.intakes if _upcoming(i)]}
    )
    return jsonify(detail.model_dump(mode="json"))


@public_bp.get("/intakes/<uuid:public_id>")
def intake_detail(public_id):
    intake = db.session.scalar(
        select(Intake)
        .join(Intake.programme)
        .options(contains_eager(Intake.programme))
        .where(Intake.public_id == public_id, Programme.is_published.is_(True))
    )
    if intake is None:
        abort(404, description="This intake could not be found.")
    return jsonify(IntakeOut.model_validate(intake).model_dump(mode="json"))