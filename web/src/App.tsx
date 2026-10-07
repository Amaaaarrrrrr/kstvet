import { useEffect, useState } from "react";

type Health = { status: string; database: string };

export default function App() {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setHealth)
      .catch((e) => setError(String(e)));
  }, []);

  return (
    <main style={{ fontFamily: "sans-serif", padding: 32 }}>
      <h1>KSTVET CPD Platform</h1>
      {error && <p style={{ color: "red" }}>API error: {error}</p>}
      {health ? (
        <p>API: {health.status} · Database: {health.database}</p>
      ) : (
        !error && <p>Checking API…</p>
      )}
    </main>
  );
}