import { Link } from "react-router";

export default function NotFoundPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold text-brand">Page not found</h1>
      <Link to="/" className="mt-4 inline-block text-brand-light underline">Go to the CPD Calendar</Link>
    </div>
  );
}