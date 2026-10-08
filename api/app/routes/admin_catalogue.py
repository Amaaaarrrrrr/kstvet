import os
import re
import uuid
from datetime import date

from flask import Blueprint, abort, current_app, jsonify, request
from sqlalchemy import func, or_, select
from sqlalchemy.orm import selectinload
from pydantic import ValidationError

from app.auth import roles_required
from app.extensions import db
from app.models import Application, ApplicationStatus, Intake, IntakeStatus, Programme, Setting
from app.schemas import IntakeIn, ProgrammeIn
from app.services.uploads import _size, _sniff
from app.utils import paginate, validation_error

admin_cat_bp = Blueprint("admin_catalogue", __name__, url_prefix="/api/admin")
WRITE = ("admin", "officer")


def _iso(v):
    return v.isoformat() if v else None


def _body():
    return request.get_json(silent=True) or {}


def _save_upload(fs, rel_path: str) -> None:
    abs_path = os.path.join(current_app.config["UPLOAD_FOLDER"], rel_path)
    os.makedirs(os.path.dirname(abs_path), exist_ok=True)
    fs.save(abs_path)


# ---------------- Programmes ----------------

def _slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:150] or "programme"


def _unique_slug(base: str, exclude_id: int | None = None) -> str:
    slug, n = base, 2
    while True:
        q = select(Programme.id).where(Programme.slug == slug)
        if exclude_id:
            q = q.where(Programme.id != exclude_id)
        if not db.session.scalar(q):
            return slug
        slug, n = f"{base}-{n}", n + 1


def _programme_json(p: Programme) -> dict:
    return {
        "id": p.id, "slug": p.slug, "title": p.title, "category": p.category, "summary": p.summary,
        "description": p.description, "target_audience": p.target_audience,
        "learning_outcomes": p.learning_outcomes, "duration_text": p.duration_text,
        "mode": p.mode.value, "cpd_hours": p.cpd_hours, "fee_kes": p.fee_kes,
        "is_published": p.is_published, "has_brochure": p.has_brochure,
        "intake_count": len(p.intakes), "created_at": _iso(p.created_at),
    }


def _get_programme(pid: int) -> Programme:
    p = db.session.get(Programme, pid)
    if p is None:
        abort(404, description="Programme not found")
    return p


@admin_cat_bp.get("/programmes")
@roles_required()
def list_programmes():
    base = select(Programme)
    q = request.args.get("q", "").strip()
    if q:
        base = base.where(or_(Programme.title.ilike(f"%{q}%"), Programme.category.ilike(f"%{q}%")))
    published = request.args.get("is_published")
    if published in ("true", "false"):
        base = base.where(Programme.is_published.is_(published == "true"))
    sorts = {"title": Programme.title, "category": Programme.category,
             "fee_kes": Programme.fee_kes, "created_at": Programme.created_at}
    col = sorts.get(request.args.get("sort", "title"), Programme.title)
    order = col.desc() if request.args.get("order", "asc").lower() == "desc" else col.asc()
    return paginate(base, [order, Programme.id], _programme_json, selectinload(Programme.intakes))


@admin_cat_bp.get("/programmes/<int:pid>")
@roles_required()
def get_programme(pid: int):
    return jsonify(_programme_json(_get_programme(pid)))


@admin_cat_bp.post("/programmes")
@roles_required(*WRITE)
def create_programme():
    try:
        data = ProgrammeIn.model_validate(_body())
    except ValidationError as e:
        return validation_error(e)
    values = data.model_dump()
    values["slug"] = _unique_slug(values.pop("slug") or _slugify(data.title))
    p = Programme(**values)
    db.session.add(p)
    db.session.commit()
    return jsonify(_programme_json(p)), 201


