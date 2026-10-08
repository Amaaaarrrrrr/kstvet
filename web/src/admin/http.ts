import { HttpError } from "react-admin";

export function csrfToken(): string {
  const m = document.cookie.match(/(?:^|;\s*)csrf_access_token=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : "";
}

/** Fetch from /api/admin with cookies + CSRF; throws react-admin HttpError with field errors. */
export async function adminFetch<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase();
  const headers = new Headers(init.headers);
  if (method !== "GET") headers.set("X-CSRF-TOKEN", csrfToken());
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`/api/admin${path}`, { ...init, headers, credentials: "same-origin" });
  const body = await res.json().catch(() => null);

  if (!res.ok) {
    const fields = (body?.fields ?? {}) as Record<string, string>;
    const message: string = fields.form ?? body?.message ?? `Request failed (${res.status})`;
    // { errors } lets react-admin show server messages under the matching inputs.
    throw new HttpError(message, res.status, { errors: fields });
  }
  return body as T;
}