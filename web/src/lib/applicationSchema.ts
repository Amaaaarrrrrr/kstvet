import { z } from "zod";
import type { DefaultValues } from "react-hook-form";

const MAX_FILE = 5 * 1024 * 1024;
const OK_TYPES = ["application/pdf", "image/jpeg", "image/png"];

const text = (max: number) => z.string().trim().max(max, `Use at most ${max} characters`);
const required = (max: number) => text(max).min(1, "This field is required");

const file = z
  .instanceof(File, { message: "This document is required" })
  .refine((f) => f.size <= MAX_FILE, "File is larger than 5 MB")
  .refine((f) => OK_TYPES.includes(f.type) || /\.(pdf|jpe?g|png)$/i.test(f.name), "Upload a PDF, JPG or PNG file");

export const applicationSchema = z.object({
  // Personal
  title: text(20),
  first_name: required(80),
  middle_name: text(80),
  surname: required(80),
  id_number: z.string().trim().regex(/^[A-Za-z0-9]{5,30}$/, "Enter a valid ID or passport number (letters and numbers only, at least 5)"),
  gender: z.enum(["", "male", "female", "other", "prefer_not_to_say"]),
  date_of_birth: z.string(),
  nationality: required(80),
  // Contact
  phone: z.string().trim().regex(/^\+?[0-9]{9,15}$/, "Enter a valid phone number, e.g. +254712345678"),
  email: z.string().trim().email("Enter a valid email address"),
  county: text(80),
  postal_address: text(255),
  // Academic and professional
  highest_qualification: required(150),
  institution: required(200),
  year_completed: z.string().regex(/^$|^(19[6-9]\d|20\d\d)$/, "Enter a 4-digit year"),
  employer: text(200),
  job_title: text(150),
  professional_body: text(150),
  membership_no: text(60),
  sponsorship: z.enum(["self", "employer"]),
  // Documents
  national_id: file,
  academic_cert: file,
  professional_cert: file.optional(),
  cv: file.optional(),
  sponsorship_letter: file.optional(),
  // Review
  special_needs: text(1000),
  how_heard: text(100),
  consent_given: z.boolean().refine((v) => v, "You must accept the declaration to submit"),
});

export type ApplicationFormValues = z.infer<typeof applicationSchema>;

export const DOC_FIELDS = [
  { name: "national_id", label: "National ID or passport", required: true },
  { name: "academic_cert", label: "Academic certificate (highest qualification)", required: true },
  { name: "professional_cert", label: "Professional certificate", required: false },
  { name: "cv", label: "CV", required: false },
  { name: "sponsorship_letter", label: "Employer sponsorship letter", required: false },
] as const;

export const defaultValues: DefaultValues<ApplicationFormValues> = {
  title: "", first_name: "", middle_name: "", surname: "", id_number: "", gender: "",
  date_of_birth: "", nationality: "Kenyan", phone: "", email: "", county: "", postal_address: "",
  highest_qualification: "", institution: "", year_completed: "", employer: "", job_title: "",
  professional_body: "", membership_no: "", sponsorship: "self",
  special_needs: "", how_heard: "", consent_given: false,
};

/** Turn form values into the JSON the API expects (files are sent separately). */
export function toPayload(values: ApplicationFormValues, intakeId: string) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { national_id, academic_cert, professional_cert, cv, sponsorship_letter, year_completed, ...rest } = values;
  return { ...rest, intake_id: intakeId, year_completed: year_completed ? Number(year_completed) : null };
}