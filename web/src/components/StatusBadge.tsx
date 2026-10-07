import type { IntakeBrief } from "../types/api";

export default function StatusBadge({ intake }: { intake: IntakeBrief }) {
  let label = "Closed";
  let style = "bg-slate-200 text-slate-700";
  if (intake.is_accepting) {
    label = "Open for applications";
    style = "bg-green-100 text-green-800";
  } else if (intake.status === "full") {
    label = "Full";
    style = "bg-amber-100 text-amber-800";
  }
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${style}`}>{label}</span>;
}