@admin_cat_bp.put("/programmes/<int:pid>")
@roles_required(*WRITE)
def update_programme(pid: int):
    p = _get_programme(pid)
    try:
        data = ProgrammeIn.model_validate(_body())
    except ValidationError as e:
        return validation_error(e)
    values = data.model_dump()
    new_slug = values.pop("slug")
    if new_slug and new_slug != p.slug:
        p.slug = _unique_slug(new_slug, exclude_id=p.id)
    for k, v in values.items():
        setattr(p, k, v)
    db.session.commit()
    return jsonify(_programme_json(p))


@admin_cat_bp.delete("/programmes/<int:pid>")
@roles_required(*WRITE)
def delete_programme(pid: int):
    p = _get_programme(pid)
    has_apps = db.session.scalar(
        select(func.count(Application.id)).join(Application.intake).where(Intake.programme_id == p.id)
    )
    if has_apps:
        abort(409, description="This programme has applications. Unpublish it instead of deleting it.")
    data = _programme_json(p)
    db.session.delete(p)
    db.session.commit()
    return jsonify(data)


@admin_cat_bp.post("/programmes/<int:pid>/brochure")
@roles_required(*WRITE)
def upload_brochure(pid: int):
    p = _get_programme(pid)
    fs = request.files.get("file")
    if fs is None or not fs.filename:
        abort(400, description="Choose a PDF file to upload.")
    if _size(fs) > 10 * 1024 * 1024:
        abort(400, description="The brochure must be 10 MB or smaller.")
    kind = _sniff(fs)
    if kind is None or kind[0] != "application/pdf":
        abort(400, description="The brochure must be a PDF.")
    rel = f"brochures/{p.slug}-{uuid.uuid4().hex[:8]}.pdf"
    _save_upload(fs, rel)
    p.brochure_path = rel
    db.session.commit()
    return jsonify(_programme_json(p))


# ---------------- Intakes ----------------

def _intake_json(i: Intake) -> dict:
    return {
        "id": i.id, "public_id": str(i.public_id), "programme_id": i.programme_id,
        "programme_title": i.programme.title, "start_date": _iso(i.start_date),
        "end_date": _iso(i.end_date), "venue": i.venue, "capacity": i.capacity,
        "application_deadline": _iso(i.application_deadline), "reporting_time": i.reporting_time,
        "status": i.status.value, "is_accepting": i.is_accepting,
        "application_count": len(i.applications),
        "admitted_count": sum(1 for a in i.applications if a.status == ApplicationStatus.ADMITTED),
    }


def _get_intake(iid: int) -> Intake:
    i = db.session.get(Intake, iid)
    if i is None:
        abort(404, description="Intake not found")
    return i


def _check_programme(programme_id: int):
    if db.session.get(Programme, programme_id) is None:
        return jsonify(error="validation_error", message="Please correct the highlighted fields.",
                       fields={"programme_id": "Choose an existing programme"}), 422
    return None


@admin_cat_bp.get("/intakes")
@roles_required()
def list_intakes():
    base = select(Intake).join(Intake.programme)
    pid = request.args.get("programme_id", type=int)
    if pid:
        base = base.where(Intake.programme_id == pid)
    status = request.args.get("status", "").strip()
    if status:
        try:
            base = base.where(Intake.status == IntakeStatus(status))
        except ValueError:
            abort(400, description="Unknown status")
    if request.args.get("upcoming") == "true":
        base = base.where(Intake.end_date >= date.today())
    sorts = {"start_date": Intake.start_date, "application_deadline": Intake.application_deadline,
             "programme_title": Programme.title, "status": Intake.status}
    col = sorts.get(request.args.get("sort", "start_date"), Intake.start_date)
    order = col.desc() if request.args.get("order", "asc").lower() == "desc" else col.asc()
    return paginate(base, [order, Intake.id], _intake_json,
                    selectinload(Intake.programme), selectinload(Intake.applications))


@admin_cat_bp.get("/intakes/<int:iid>")
@roles_required()
def get_intake(iid: int):
    return jsonify(_intake_json(_get_intake(iid)))


