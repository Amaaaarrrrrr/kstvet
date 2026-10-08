import io
import os

from flask import Blueprint, abort, current_app, jsonify, request, send_file
from flask_jwt_extended import current_user
from pydantic import ValidationError
from sqlalchemy import func, or_, select
from sqlalchemy.orm import selectinload
from werkzeug.security import safe_join
import csv
from datetime import date

from flask import Response

from app.models import IntakeStatus
from app.utils import paginate

from app.auth import roles_required
from app.extensions import db
from app.models import (
    Applicant, Application, ApplicationDocument, ApplicationStatus, Intake, Programme,
)
from app.schemas import ApplicationUpdate
from app.services.letters import (
    email_letter, issue_letter, letter_bytes, letter_filename, regenerate_letter,
)

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

def _filtered_applications():
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
    return base


ROW_OPTIONS = (
    selectinload(Application.applicant),
    selectinload(Application.intake).selectinload(Intake.programme),
    selectinload(Application.letter),
)


@admin_apps_bp.get("/applications")
@roles_required()
def list_applications():
    col = SORTABLE.get(request.args.get("sort", "submitted_at"), Application.submitted_at)
    order = col.asc() if request.args.get("order", "desc").lower() == "asc" else col.desc()
    return paginate(_filtered_applications(), [order, Application.id.desc()], _row_json, *ROW_OPTIONS)


@admin_apps_bp.get("/exports/applications.csv")
@roles_required()
def export_applications():
    rows = db.session.scalars(
        _filtered_applications().order_by(Application.submitted_at).options(*ROW_OPTIONS)
    ).all()
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["Reference", "Status", "Submitted", "Title", "First name", "Middle name", "Surname",
                "ID/Passport", "Phone", "Email", "County", "Programme", "Intake start", "Employer",
                "Job title", "Qualification", "Sponsorship", "Letter No."])
    for a in rows:
        ap = a.applicant
        w.writerow([a.reference_no, a.status.value, a.submitted_at.strftime("%Y-%m-%d %H:%M"), ap.title,
                    ap.first_name, ap.middle_name, ap.surname, ap.id_number, ap.phone, ap.email, ap.county,
                    a.intake.programme.title, a.intake.start_date.isoformat(), a.employer, a.job_title,
                    a.highest_qualification, a.sponsorship.value, a.letter.letter_no if a.letter else ""])
    filename = f"cpd-applications-{date.today().isoformat()}.csv"
    # The BOM makes Excel open the file as UTF-8 (names with accents display correctly).
    return Response("\ufeff" + buf.getvalue(), mimetype="text/csv",
                    headers={"Content-Disposition": f'attachment; filename="{filename}"'})


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

    newly_admitted = False
    if upd.status is not None and upd.status != a.status:
        if a.letter is not None and upd.status != ApplicationStatus.ADMITTED:
            abort(409, description="An admission letter has already been issued for this application.")
        a.status = upd.status
        if upd.status == ApplicationStatus.ADMITTED and a.letter is None:
            issue_letter(a, current_user)   # if PDF generation fails, nothing is saved
            newly_admitted = True
            intake = a.intake
            if intake.capacity:
                db.session.flush()
                admitted = db.session.scalar(
                    select(func.count(Application.id)).where(
                        Application.intake_id == intake.id, Application.status == ApplicationStatus.ADMITTED
                    )
                )
                if admitted >= intake.capacity:
                    intake.status = IntakeStatus.FULL   # removes the Apply button on the calendar

    if upd.admin_notes is not None:
        a.admin_notes = upd.admin_notes

    db.session.commit()

    if newly_admitted:
        email_letter(a.letter)  # best effort: the letter stays downloadable even if email fails

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

@admin_apps_bp.get("/applications/<int:app_id>/letter")
@roles_required()
def view_letter(app_id: int):
    a = _get_application(app_id)
    if a.letter is None:
        abort(404, description="No admission letter has been issued yet.")
    return send_file(
        io.BytesIO(letter_bytes(a.letter)), mimetype="application/pdf",
        as_attachment=request.args.get("download") == "1", download_name=letter_filename(a.letter),
    )


@admin_apps_bp.post("/applications/<int:app_id>/letter/regenerate")
@roles_required("admin", "officer")
def regenerate(app_id: int):
    a = _get_application(app_id)
    if a.letter is None:
        abort(404, description="No admission letter has been issued yet.")
    regenerate_letter(a.letter)
    db.session.commit()
    return jsonify(_detail_json(a))


@admin_apps_bp.post("/applications/<int:app_id>/letter/resend")
@roles_required("admin", "officer")
def resend(app_id: int):
    a = _get_application(app_id)
    if a.letter is None:
        abort(404, description="No admission letter has been issued yet.")
    if not email_letter(a.letter):
        abort(502, description="The email could not be sent. Check the mail settings and try again.")
    return jsonify(_detail_json(a))