// Keep in sync with api/app/schemas.py
export type DeliveryMode = "physical" | "online" | "blended";
export type IntakeStatus = "open" | "closed" | "full" | "cancelled";

export interface ProgrammeSummary {
  slug: string;
  title: string;
  category: string;
  summary: string;
  duration_text: string;
  mode: DeliveryMode;
  cpd_hours: number | null;
  fee_kes: number;
}

export interface IntakeBrief {
  public_id: string;
  start_date: string;           // "YYYY-MM-DD"
  end_date: string;
  venue: string;
  application_deadline: string;
  reporting_time: string | null;
  status: IntakeStatus;
  is_accepting: boolean;
}

export interface Intake extends IntakeBrief {
  programme: ProgrammeSummary;
}

export interface ProgrammeDetail extends ProgrammeSummary {
  description: string;
  target_audience: string;
  learning_outcomes: string;
  has_brochure: boolean;
  intakes: IntakeBrief[];
}

export interface ApplicationCreated {
  reference_no: string;
  public_id: string;
  status: string;
  email: string;
  programme_title: string;
  start_date: string;
  end_date: string;
}

export type ApplicationStatus = "submitted" | "under_review" | "admitted" | "rejected" | "withdrawn";

export interface TrackResult {
  reference_no: string;
  status: ApplicationStatus;
  applicant_name: string;
  programme_title: string;
  start_date: string;
  end_date: string;
  submitted_at: string;
  letter: { letter_no: string; issued_at: string; download_url: string } | null;
}