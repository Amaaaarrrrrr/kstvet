import type { DeliveryMode } from "../types/api";

// Parse "YYYY-MM-DD" as a local date (avoids timezone shifts).
const toDate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
};

export const fmtDate = (iso: string) =>
  toDate(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export const fmtRange = (start: string, end: string) =>
  start === end ? fmtDate(start) : `${fmtDate(start)} – ${fmtDate(end)}`;

export const fmtKES = (n: number) => `KES ${n.toLocaleString("en-KE")}`;

export const modeLabel: Record<DeliveryMode, string> = {
  physical: "Physical",
  online: "Online",
  blended: "Blended",
};

/** Options for the month filter: this month and the next 11. */
export function nextMonths(count = 12) {
  const now = new Date();
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
    return { value, label };
  });
}