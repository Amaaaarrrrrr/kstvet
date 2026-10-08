import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import type { FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Field, fmtSize, inputCls } from "../components/form";
import { ApiError, apiGet, apiPostForm } from "../lib/api";
import { applicationSchema, defaultValues, DOC_FIELDS, toPayload } from "../lib/applicationSchema";
import type { ApplicationFormValues } from "../lib/applicationSchema";
import { fmtDate, fmtKES, fmtRange, modeLabel } from "../lib/format";
import type { ApplicationCreated, Intake } from "../types/api";

type Name = keyof ApplicationFormValues;

const STEPS: { title: string; fields: Name[] }[] = [
  { title: "Personal details", fields: ["title", "first_name", "middle_name", "surname", "id_number", "gender", "date_of_birth", "nationality"] },
  { title: "Contact details", fields: ["phone", "email", "county", "postal_address"] },
  { title: "Academic & professional", fields: ["highest_qualification", "institution", "year_completed", "employer", "job_title", "professional_body", "membership_no", "sponsorship"] },
  { title: "Documents", fields: ["national_id", "academic_cert", "professional_cert", "cv", "sponsorship_letter"] },
  { title: "Review & submit", fields: ["special_needs", "how_heard", "consent_given"] },
];
const LAST = STEPS.length - 1;
const stepOf = (name: string) => {
  const i = STEPS.findIndex((s) => (s.fields as string[]).includes(name));
  return i === -1 ? LAST : i;
};

