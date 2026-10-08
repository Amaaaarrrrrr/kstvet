import io

from flask import Blueprint, abort, jsonify, request, send_file
from sqlalchemy import select

from app.extensions import db
from app.models import Applicant, Application
from app.services.letters import letter_bytes, letter_filename, letter_from_token, make_download_token

track_bp = Blueprint("track", __name__, url_prefix="/api")


@track_bp.post("/track")
def track():
    """POST (not GET) so ID numbers never appear in URLs or server logs."""
    body = request.get_json(silent=True) or {}
    ref = str(body.get("reference_no", "")).strip().upper()
    id_no = str(body.get("id_number", "")).strip().upper()
    if not ref or not id_no:
        abort(400, description="Enter your reference number and ID number.")

    a = db.session.scalar(
        select(Application)
        .join(Application.applicant)
        .where(Application.reference_no == ref, Applicant.id_number == id_no)
    )
    if a is None:
        abort(404, description="No application matches that reference number and ID number.")

    letter = None
    if a.letter is not None:
        letter = {
            "letter_no": a.letter.letter_no,
            "issued_at": a.letter.issued_at.isoformat(),
            "download_url": f"/api/letters/{make_download_token(a.letter)}",
        }

    return jsonify(
        reference_no=a.reference_no,
        status=a.status.value,
        applicant_name=a.applicant.full_name,
        programme_title=a.intake.programme.title,
        start_date=a.intake.start_date.isoformat(),
        end_date=a.intake.end_date.isoformat(),
        submitted_at=a.submitted_at.isoformat(),
        letter=letter,
    )


@track_bp.get("/letters/<token>")
def download_letter(token: str):
    letter = letter_from_token(token)
    if letter is None:
        abort(404, description="This download link is invalid or has expired. Track your application again to get a new link.")
    letter.download_count += 1
    db.session.commit()
    return send_file(
        io.BytesIO(letter_bytes(letter)), mimetype="application/pdf",
        as_attachment=True, download_name=letter_filename(letter),
    )