import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";

import { Field, inputCls } from "../components/form";
import { apiPostJson } from "../lib/api";
import { fmtDate, fmtRange } from "../lib/format";
import type { ApplicationStatus, TrackResult } from "../types/api";

const STATUS: Record<ApplicationStatus, { label: string; style: string; text: string }> = {
  submitted: { label: "Received", style: "bg-blue-100 text-blue-800", text: "Your application has been received and is waiting to be reviewed by the CPD Office." },
  under_review: { label: "Under review", style: "bg-amber-100 text-amber-800", text: "The CPD Office is reviewing your application and documents." },
  admitted: { label: "Admitted", style: "bg-green-100 text-green-800", text: "Congratulations! You have been admitted. Download your admission letter below." },
  rejected: { label: "Not successful", style: "bg-red-100 text-red-800", text: "Unfortunately your application was not successful. Contact the CPD Office for more information." },
  withdrawn: { label: "Withdrawn", style: "bg-slate-200 text-slate-700", text: "This application has been withdrawn." },
};

export default function TrackPage() {
  const [ref, setRef] = useState("");
  const [idNo, setIdNo] = useState("");

  const track = useMutation({
    mutationFn: () => apiPostJson<TrackResult>("/track", { reference_no: ref, id_number: idNo }),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    track.mutate();
  };

  const r = track.data;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-bold text-brand">Track your application</h1>
      <p className="mt-2 text-slate-600">Enter the reference number you received when you applied, and your ID or passport number.</p>

      <form onSubmit={onSubmit} className="mt-6 grid gap-4 rounded-lg bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:grid-cols-2">
        <Field label="Reference number" name="ref" required hint="e.g. KSTVET/CPD/2026/0001">
          <input id="ref" className={inputCls} value={ref} onChange={(e) => setRef(e.target.value)} required />
        </Field>
        <Field label="ID / Passport number" name="id_no" required>
          <input id="id_no" className={inputCls} value={idNo} onChange={(e) => setIdNo(e.target.value)} required />
        </Field>
        <div className="sm:col-span-2">
          <button type="submit" disabled={track.isPending} className="rounded-md bg-brand px-5 py-2 text-sm font-medium text-white hover:bg-brand-light disabled:opacity-60">
            {track.isPending ? "Checking…" : "Check status"}
          </button>
        </div>
      </form>

      {track.isError && <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-800" role="alert">{track.error.message}</p>}

      {r && (
        <section className="mt-6 rounded-lg bg-white p-5 shadow-sm ring-1 ring-slate-200" aria-live="polite">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-sm text-slate-500">{r.reference_no}</p>
              <h2 className="text-lg font-semibold text-brand">{r.programme_title}</h2>
              <p className="text-sm text-slate-600">{fmtRange(r.start_date, r.end_date)} · Applicant: {r.applicant_name}</p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS[r.status].style}`}>{STATUS[r.status].label}</span>
          </div>
          <p className="mt-4 text-slate-700">{STATUS[r.status].text}</p>

          {r.letter && (
            <div className="mt-5 rounded-md bg-green-50 p-4">
              <p className="text-sm text-green-900">
                Admission letter {r.letter.letter_no}, issued {fmtDate(r.letter.issued_at.slice(0, 10))}
              </p>
              <a href={r.letter.download_url} className="mt-3 inline-block rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-light">
                Download admission letter (PDF)
              </a>
              <p className="mt-2 text-xs text-slate-500">For your security this link expires in 1 hour.</p>
            </div>
          )}
        </section>
      )}
    </div>
  );
}