import os

from flask import Blueprint, abort, current_app, jsonify, request, send_file
from pydantic import ValidationError
from sqlalchemy import func, or_, select
from sqlalchemy.orm import selectinload
from werkzeug.security import safe_join

from app.auth import roles_required
from app.extensions import db
from app.models import (
    Applicant, Application, ApplicationDocument, ApplicationStatus, Intake, Programme,
)
from app.schemas import ApplicationUpdate

admin_apps_bp = Blueprint("admin_applications", __name__, url_prefix="/api/admin")

SORTABLE = {
    "submitted_at": Application.submitted_at,
    "reference_no": Application.reference_no,
    "status": Application.status,
    "surname": Applicant.surname,
}


def _iso(v):
    return v.isoformat() if v else None


def _row_json(a: Application) -> dict:
    return {
        "id": a.id,
        "reference_no": a.reference_no,
        "status": a.status.value,
        "submitted_at": _iso(a.submitted_at),
        "applicant_name": a.applicant.full_name,
        "id_number": a.applicant.id_number,
        "email": a.applicant.email,
        "phone": a.applicant.phone,
        "programme_title": a.intake.programme.title,
        "intake_id": a.intake.id,
        "intake_start_date": _iso(a.intake.start_date),
        "has_letter": a.letter is not None,
    }


def _detail_json(a: Application) -> dict:
    ap, it = a.applicant, a.intake
    return {
        **_row_json(a),
        "applicant": {
            "title": ap.title, "first_name": ap.first_name, "middle_name": ap.middle_name,
            "surname": ap.surname, "id_number": ap.id_number, "gender": ap.gender,
            "date_of_birth": _iso(ap.date_of_birth), "nationality": ap.nationality,
            "county": ap.county, "phone": ap.phone, "email": ap.email,
            "postal_address": ap.postal_address,
        },
        "intake": {
            "id": it.id, "public_id": str(it.public_id), "start_date": _iso(it.start_date),
            "end_date": _iso(it.end_date), "venue": it.venue,
            "programme_title": it.programme.title, "programme_slug": it.programme.slug,
            "fee_kes": it.programme.fee_kes,
        },
        "employer": a.employer, "job_title": a.job_title,
        "highest_qualification": a.highest_qualification, "institution": a.institution,
        "year_completed": a.year_completed, "professional_body": a.professional_body,
        "membership_no": a.membership_no, "sponsorship": a.sponsorship.value,
        "special_needs": a.special_needs, "how_heard": a.how_heard,
        "admin_notes": a.admin_notes,
        "documents": [
            {
                "id": d.id, "doc_type": d.doc_type.value, "original_name": d.original_name,
                "mime_type": d.mime_type, "size_bytes": d.size_bytes,
                "url": f"/api/admin/documents/{d.id}",
            }
            for d in a.documents
        ],
        "letter": None if a.letter is None else {
            "letter_no": a.letter.letter_no, "issued_at": _iso(a.letter.issued_at),
            "emailed_at": _iso(a.letter.emailed_at), "download_count": a.letter.download_count,
        },
    }


def _get_application(app_id: int) -> Application:
    a = db.session.scalar(
        select(Application)
        .where(Application.id == app_id)
        .options(
            selectinload(Application.applicant),
            selectinload(Application.intake).selectinload(Intake.programme),
            selectinload(Application.documents),
            selectinload(Application.letter),
        )
    )
    if a is None:
        abort(404, description="Application not found")
    return a


@admin_apps_bp.get("/applications")
@roles_required()
def list_applications():
    page = max(request.args.get("page", 1, type=int), 1)
    per_page = min(max(request.args.get("per_page", 25, type=int), 1), 100)

    base = (
        select(Application)
        .join(Application.applicant)
        .join(Application.intake)
        .join(Intake.programme)
    )

    status = request.args.get("status", "").strip()
    if status:
        try:
            base = base.where(Application.status == ApplicationStatus(status))
        except ValueError:
            abort(400, description="Unknown status")

    intake_id = request.args.get("intake_id", type=int)
    if intake_id:
        base = base.where(Application.intake_id == intake_id)

    programme_id = request.args.get("programme_id", type=int)
    if programme_id:
        base = base.where(Programme.id == programme_id)

    q = request.args.get("q", "").strip()
    if q:
        like = f"%{q}%"
        base = base.where(or_(
            Application.reference_no.ilike(like), Applicant.first_name.ilike(like),
            Applicant.surname.ilike(like), Applicant.id_number.ilike(like), Applicant.email.ilike(like),
        ))

    total = db.session.scalar(select(func.count()).select_from(base.subquery()))

    sort_col = SORTABLE.get(request.args.get("sort", "submitted_at"), Application.submitted_at)
    order = sort_col.asc() if request.args.get("order", "desc").lower() == "asc" else sort_col.desc()

    stmt = (
        base.order_by(order, Application.id.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .options(
            selectinload(Application.applicant),
            selectinload(Application.intake).selectinload(Intake.programme),
            selectinload(Application.letter),
        )
    )
    rows = db.session.scalars(stmt).all()
    return jsonify(data=[_row_json(a) for a in rows], total=total)


@admin_apps_bp.get("/applications/<int:app_id>")
@roles_required()
def get_application(app_id: int):
    return jsonify(_detail_json(_get_application(app_id)))


@admin_apps_bp.patch("/applications/<int:app_id>")
@roles_required("admin", "officer")
def update_application(app_id: int):
    a = _get_application(app_id)
    try:
        upd = ApplicationUpdate.model_validate(request.get_json(silent=True) or {})
    except ValidationError as e:
        fields = {".".join(map(str, x["loc"])): x["msg"] for x in e.errors()}
        return jsonify(error="validation_error", message="Invalid update", fields=fields), 422

    if upd.status is not None and upd.status != a.status:
        if a.letter is not None and upd.status != ApplicationStatus.ADMITTED:
            abort(409, description="An admission letter has already been issued for this application.")
        a.status = upd.status
        # Phase 5: when status becomes ADMITTED, generate and email the admission letter here.

    if upd.admin_notes is not None:
        a.admin_notes = upd.admin_notes

    db.session.commit()
    return jsonify(_detail_json(a))


@admin_apps_bp.get("/documents/<int:doc_id>")
@roles_required()
def download_document(doc_id: int):
    doc = db.session.get(ApplicationDocument, doc_id)
    if doc is None:
        abort(404, description="Document not found")
    path = safe_join(current_app.config["UPLOAD_FOLDER"], doc.stored_name)
    if path is None or not os.path.isfile(path):
        abort(404, description="File missing on server")
    return send_file(
        path,
        mimetype=doc.mime_type,
        as_attachment=request.args.get("download") == "1",
        download_name=doc.original_name,
    )