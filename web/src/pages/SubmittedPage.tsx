import { Link, Navigate, useLocation } from "react-router";

import { fmtRange } from "../lib/format";
import type { ApplicationCreated } from "../types/api";

export default function SubmittedPage() {
  const result = useLocation().state as ApplicationCreated | null;
  if (!result) return <Navigate to="/" replace />;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="rounded-lg bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <p className="text-sm font-medium text-green-700">Application received</p>
        <h1 className="mt-1 text-2xl font-bold text-brand">Thank you for applying</h1>
        <p className="mt-3 text-slate-700">
          Your application for <strong>{result.programme_title}</strong> ({fmtRange(result.start_date, result.end_date)}) has
          been submitted and is now under review by the KSTVET CPD Office.
        </p>

        <div className="mt-5 rounded-md bg-slate-100 p-4">
          <p className="text-sm text-slate-600">Your reference number</p>
          <p className="text-xl font-mono font-semibold text-brand break-all">{result.reference_no}</p>
          <p className="mt-1 text-xs text-slate-500">Keep this number. You will need it to track your application and when paying fees.</p>
        </div>

        <p className="mt-5 text-sm text-slate-700">
          Once your application is approved, your admission letter will be emailed to <strong>{result.email}</strong>. You will
          also be able to download it from the Track Application page using your reference number and ID number.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <button onClick={() => window.print()} className="rounded-md border border-brand px-4 py-2 text-sm font-medium text-brand">
            Print this page
          </button>
          <Link to="/" className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-light">
            Back to CPD Calendar
          </Link>
        </div>
      </div>
    </div>
  );
}