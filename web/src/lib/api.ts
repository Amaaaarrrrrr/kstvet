export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function apiGet<T>(path: string, params?: Record<string, string | undefined>): Promise<T> {
  const entries = Object.entries(params ?? {}).filter(([, v]) => v) as [string, string][];
  const qs = new URLSearchParams(entries).toString();
  const res = await fetch(`/api${path}${qs ? `?${qs}` : ""}`);
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.message) message = body.message;
    } catch {
      /* response was not JSON */
    }
    throw new ApiError(res.status, message);
  }
  return res.json() as Promise<T>;
}