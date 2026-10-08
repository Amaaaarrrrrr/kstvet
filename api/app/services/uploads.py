"""Validation and storage for applicant documents."""
import os
import uuid

from flask import current_app
from werkzeug.datastructures import FileStorage
from werkzeug.utils import secure_filename

from app.models import DocumentType

MAX_FILE_BYTES = 5 * 1024 * 1024  # 5 MB per file

# Check the file's first bytes, not just its extension, so a renamed .exe can't pass as a PDF.
SIGNATURES = [
    (b"%PDF", "application/pdf", "pdf"),
    (b"\x89PNG\r\n\x1a\n", "image/png", "png"),
    (b"\xff\xd8\xff", "image/jpeg", "jpg"),
]


def required_documents(sponsorship: str | None) -> set[DocumentType]:
    required = {DocumentType.NATIONAL_ID, DocumentType.ACADEMIC_CERT}
    if sponsorship == "employer":
        required.add(DocumentType.SPONSORSHIP_LETTER)
    return required


def _size(fs: FileStorage) -> int:
    fs.stream.seek(0, os.SEEK_END)
    size = fs.stream.tell()
    fs.stream.seek(0)
    return size


def _sniff(fs: FileStorage) -> tuple[str, str] | None:
    head = fs.stream.read(16)
    fs.stream.seek(0)
    for sig, mime, ext in SIGNATURES:
        if head.startswith(sig):
            return mime, ext
    return None


def validate_files(files, sponsorship: str | None):
    """Return (errors, accepted). accepted = [(doc_type, FileStorage, mime, ext, size)]."""
    errors: dict[str, str] = {}
    accepted = []

    for doc_type in DocumentType:
        fs: FileStorage | None = files.get(doc_type.value)
        if fs is None or not fs.filename:
            if doc_type in required_documents(sponsorship):
                errors[doc_type.value] = "This document is required"
            continue

        size = _size(fs)
        if size == 0:
            errors[doc_type.value] = "The file is empty"
            continue
        if size > MAX_FILE_BYTES:
            errors[doc_type.value] = "File is larger than 5 MB"
            continue

        kind = _sniff(fs)
        if kind is None:
            errors[doc_type.value] = "Upload a PDF, JPG or PNG file"
            continue

        mime, ext = kind
        accepted.append((doc_type, fs, mime, ext, size))

    return errors, accepted


def save_file(fs: FileStorage, folder_rel: str, doc_type: DocumentType, ext: str) -> tuple[str, str, str]:
    """Save under UPLOAD_FOLDER/folder_rel. Returns (relative_path, absolute_path, safe_original_name)."""
    base = current_app.config["UPLOAD_FOLDER"]
    folder_abs = os.path.join(base, folder_rel)
    os.makedirs(folder_abs, exist_ok=True)

    stored = f"{doc_type.value}-{uuid.uuid4().hex}.{ext}"
    abs_path = os.path.join(folder_abs, stored)
    fs.save(abs_path)

    original = secure_filename(fs.filename or "")[:255] or stored
    return f"{folder_rel}/{stored}", abs_path, original