import enum
import uuid
from datetime import date, datetime

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from sqlalchemy import (
    Boolean, Date, DateTime, Enum, ForeignKey, Integer, String, Text, func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.extensions import db

_ph = PasswordHasher()


def pg_enum(enum_cls, name):
    """Store enum values ('open'), not names ('OPEN'), in a native Postgres enum."""
    return Enum(enum_cls, name=name, values_callable=lambda e: [m.value for m in e])


# ---------- Enums ----------

class UserRole(str, enum.Enum):
    ADMIN = "admin"
    OFFICER = "officer"
    VIEWER = "viewer"


class DeliveryMode(str, enum.Enum):
    PHYSICAL = "physical"
    ONLINE = "online"
    BLENDED = "blended"


class IntakeStatus(str, enum.Enum):
    OPEN = "open"
    CLOSED = "closed"
    FULL = "full"
    CANCELLED = "cancelled"


class ApplicationStatus(str, enum.Enum):
    SUBMITTED = "submitted"
    UNDER_REVIEW = "under_review"
    ADMITTED = "admitted"
    REJECTED = "rejected"
    WITHDRAWN = "withdrawn"


class Sponsorship(str, enum.Enum):
    SELF = "self"
    EMPLOYER = "employer"


class DocumentType(str, enum.Enum):
    NATIONAL_ID = "national_id"
    ACADEMIC_CERT = "academic_cert"
    PROFESSIONAL_CERT = "professional_cert"
    CV = "cv"
    SPONSORSHIP_LETTER = "sponsorship_letter"


# ---------- Mixins ----------

class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


# ---------- Admin users ----------

class User(TimestampMixin, db.Model):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(150))
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[UserRole] = mapped_column(pg_enum(UserRole, "user_role"), default=UserRole.OFFICER)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    def set_password(self, raw: str) -> None:
        self.password_hash = _ph.hash(raw)

    def check_password(self, raw: str) -> bool:
        try:
            return _ph.verify(self.password_hash, raw)
        except VerifyMismatchError:
            return False


# ---------- Programmes and intakes ----------

class Programme(TimestampMixin, db.Model):
    __tablename__ = "programmes"

    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(160), unique=True, index=True)
    title: Mapped[str] = mapped_column(String(200))
    category: Mapped[str] = mapped_column(String(100), index=True)
    summary: Mapped[str] = mapped_column(Text)
    description: Mapped[str] = mapped_column(Text, default="")
    target_audience: Mapped[str] = mapped_column(Text, default="")
    learning_outcomes: Mapped[str] = mapped_column(Text, default="")
    duration_text: Mapped[str] = mapped_column(String(100))          # e.g. "5 days"
    mode: Mapped[DeliveryMode] = mapped_column(pg_enum(DeliveryMode, "delivery_mode"))
    cpd_hours: Mapped[int | None] = mapped_column(Integer)
    fee_kes: Mapped[int] = mapped_column(Integer)                     # whole shillings
    brochure_path: Mapped[str | None] = mapped_column(String(255))
    is_published: Mapped[bool] = mapped_column(Boolean, default=False, index=True)

    intakes: Mapped[list["Intake"]] = relationship(
        back_populates="programme", order_by="Intake.start_date", cascade="all, delete-orphan"
    )

    @property
    def has_brochure(self) -> bool:
        return bool(self.brochure_path)


class Intake(TimestampMixin, db.Model):
    __tablename__ = "intakes"

    id: Mapped[int] = mapped_column(primary_key=True)
    public_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), unique=True, default=uuid.uuid4)
    programme_id: Mapped[int] = mapped_column(ForeignKey("programmes.id", ondelete="CASCADE"), index=True)
    start_date: Mapped[date] = mapped_column(Date, index=True)
    end_date: Mapped[date] = mapped_column(Date)
    venue: Mapped[str] = mapped_column(String(200))
    capacity: Mapped[int | None] = mapped_column(Integer)
    application_deadline: Mapped[date] = mapped_column(Date)
    reporting_time: Mapped[str | None] = mapped_column(String(50))  # e.g. "8:00 AM"
    status: Mapped[IntakeStatus] = mapped_column(
        pg_enum(IntakeStatus, "intake_status"), default=IntakeStatus.OPEN, index=True
    )

    programme: Mapped[Programme] = relationship(back_populates="intakes")
    applications: Mapped[list["Application"]] = relationship(back_populates="intake")

    @property
    def is_accepting(self) -> bool:
        return self.status == IntakeStatus.OPEN and self.application_deadline >= date.today()


# ---------- Applicants and applications ----------

