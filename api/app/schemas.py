from datetime import date
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.models import DeliveryMode, IntakeStatus


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