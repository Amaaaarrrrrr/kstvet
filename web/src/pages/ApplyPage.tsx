import { Link, useParams } from "react-router";

export default function ApplyPage() {
  const { intakeId } = useParams();
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold text-brand">Application form</h1>
      <p className="mt-2 text-slate-600">Coming in Phase 3. Intake: <code>{intakeId}</code></p>
      <Link to="/" className="mt-4 inline-block text-brand-light underline">Back to CPD Calendar</Link>
    </div>
  );
}