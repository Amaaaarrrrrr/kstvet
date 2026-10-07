import { useDeferredValue, useState } from "react";
import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";

import StatusBadge from "../components/StatusBadge";
import { apiGet } from "../lib/api";
import { fmtDate, fmtKES, fmtRange, modeLabel, nextMonths } from "../lib/format";
import type { DeliveryMode, Intake } from "../types/api";

const field = "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-2 focus:outline-brand-light";

export default function CalendarPage() {
  const [month, setMonth] = useState("");
  const [category, setCategory] = useState("");
  const [mode, setMode] = useState<"" | DeliveryMode>("");
  const [search, setSearch] = useState("");
  const q = useDeferredValue(search.trim());

  const categories = useQuery({ queryKey: ["categories"], queryFn: () => apiGet<string[]>("/categories") });
  const intakes = useQuery({
    queryKey: ["intakes", { month, category, mode, q }],
    queryFn: () => apiGet<Intake[]>("/intakes", { month, category, mode, q }),
  });

  const hasFilters = month || category || mode || search;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl sm:text-3xl font-bold text-brand">CPD Calendar</h1>
      <p className="mt-2 text-slate-600 max-w-2xl">
        Browse upcoming Continuing Professional Development programmes at KSTVET, then apply online in a few minutes.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <input className={field} placeholder="Search programmes…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search programmes" />
        <select className={field} value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Month">
          <option value="">All months</option>
          {nextMonths().map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
        <select className={field} value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category">
          <option value="">All categories</option>
          {categories.data?.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className={field} value={mode} onChange={(e) => setMode(e.target.value as "" | DeliveryMode)} aria-label="Mode">
          <option value="">All modes</option>
          <option value="physical">Physical</option>
          <option value="online">Online</option>
          <option value="blended">Blended</option>
        </select>
      </div>
      {hasFilters && (
        <button
          className="mt-2 text-sm text-brand-light underline"
          onClick={() => { setMonth(""); setCategory(""); setMode(""); setSearch(""); }}
        >
          Clear filters
        </button>
      )}

      <section className="mt-6 space-y-4" aria-live="polite">
        {intakes.isPending && <p className="text-slate-500">Loading programmes…</p>}
        {intakes.isError && <p className="text-red-700">Could not load the calendar: {intakes.error.message}</p>}
        {intakes.data?.length === 0 && (
          <p className="rounded-lg bg-white p-6 text-slate-600 shadow-sm">No programmes match your filters.</p>
        )}

        {intakes.data?.map((intake) => (
          <article key={intake.public_id} className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wide text-brand-light">{intake.programme.category}</span>
                <h2 className="text-lg font-semibold text-brand">
                  <Link to={`/programmes/${intake.programme.slug}`} className="hover:underline">{intake.programme.title}</Link>
                </h2>
              </div>
              <StatusBadge intake={intake} />
            </div>

            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3 lg:grid-cols-6">
              <div><dt className="text-slate-500">Dates</dt><dd className="font-medium">{fmtRange(intake.start_date, intake.end_date)}</dd></div>
              <div><dt className="text-slate-500">Duration</dt><dd className="font-medium">{intake.programme.duration_text}</dd></div>
              <div><dt className="text-slate-500">Mode</dt><dd className="font-medium">{modeLabel[intake.programme.mode]}</dd></div>
              <div><dt className="text-slate-500">Venue</dt><dd className="font-medium">{intake.venue}</dd></div>
              <div><dt className="text-slate-500">Fee</dt><dd className="font-medium">{fmtKES(intake.programme.fee_kes)}</dd></div>
              <div><dt className="text-slate-500">Apply by</dt><dd className="font-medium">{fmtDate(intake.application_deadline)}</dd></div>
            </dl>

            <div className="mt-4 flex flex-wrap gap-2">
              <Link to={`/programmes/${intake.programme.slug}`} className="rounded-md border border-brand px-4 py-2 text-sm font-medium text-brand hover:bg-slate-50">
                View details
              </Link>
              {intake.is_accepting && (
                <Link to={`/apply/${intake.public_id}`} className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-light">
                  Apply now
                </Link>
              )}
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}