class Applicant(TimestampMixin, db.Model):
    __tablename__ = "applicants"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str | None] = mapped_column(String(20))
    first_name: Mapped[str] = mapped_column(String(80))
    middle_name: Mapped[str | None] = mapped_column(String(80))
    surname: Mapped[str] = mapped_column(String(80))
    id_number: Mapped[str] = mapped_column(String(30), index=True)  # National ID or passport
    gender: Mapped[str | None] = mapped_column(String(20))
    date_of_birth: Mapped[date | None] = mapped_column(Date)
    nationality: Mapped[str] = mapped_column(String(80), default="Kenyan")
    county: Mapped[str | None] = mapped_column(String(80))
    phone: Mapped[str] = mapped_column(String(30))
    email: Mapped[str] = mapped_column(String(255), index=True)
    postal_address: Mapped[str | None] = mapped_column(String(255))

    applications: Mapped[list["Application"]] = relationship(back_populates="applicant")

    @property
    def full_name(self) -> str:
        parts = [self.first_name, self.middle_name, self.surname]
        return " ".join(p for p in parts if p)


class Application(TimestampMixin, db.Model):
    __tablename__ = "applications"

    id: Mapped[int] = mapped_column(primary_key=True)
    public_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), unique=True, default=uuid.uuid4)
    reference_no: Mapped[str | None] = mapped_column(String(40), unique=True, index=True)
    applicant_id: Mapped[int] = mapped_column(ForeignKey("applicants.id"), index=True)
    intake_id: Mapped[int] = mapped_column(ForeignKey("intakes.id"), index=True)

    employer: Mapped[str | None] = mapped_column(String(200))
    job_title: Mapped[str | None] = mapped_column(String(150))
    highest_qualification: Mapped[str] = mapped_column(String(150))
    institution: Mapped[str] = mapped_column(String(200))
    year_completed: Mapped[int | None] = mapped_column(Integer)
    professional_body: Mapped[str | None] = mapped_column(String(150))
    membership_no: Mapped[str | None] = mapped_column(String(60))
    sponsorship: Mapped[Sponsorship] = mapped_column(pg_enum(Sponsorship, "sponsorship"), default=Sponsorship.SELF)
    special_needs: Mapped[str | None] = mapped_column(Text)
    how_heard: Mapped[str | None] = mapped_column(String(100))
    consent_given: Mapped[bool] = mapped_column(Boolean, default=False)

    status: Mapped[ApplicationStatus] = mapped_column(
        pg_enum(ApplicationStatus, "application_status"), default=ApplicationStatus.SUBMITTED, index=True
    )
    admin_notes: Mapped[str | None] = mapped_column(Text)
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    applicant: Mapped[Applicant] = relationship(back_populates="applications")
    intake: Mapped[Intake] = relationship(back_populates="applications")
    documents: Mapped[list["ApplicationDocument"]] = relationship(
        back_populates="application", cascade="all, delete-orphan"
    )
    letter: Mapped["AdmissionLetter | None"] = relationship(back_populates="application", uselist=False)

    def assign_reference(self) -> None:
        """Call after db.session.flush() so self.id exists. id comes from a Postgres sequence, so it is unique."""
        year = (self.submitted_at or datetime.now()).year
        self.reference_no = f"KSTVET/CPD/{year}/{self.id:04d}"


class ApplicationDocument(TimestampMixin, db.Model):
    __tablename__ = "application_documents"

    id: Mapped[int] = mapped_column(primary_key=True)
    application_id: Mapped[int] = mapped_column(ForeignKey("applications.id", ondelete="CASCADE"), index=True)
    doc_type: Mapped[DocumentType] = mapped_column(pg_enum(DocumentType, "document_type"))
    stored_name: Mapped[str] = mapped_column(String(255))     # random name on disk
    original_name: Mapped[str] = mapped_column(String(255))   # what the applicant uploaded
    mime_type: Mapped[str] = mapped_column(String(100))
    size_bytes: Mapped[int] = mapped_column(Integer)

    application: Mapped[Application] = relationship(back_populates="documents")


class AdmissionLetter(TimestampMixin, db.Model):
    __tablename__ = "admission_letters"

    id: Mapped[int] = mapped_column(primary_key=True)
    application_id: Mapped[int] = mapped_column(ForeignKey("applications.id"), unique=True)
    letter_no: Mapped[str | None] = mapped_column(String(50), unique=True)
    pdf_path: Mapped[str | None] = mapped_column(String(255))
    issued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    issued_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    emailed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    download_count: Mapped[int] = mapped_column(Integer, default=0)

    application: Mapped[Application] = relationship(back_populates="letter")
    issued_by: Mapped[User | None] = relationship()

    def assign_letter_no(self) -> None:
        year = (self.issued_at or datetime.now()).year
        self.letter_no = f"KSTVET/CPD/ADM/{year}/{self.id:04d}"


# ---------- Settings (letter signatory, payment details, etc.) ----------

class Setting(db.Model):
    __tablename__ = "settings"

    key: Mapped[str] = mapped_column(String(100), primary_key=True)
    value: Mapped[str] = mapped_column(Text, default="")