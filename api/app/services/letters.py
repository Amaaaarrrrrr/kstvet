"""Generate, store, email and share admission letters."""
import base64
import io
import os
from datetime import date, datetime, timezone
from zoneinfo import ZoneInfo

import qrcode
from flask import current_app, render_template
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from sqlalchemy import select
from weasyprint import HTML

from app.extensions import db
from app.models import AdmissionLetter, Application, Setting, Sponsorship, User
from app.services.mailer import send_email

NAIROBI = ZoneInfo("Africa/Nairobi")
MODE_LABELS = {"physical": "Physical (on campus)", "online": "Online", "blended": "Blended"}


def _fmt(d: date | datetime | None) -> str:
    if d is None:
        return ""
    if isinstance(d, datetime):
        d = d.astimezone(NAIROBI).date()
    return f"{d.day} {d:%B %Y}"


def _settings() -> dict[str, str]:
    return {s.key: s.value for s in db.session.scalars(select(Setting))}


def _qr_data_uri(text: str) -> str:
    img = qrcode.make(text, box_size=4, border=1)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


def _abs(rel: str) -> str:
    return os.path.join(current_app.config["UPLOAD_FOLDER"], rel)


def render_letter_pdf(letter: AdmissionLetter) -> bytes:
    a = letter.application
    s = _settings()
    verify_url = f"{current_app.config['PUBLIC_BASE_URL']}/track"
    sig_rel = s.get("letter_signature_path")
    signature_uri = f"file://{_abs(sig_rel)}" if sig_rel and os.path.isfile(_abs(sig_rel)) else None

    html = render_template(
        "letters/admission.html",
        a=a, ap=a.applicant, intake=a.intake, programme=a.intake.programme, letter=letter, s=s,
        issued_date=_fmt(letter.issued_at),
        start=_fmt(a.intake.start_date), end=_fmt(a.intake.end_date),
        deadline=_fmt(a.intake.application_deadline),
        mode=MODE_LABELS.get(a.intake.programme.mode.value, a.intake.programme.mode.value),
        fee=f"KES {a.intake.programme.fee_kes:,}",
        employer_sponsored=a.sponsorship == Sponsorship.EMPLOYER,
        verify_url=verify_url, qr=_qr_data_uri(verify_url), signature_uri=signature_uri,
    )
    return HTML(string=html, base_url=current_app.root_path).write_pdf()


def _store(letter: AdmissionLetter, pdf: bytes) -> None:
    rel = f"letters/{letter.issued_at.year}/{letter.letter_no.replace('/', '-')}.pdf"
    os.makedirs(os.path.dirname(_abs(rel)), exist_ok=True)
    with open(_abs(rel), "wb") as f:
        f.write(pdf)
    letter.pdf_path = rel


def issue_letter(application: Application, issued_by: User | None) -> AdmissionLetter:
    """Create the letter record and PDF. Caller commits."""
    letter = AdmissionLetter(application=application, issued_by=issued_by, issued_at=datetime.now(timezone.utc))
    db.session.add(letter)
    db.session.flush()            # gives letter.id
    letter.assign_letter_no()
    _store(letter, render_letter_pdf(letter))
    return letter


def regenerate_letter(letter: AdmissionLetter) -> None:
    _store(letter, render_letter_pdf(letter))


def letter_bytes(letter: AdmissionLetter) -> bytes:
    path = _abs(letter.pdf_path) if letter.pdf_path else None
    if not path or not os.path.isfile(path):
        # Free/ephemeral hosting can wipe files on restart; rebuild the letter from the database.
        _store(letter, render_letter_pdf(letter))
        db.session.commit()
        path = _abs(letter.pdf_path)
    with open(path, "rb") as f:
        return f.read()

def letter_filename(letter: AdmissionLetter) -> str:
    return f"KSTVET-Admission-Letter-{letter.letter_no.replace('/', '-')}.pdf"


def email_letter(letter: AdmissionLetter) -> bool:
    a, ap = letter.application, letter.application.applicant
    s = _settings()
    body = (
        f"Dear {ap.title + ' ' if ap.title else ''}{ap.surname},\n\n"
        f"Congratulations! You have been admitted to {a.intake.programme.title} "
        f"({_fmt(a.intake.start_date)} to {_fmt(a.intake.end_date)}).\n\n"
        f"Your admission letter is attached. Please read it carefully for reporting and payment details.\n"
        f"Application reference: {a.reference_no}\n\n"
        f"You can also download the letter at {current_app.config['PUBLIC_BASE_URL']}/track "
        f"using your reference number and ID number.\n\n"
        f"Regards,\nKSTVET CPD Office\n{s.get('cpd_office_email', '')} · {s.get('cpd_office_phone', '')}\n"
    )
    ok = send_email(
        ap.email, f"Admission letter: {a.intake.programme.title}", body,
        attachments=[(letter_filename(letter), letter_bytes(letter), "application/pdf")],
    )
    if ok:
        letter.emailed_at = datetime.now(timezone.utc)
        db.session.commit()
    return ok


def send_received_email(application: Application) -> bool:
    a, ap = application, application.applicant
    s = _settings()
    body = (
        f"Dear {ap.title + ' ' if ap.title else ''}{ap.surname},\n\n"
        f"Thank you for applying for {a.intake.programme.title} "
        f"({_fmt(a.intake.start_date)} to {_fmt(a.intake.end_date)}).\n\n"
        f"Your application reference number is {a.reference_no}. Your application is now under review by the "
        f"KSTVET CPD Office. Once it is approved, your admission letter will be emailed to you.\n\n"
        f"Track your application at {current_app.config['PUBLIC_BASE_URL']}/track\n\n"
        f"Regards,\nKSTVET CPD Office\n{s.get('cpd_office_email', '')} · {s.get('cpd_office_phone', '')}\n"
    )
    return send_email(ap.email, f"Application received: {a.reference_no}", body)


# ----- Expiring public download links -----

def _serializer() -> URLSafeTimedSerializer:
    return URLSafeTimedSerializer(current_app.config["SECRET_KEY"], salt="admission-letter")


def make_download_token(letter: AdmissionLetter) -> str:
    return _serializer().dumps(letter.id)


def letter_from_token(token: str, max_age: int = 3600) -> AdmissionLetter | None:
    try:
        letter_id = _serializer().loads(token, max_age=max_age)
    except (BadSignature, SignatureExpired):
        return None
    return db.session.get(AdmissionLetter, letter_id)