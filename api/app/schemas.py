from datetime import date
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator

from app.models import DeliveryMode, IntakeStatus, Sponsorship


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class ProgrammeSummary(ORMModel):
    slug: str
    title: str
    category: str
    summary: str
    duration_text: str
    mode: DeliveryMode
    cpd_hours: int | None
    fee_kes: int


class IntakeBrief(ORMModel):
    public_id: UUID
    start_date: date
    end_date: date
    venue: str
    application_deadline: date
    reporting_time: str | None
    status: IntakeStatus
    is_accepting: bool


class IntakeOut(IntakeBrief):
    programme: ProgrammeSummary


class ProgrammeDetail(ProgrammeSummary):
    description: str
    target_audience: str
    learning_outcomes: str
    has_brochure: bool
    intakes: list[IntakeBrief]

# ---------- Application form (Phase 3) ----------

class ApplicationCreate(BaseModel):
    """Text fields of the application form. Files are validated separately."""
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    intake_id: UUID

    # Personal
    title: str | None = Field(None, max_length=20)
    first_name: str = Field(min_length=1, max_length=80)
    middle_name: str | None = Field(None, max_length=80)
    surname: str = Field(min_length=1, max_length=80)
    id_number: str = Field(min_length=5, max_length=30, pattern=r"^[A-Za-z0-9]+$")
    gender: Literal["male", "female", "other", "prefer_not_to_say"] | None = None
    date_of_birth: date | None = None
    nationality: str = Field("Kenyan", max_length=80)

    # Contact
    phone: str = Field(pattern=r"^\+?[0-9]{9,15}$")
    email: EmailStr
    county: str | None = Field(None, max_length=80)
    postal_address: str | None = Field(None, max_length=255)

    # Academic and professional
    highest_qualification: str = Field(min_length=1, max_length=150)
    institution: str = Field(min_length=1, max_length=200)
    year_completed: int | None = Field(None, ge=1960, le=date.today().year)
    employer: str | None = Field(None, max_length=200)
    job_title: str | None = Field(None, max_length=150)
    professional_body: str | None = Field(None, max_length=150)
    membership_no: str | None = Field(None, max_length=60)
    sponsorship: Sponsorship = Sponsorship.SELF

    # Other
    special_needs: str | None = Field(None, max_length=1000)
    how_heard: str | None = Field(None, max_length=100)
    consent_given: bool

    @model_validator(mode="before")
    @classmethod
    def blank_strings_to_none(cls, data):
        # HTML forms send "" for empty optional fields; treat those as missing.
        if isinstance(data, dict):
            return {k: (None if v == "" else v) for k, v in data.items()}
        return data

    @field_validator("id_number")
    @classmethod
    def upper_id(cls, v: str) -> str:
        return v.upper()

    @field_validator("email")
    @classmethod
    def lower_email(cls, v: str) -> str:
        return v.lower()

    @field_validator("date_of_birth")
    @classmethod
    def adult(cls, v: date | None) -> date | None:
        if v is None:
            return v
        today = date.today()
        age = today.year - v.year - ((today.month, today.day) < (v.month, v.day))
        if age < 16 or age > 100:
            raise ValueError("Enter a valid date of birth (age 16–100)")
        return v

    @field_validator("consent_given")
    @classmethod
    def must_consent(cls, v: bool) -> bool:
        if not v:
            raise ValueError("You must accept the declaration to submit")
        return v


class ApplicationCreated(BaseModel):
    reference_no: str
    public_id: UUID
    status: str
    email: str
    programme_title: str
    start_date: date
    end_date: date