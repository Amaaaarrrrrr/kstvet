import json
import os

from flask import Blueprint, abort, jsonify, request
from pydantic import ValidationError
from sqlalchemy import select

from app.extensions import db
from app.models import Applicant, Application, ApplicationDocument, ApplicationStatus, Intake
from app.schemas import ApplicationCreate, ApplicationCreated
from app.services.uploads import save_file, validate_files
from app.services.letters import send_received_email

applications_bp = Blueprint("applications", __name__, url_prefix="/api")

APPLICANT_FIELDS = [
    "title", "first_name", "middle_name", "surname", "gender", "date_of_birth",
    "nationality", "county", "phone", "email", "postal_address",
]
APPLICATION_FIELDS = [
    "employer", "job_title", "highest_qualification", "institution", "year_completed",
    "professional_body", "membership_no", "sponsorship", "special_needs", "how_heard", "consent_given",
]


FRIENDLY = {
    "phone": "Enter a valid phone number, e.g. +254712345678",
    "email": "Enter a valid email address",
    "id_number": "Enter a valid ID or passport number (letters and numbers only, at least 5)",
}


def _pydantic_errors(err: ValidationError) -> dict[str, str]:
    fields: dict[str, str] = {}
    for e in err.errors():
        name = ".".join(str(p) for p in e["loc"]) or "form"
        if e["type"] == "missing" or (e["type"] == "string_type" and e.get("input") is None):
            msg = "This field is required"
        elif name in FRIENDLY:
            msg = FRIENDLY[name]
        else:
            msg = e["msg"].removeprefix("Value error, ")
        fields.setdefault(name, msg)
    return fields


@applications_bp.post("/applications")
def create_application():
    raw = request.form.get("data")
    if not raw:
        abort(400, description="Missing application data")
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError:
        abort(400, description="Application data is not valid JSON")
    if not isinstance(payload, dict):
        abort(400, description="Application data must be an object")

    # 1. Validate text fields and files together so the applicant sees every problem at once.
    errors: dict[str, str] = {}
    data: ApplicationCreate | None = None
    try:
        data = ApplicationCreate.model_validate(payload)
    except ValidationError as e:
        errors.update(_pydantic_errors(e))

    file_errors, files = validate_files(request.files, payload.get("sponsorship"))
    errors.update(file_errors)

    if errors or data is None:
        return jsonify(
            error="validation_error",
            message="Please correct the highlighted fields.",
            fields=errors,
        ), 422

    # 2. Business rules.
    intake = db.session.scalar(select(Intake).where(Intake.public_id == data.intake_id))
    if intake is None or not intake.programme.is_published:
        abort(404, description="This intake could not be found.")
    if not intake.is_accepting:
        abort(409, description="This intake is no longer accepting applications.")

    duplicate = db.session.scalar(
        select(Application.id)
        .join(Application.applicant)
        .where(
            Applicant.id_number == data.id_number,
            Application.intake_id == intake.id,
            Application.status.not_in([ApplicationStatus.REJECTED, ApplicationStatus.WITHDRAWN]),
        )
    )
    if duplicate:
        abort(409, description="You have already applied for this intake with this ID number.")

    # 3. Save applicant (reuse if they applied before) and application.
    applicant = db.session.scalar(select(Applicant).where(Applicant.id_number == data.id_number))
    if applicant is None:
        applicant = Applicant(id_number=data.id_number)
        db.session.add(applicant)
    for f in APPLICANT_FIELDS:
        setattr(applicant, f, getattr(data, f))

    application = Application(
        applicant=applicant,
        intake=intake,
        **{f: getattr(data, f) for f in APPLICATION_FIELDS},
    )
    db.session.add(application)
    db.session.flush()  # gives application.id and public_id
    application.assign_reference()

    # 4. Save files; if anything fails, roll back the database and delete what we wrote.
    written: list[str] = []
    try:
        folder = f"applications/{application.public_id}"
        for doc_type, fs, mime, ext, size in files:
            rel, abs_path, original = save_file(fs, folder, doc_type, ext)
            written.append(abs_path)
            application.documents.append(
                ApplicationDocument(
                    doc_type=doc_type, stored_name=rel, original_name=original,
                    mime_type=mime, size_bytes=size,
                )
            )
        db.session.commit()
    except Exception:
        db.session.rollback()
        for p in written:
            if os.path.exists(p):
                os.remove(p)
        raise

    send_received_email(application)  # best effort; never blocks the submission

    result = ApplicationCreated(
        reference_no=application.reference_no,
        public_id=application.public_id,
        status=application.status.value,
        email=applicant.email,
        programme_title=intake.programme.title,
        start_date=intake.start_date,
        end_date=intake.end_date,
    )
    return jsonify(result.model_dump(mode="json")), 201