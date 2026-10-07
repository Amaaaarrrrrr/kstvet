import { Link, useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";

import StatusBadge from "../components/StatusBadge";
import { ApiError, apiGet } from "../lib/api";
import { fmtDate, fmtKES, fmtRange, modeLabel } from "../lib/format";
import type { ProgrammeDetail } from "../types/api";

const FAQ = [
  { q: "How do I apply?", a: "Choose an intake below and click Apply now. Fill in the online form and upload your documents. You will receive a reference number and your admission letter by email." },
  { q: "What documents do I need?", a: "A copy of your National ID or passport and your academic and professional certificates. If your employer is sponsoring you, a sponsorship letter." },
  { q: "How do I pay the fee?", a: "Payment instructions are included in your admission letter. Use your reference number when paying." },
];

export default function ProgrammePage() {
  const { slug = "" } = useParams();
  const { data: p, isPending, error } = useQuery({
    queryKey: ["programme", slug],
    queryFn: () => apiGet<ProgrammeDetail>(`/programmes/${slug}`),
  });

  if (isPending) return <p className="mx-auto max-w-6xl px-4 py-8 text-slate-500">Loading…</p>;
  if (error) {
    const notFound = error instanceof ApiError && error.status === 404;
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <p className="text-red-700">{notFound ? "This programme could not be found." : error.message}</p>
        <Link to="/" className="mt-3 inline-block text-brand-light underline">Back to CPD Calendar</Link>
      </div>
    );
  }

  const next = p.intakes.find((i) => i.is_accepting);
  const outcomes = p.learning_outcomes.split("\n").map((s) => s.trim()).filter(Boolean);

  return (
    <div>
      {/* Hero: what it is + the next step, above the fold */}
      <section className="bg-brand text-white">
        <div className="mx-auto max-w-6xl px-4 py-10 grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Link to="/" className="text-sm text-slate-300 hover:text-white">← CPD Calendar</Link>
            <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-accent">{p.category}</p>
            <h1 className="mt-1 text-2xl sm:text-4xl font-bold">{p.title}</h1>
            <p className="mt-3 text-slate-200 max-w-2xl">{p.summary}</p>
          </div>
          <div className="rounded-lg bg-white p-5 text-slate-800 self-start">
            {next ? (
              <>
                <p className="text-sm text-slate-500">Next intake</p>
                <p className="text-lg font-semibold text-brand">{fmtRange(next.start_date, next.end_date)}</p>
                <p className="text-sm text-slate-600">Apply by {fmtDate(next.application_deadline)}</p>
                <Link to={`/apply/${next.public_id}`} className="mt-4 block rounded-md bg-brand px-4 py-2.5 text-center font-medium text-white hover:bg-brand-light">
                  Apply now
                </Link>
              </>
            ) : (
              <p className="text-slate-600">No open intakes right now. Check back soon.</p>
            )}
          </div>
        </div>
      </section>

      {/* Quick facts strip */}
      <section className="border-b border-slate-200 bg-white">
        <dl className="mx-auto max-w-6xl px-4 py-5 grid grid-cols-2 gap-4 sm:grid-cols-4 text-sm">
          <div><dt className="text-slate-500">Duration</dt><dd className="font-semibold">{p.duration_text}</dd></div>
          <div><dt className="text-slate-500">Mode</dt><dd className="font-semibold">{modeLabel[p.mode]}</dd></div>
          <div><dt className="text-slate-500">CPD hours</dt><dd className="font-semibold">{p.cpd_hours ?? "—"}</dd></div>
          <div><dt className="text-slate-500">Fee</dt><dd className="font-semibold">{fmtKES(p.fee_kes)}</dd></div>
        </dl>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-8 grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-8">
          {p.description && (
            <section>
              <h2 className="text-xl font-semibold text-brand">About this programme</h2>
              <p className="mt-2 whitespace-pre-line text-slate-700">{p.description}</p>
            </section>
          )}
          {p.target_audience && (
            <section>
              <h2 className="text-xl font-semibold text-brand">Who should attend</h2>
              <p className="mt-2 whitespace-pre-line text-slate-700">{p.target_audience}</p>
            </section>
          )}
          {outcomes.length > 0 && (
            <section>
              <h2 className="text-xl font-semibold text-brand">What you will learn</h2>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-700">
                {outcomes.map((o) => <li key={o}>{o}</li>)}
              </ul>
            </section>
          )}

          <section>
            <h2 className="text-xl font-semibold text-brand">Upcoming intakes</h2>
            {p.intakes.length === 0 && <p className="mt-2 text-slate-600">No upcoming intakes scheduled.</p>}
            <ul className="mt-3 space-y-3">
              {p.intakes.map((i) => (
                <li key={i.public_id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-white p-4 ring-1 ring-slate-200">
                  <div>
                    <p className="font-medium">{fmtRange(i.start_date, i.end_date)}</p>
                    <p className="text-sm text-slate-600">
                      {i.venue}{i.reporting_time ? ` · Report ${i.reporting_time}` : ""} · Apply by {fmtDate(i.application_deadline)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge intake={i} />
                    {i.is_accepting && (
                      <Link to={`/apply/${i.public_id}`} className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-light">
                        Apply
                      </Link>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <aside className="space-y-6">
          {p.has_brochure && (
            <a href={`/api/programmes/${p.slug}/brochure`} className="block rounded-lg bg-white p-4 text-center font-medium text-brand ring-1 ring-slate-200 hover:bg-slate-50">
              Download programme brochure (PDF)
            </a>
          )}
          <section className="rounded-lg bg-white p-5 ring-1 ring-slate-200">
            <h2 className="font-semibold text-brand">Frequently asked questions</h2>
            <div className="mt-3 divide-y divide-slate-200">
              {FAQ.map((f) => (
                <details key={f.q} className="py-2">
                  <summary className="cursor-pointer text-sm font-medium">{f.q}</summary>
                  <p className="mt-2 text-sm text-slate-600">{f.a}</p>
                </details>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}