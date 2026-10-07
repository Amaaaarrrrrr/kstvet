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