export default function ApplyPage() {
  const { intakeId = "" } = useParams();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [banner, setBanner] = useState<string | null>(null);

  const intakeQuery = useQuery({
    queryKey: ["intake", intakeId],
    queryFn: () => apiGet<Intake>(`/intakes/${intakeId}`),
  });

  const form = useForm<ApplicationFormValues>({
    resolver: zodResolver(applicationSchema),
    defaultValues,
    mode: "onTouched",
  });
  const { register, control, handleSubmit, trigger, setError, getValues, watch, formState: { errors } } = form;
  const err = (n: Name) => errors[n]?.message as string | undefined;

  const submit = useMutation({
    mutationFn: (values: ApplicationFormValues) => {
      const fd = new FormData();
      fd.append("data", JSON.stringify(toPayload(values, intakeId)));
      for (const d of DOC_FIELDS) {
        const f = values[d.name];
        if (f) fd.append(d.name, f);
      }
      return apiPostForm<ApplicationCreated>("/applications", fd);
    },
    onSuccess: (result) => navigate("/applications/submitted", { state: result, replace: true }),
    onError: (e) => {
      if (e instanceof ApiError && e.fields) {
        // Server-side validation: show each message on its field and jump to the first step with a problem.
        let first = LAST;
        for (const [name, message] of Object.entries(e.fields)) {
          setError(name as Name, { type: "server", message });
          first = Math.min(first, stepOf(name));
        }
        setStep(first);
        setBanner("Please correct the highlighted fields.");
      } else {
        setBanner(e.message);
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
  });

  const goNext = async () => {
    const ok = await trigger(STEPS[step].fields);
    if (step === 3 && getValues("sponsorship") === "employer" && !getValues("sponsorship_letter")) {
      setError("sponsorship_letter", { type: "manual", message: "Required when your employer is sponsoring you" });
      return;
    }
    if (ok) {
      setBanner(null);
      setStep((s) => s + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const onInvalid = (errs: FieldErrors<ApplicationFormValues>) => {
    const first = Math.min(...Object.keys(errs).map(stepOf));
    setStep(first);
    setBanner("Please correct the highlighted fields.");
  };

  // ----- Intake states -----
  if (intakeQuery.isPending) return <p className="mx-auto max-w-3xl px-4 py-10 text-slate-500">Loading…</p>;
  if (intakeQuery.isError) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <p className="text-red-700">{intakeQuery.error.message}</p>
        <Link to="/" className="mt-3 inline-block text-brand-light underline">Back to CPD Calendar</Link>
      </div>
    );
  }
  const intake = intakeQuery.data;
  if (!intake.is_accepting) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-2xl font-bold text-brand">{intake.programme.title}</h1>
        <p className="mt-2 text-slate-700">This intake is no longer accepting applications.</p>
        <Link to={`/programmes/${intake.programme.slug}`} className="mt-3 inline-block text-brand-light underline">See other intakes</Link>
      </div>
    );
  }

  const values = watch();
  const sponsored = values.sponsorship === "employer";

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* Locked programme summary */}
      <div className="rounded-lg bg-brand p-5 text-white">
        <p className="text-xs uppercase tracking-wide text-accent">Applying for</p>
        <h1 className="text-xl font-bold">{intake.programme.title}</h1>
        <p className="mt-1 text-sm text-slate-200">
          {fmtRange(intake.start_date, intake.end_date)} · {modeLabel[intake.programme.mode]} · {intake.venue} · {fmtKES(intake.programme.fee_kes)}
        </p>
        <p className="mt-1 text-xs text-slate-300">Apply by {fmtDate(intake.application_deadline)}</p>
      </div>

      {/* Step indicator */}
      <ol className="mt-6 flex flex-wrap gap-2 text-xs">
        {STEPS.map((s, i) => (
          <li key={s.title} className={`rounded-full px-3 py-1 ${i === step ? "bg-brand text-white" : i < step ? "bg-green-100 text-green-800" : "bg-slate-200 text-slate-600"}`}>
            {i + 1}. {s.title}
          </li>
        ))}
      </ol>

      {banner && <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-800" role="alert">{banner}</p>}

      <form
        noValidate
        className="mt-6 rounded-lg bg-white p-5 shadow-sm ring-1 ring-slate-200"
        onSubmit={(e) => {
          if (step < LAST) {
            e.preventDefault();
            void goNext();
          } else {
            void handleSubmit((v) => submit.mutate(v), onInvalid)(e);
          }
        }}
      >
        <h2 className="text-lg font-semibold text-brand">{STEPS[step].title}</h2>

        {/* Step 1 — Personal */}
        <div hidden={step !== 0} className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Title" name="title" error={err("title")}>
            <select id="title" className={inputCls} {...register("title")}>
              <option value="">—</option><option>Mr</option><option>Ms</option><option>Mrs</option><option>Dr</option><option>Prof</option><option>Eng</option>
            </select>
          </Field>
          <Field label="First name" name="first_name" required error={err("first_name")}>
            <input id="first_name" className={inputCls} aria-invalid={!!errors.first_name} {...register("first_name")} />
          </Field>
          <Field label="Middle name" name="middle_name" error={err("middle_name")}>
            <input id="middle_name" className={inputCls} {...register("middle_name")} />
          </Field>
          <Field label="Surname" name="surname" required error={err("surname")}>
            <input id="surname" className={inputCls} aria-invalid={!!errors.surname} {...register("surname")} />
          </Field>
          <Field label="National ID / Passport No." name="id_number" required error={err("id_number")}>
            <input id="id_number" className={inputCls} aria-invalid={!!errors.id_number} {...register("id_number")} />
          </Field>
          <Field label="Gender" name="gender" error={err("gender")}>
            <select id="gender" className={inputCls} {...register("gender")}>
              <option value="">—</option><option value="female">Female</option><option value="male">Male</option>
              <option value="other">Other</option><option value="prefer_not_to_say">Prefer not to say</option>
            </select>
          </Field>
          <Field label="Date of birth" name="date_of_birth" error={err("date_of_birth")}>
            <input id="date_of_birth" type="date" className={inputCls} aria-invalid={!!errors.date_of_birth} {...register("date_of_birth")} />
          </Field>
          <Field label="Nationality" name="nationality" required error={err("nationality")}>
            <input id="nationality" className={inputCls} aria-invalid={!!errors.nationality} {...register("nationality")} />
          </Field>
        </div>

        {/* Step 2 — Contact */}
        <div hidden={step !== 1} className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Phone number" name="phone" required hint="e.g. +254712345678" error={err("phone")}>
            <input id="phone" type="tel" className={inputCls} aria-invalid={!!errors.phone} {...register("phone")} />
          </Field>
          <Field label="Email address" name="email" required hint="Your admission letter will be sent here" error={err("email")}>
            <input id="email" type="email" className={inputCls} aria-invalid={!!errors.email} {...register("email")} />
          </Field>
          <Field label="County of residence" name="county" error={err("county")}>
            <input id="county" className={inputCls} {...register("county")} />
          </Field>
          <Field label="Postal address" name="postal_address" error={err("postal_address")}>
            <input id="postal_address" className={inputCls} {...register("postal_address")} />
          </Field>
        </div>

        {/* Step 3 — Academic & professional */}
        <div hidden={step !== 2} className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Highest qualification" name="highest_qualification" required hint="e.g. Diploma in Electrical Engineering" error={err("highest_qualification")}>
            <input id="highest_qualification" className={inputCls} aria-invalid={!!errors.highest_qualification} {...register("highest_qualification")} />
          </Field>
          <Field label="Institution" name="institution" required error={err("institution")}>
            <input id="institution" className={inputCls} aria-invalid={!!errors.institution} {...register("institution")} />
          </Field>
          <Field label="Year completed" name="year_completed" error={err("year_completed")}>
            <input id="year_completed" inputMode="numeric" maxLength={4} className={inputCls} aria-invalid={!!errors.year_completed} {...register("year_completed")} />
          </Field>
          <Field label="Current employer" name="employer" error={err("employer")}>
            <input id="employer" className={inputCls} {...register("employer")} />
          </Field>
          <Field label="Job title" name="job_title" error={err("job_title")}>
            <input id="job_title" className={inputCls} {...register("job_title")} />
          </Field>
          <Field label="Professional body" name="professional_body" error={err("professional_body")}>
            <input id="professional_body" className={inputCls} {...register("professional_body")} />
          </Field>
          <Field label="Membership number" name="membership_no" error={err("membership_no")}>
            <input id="membership_no" className={inputCls} {...register("membership_no")} />
          </Field>
          <Field label="Who is paying the fee?" name="sponsorship" required error={err("sponsorship")}>
            <select id="sponsorship" className={inputCls} {...register("sponsorship")}>
              <option value="self">Self-sponsored</option>
              <option value="employer">Employer-sponsored</option>
            </select>
          </Field>
        </div>

        {/* Step 4 — Documents */}
        <div hidden={step !== 3} className="mt-4 space-y-4">
          <p className="text-sm text-slate-600">PDF, JPG or PNG, up to 5 MB each.</p>
          {DOC_FIELDS.map((d) => {
            const isRequired = d.required || (d.name === "sponsorship_letter" && sponsored);
            if (d.name === "sponsorship_letter" && !sponsored) return null;
            return (
              <Controller
                key={d.name}
                control={control}
                name={d.name}
                render={({ field, fieldState }) => (
                  <Field label={d.label} name={d.name} required={isRequired} error={fieldState.error?.message}>
                    <input
                      id={d.name}
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                      className="mt-1 block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-brand file:px-3 file:py-2 file:text-white"
                      aria-invalid={!!fieldState.error}
                      onChange={(e) => field.onChange(e.target.files?.[0])}
                      onBlur={field.onBlur}
                    />
                    {field.value && (
                      <p className="mt-1 text-xs text-green-800">
                        Selected: {field.value.name} ({fmtSize(field.value.size)})
                      </p>
                    )}
                  </Field>
                )}
              />
            );
          })}
        </div>

        {/* Step 5 — Review & submit */}
        <div hidden={step !== LAST} className="mt-4 space-y-5">
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            {[
              ["Name", [values.title, values.first_name, values.middle_name, values.surname].filter(Boolean).join(" ")],
              ["ID / Passport", values.id_number],
              ["Phone", values.phone],
              ["Email", values.email],
              ["Qualification", values.highest_qualification],
              ["Institution", values.institution],
              ["Employer", values.employer || "—"],
              ["Sponsorship", values.sponsorship === "employer" ? "Employer" : "Self"],
              ["Documents", DOC_FIELDS.filter((d) => values[d.name]).map((d) => d.label).join(", ") || "—"],
            ].map(([k, v]) => (
              <div key={k}><dt className="text-slate-500">{k}</dt><dd className="font-medium break-words">{v}</dd></div>
            ))}
          </dl>
          <button type="button" className="text-sm text-brand-light underline" onClick={() => setStep(0)}>Edit details</button>

          <Field label="Special needs or accessibility requirements" name="special_needs" error={err("special_needs")}>
            <textarea id="special_needs" rows={3} className={inputCls} {...register("special_needs")} />
          </Field>
          <Field label="How did you hear about this programme?" name="how_heard" error={err("how_heard")}>
            <select id="how_heard" className={inputCls} {...register("how_heard")}>
              <option value="">—</option><option>KSTVET website</option><option>Employer</option>
              <option>Social media</option><option>Colleague / friend</option><option>Other</option>
            </select>
          </Field>

          <div>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" aria-invalid={!!errors.consent_given} {...register("consent_given")} />
              <span>
                I confirm that the information provided is true and complete, and I consent to KSTVET processing my
                personal data for this application in line with the Data Protection Act, 2019.
              </span>
            </label>
            {err("consent_given") && <p className="mt-1 text-xs text-red-700" role="alert">{err("consent_given")}</p>}
          </div>
        </div>

        {/* Navigation */}
        <div className="mt-8 flex justify-between gap-3">
          <button
            type="button"
            disabled={step === 0}
            onClick={() => setStep((s) => s - 1)}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm disabled:opacity-40"
          >
            Back
          </button>
          {step < LAST ? (
            <button type="submit" className="rounded-md bg-brand px-5 py-2 text-sm font-medium text-white hover:bg-brand-light">
              Next
            </button>
          ) : (
            <button
              type="submit"
              disabled={submit.isPending}
              className="rounded-md bg-brand px-5 py-2 text-sm font-medium text-white hover:bg-brand-light disabled:opacity-60"
            >
              {submit.isPending ? "Submitting…" : "Submit application"}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}