@admin_cat_bp.post("/intakes")
@roles_required(*WRITE)
def create_intake():
    try:
        data = IntakeIn.model_validate(_body())
    except ValidationError as e:
        return validation_error(e)
    if (err := _check_programme(data.programme_id)):
        return err
    i = Intake(**data.model_dump())
    db.session.add(i)
    db.session.commit()
    return jsonify(_intake_json(i)), 201


@admin_cat_bp.put("/intakes/<int:iid>")
@roles_required(*WRITE)
def update_intake(iid: int):
    i = _get_intake(iid)
    try:
        data = IntakeIn.model_validate(_body())
    except ValidationError as e:
        return validation_error(e)
    if (err := _check_programme(data.programme_id)):
        return err
    for k, v in data.model_dump().items():
        setattr(i, k, v)
    db.session.commit()
    return jsonify(_intake_json(i))


@admin_cat_bp.delete("/intakes/<int:iid>")
@roles_required(*WRITE)
def delete_intake(iid: int):
    i = _get_intake(iid)
    if i.applications:
        abort(409, description="This intake has applications. Set its status to Cancelled instead of deleting it.")
    data = _intake_json(i)
    db.session.delete(i)
    db.session.commit()
    return jsonify(data)


# ---------------- Settings ----------------

SETTING_KEYS = (
    "letter_signatory_name", "letter_signatory_title", "payment_instructions",
    "cpd_office_email", "cpd_office_phone",
)


def _settings_json() -> dict:
    s = {x.key: x.value for x in db.session.scalars(select(Setting))}
    return {**{k: s.get(k, "") for k in SETTING_KEYS}, "has_signature": bool(s.get("letter_signature_path"))}


def _set(key: str, value: str) -> None:
    row = db.session.get(Setting, key) or Setting(key=key)
    row.value = value
    db.session.add(row)


@admin_cat_bp.get("/settings")
@roles_required()
def get_settings():
    return jsonify(_settings_json())


@admin_cat_bp.put("/settings")
@roles_required("admin")
def update_settings():
    body = _body()
    for k in SETTING_KEYS:
        if k in body:
            _set(k, str(body[k] or "").strip()[:2000])
    db.session.commit()
    return jsonify(_settings_json())


@admin_cat_bp.post("/settings/signature")
@roles_required("admin")
def upload_signature():
    fs = request.files.get("file")
    if fs is None or not fs.filename:
        abort(400, description="Choose an image file to upload.")
    if _size(fs) > 1024 * 1024:
        abort(400, description="The signature image must be 1 MB or smaller.")
    kind = _sniff(fs)
    if kind is None or kind[0] not in ("image/png", "image/jpeg"):
        abort(400, description="The signature must be a PNG or JPG image.")
    rel = f"settings/signature-{uuid.uuid4().hex[:8]}.{kind[1]}"
    _save_upload(fs, rel)
    _set("letter_signature_path", rel)
    db.session.commit()
    return jsonify(_settings_json())


# ---------------- Reports ----------------

@admin_cat_bp.get("/reports/summary")
@roles_required()
def reports_summary():
    by_status = {s.value: 0 for s in ApplicationStatus}
    for status, n in db.session.execute(select(Application.status, func.count()).group_by(Application.status)):
        by_status[status.value] = n

    admitted = func.count(Application.id).filter(Application.status == ApplicationStatus.ADMITTED)
    rows = db.session.execute(
        select(Intake.id, Programme.title, Intake.start_date, Intake.capacity, Intake.status,
               func.count(Application.id), admitted)
        .join(Intake.programme)
        .outerjoin(Application, Application.intake_id == Intake.id)
        .where(Intake.end_date >= date.today())
        .group_by(Intake.id, Programme.title)
        .order_by(Intake.start_date)
    ).all()

    return jsonify(
        totals={"applications": sum(by_status.values()), **by_status},
        intakes=[
            {"intake_id": r[0], "programme_title": r[1], "start_date": _iso(r[2]), "capacity": r[3],
             "status": r[4].value, "applications": r[5], "admitted": r[6]}
            for r in rows
        ],
    )