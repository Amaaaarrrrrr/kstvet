"""Small email sender: writes .eml files in development, sends via SMTP in production."""
import os
import re
import smtplib
from datetime import datetime
from email.message import EmailMessage

from flask import current_app


def send_email(to: str, subject: str, body: str, attachments=()) -> bool:
    """attachments: iterable of (filename, bytes, mime_type). Returns True if sent/written."""
    cfg = current_app.config
    msg = EmailMessage()
    msg["From"] = cfg["MAIL_FROM"]
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(body)
    for filename, data, mime in attachments:
        maintype, subtype = mime.split("/", 1)
        msg.add_attachment(data, maintype=maintype, subtype=subtype, filename=filename)

    try:
        if cfg["MAIL_BACKEND"] == "console":
            os.makedirs(cfg["OUTBOX_FOLDER"], exist_ok=True)
            slug = re.sub(r"[^a-z0-9]+", "-", subject.lower()).strip("-")[:50]
            path = os.path.join(cfg["OUTBOX_FOLDER"], f"{datetime.now():%Y%m%d-%H%M%S-%f}-{slug}.eml")
            with open(path, "wb") as f:
                f.write(bytes(msg))
            current_app.logger.info("Email to %s written to %s", to, path)
            return True

        with smtplib.SMTP(cfg["MAIL_SERVER"], cfg["MAIL_PORT"], timeout=15) as smtp:
            if cfg["MAIL_USE_TLS"]:
                smtp.starttls()
            if cfg["MAIL_USERNAME"]:
                smtp.login(cfg["MAIL_USERNAME"], cfg["MAIL_PASSWORD"])
            smtp.send_message(msg)
        return True
    except Exception:
        current_app.logger.exception("Failed to send email to %s", to)
        return False