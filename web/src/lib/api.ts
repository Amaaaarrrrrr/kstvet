export class ApiError extends Error {
  status: number;
  fields?: Record<string, string>;
  constructor(status: number, message: string, fields?: Record<string, string>) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

async function parseError(res: Response): Promise<ApiError> {
  const body = await res.json().catch(() => null);
  return new ApiError(res.status, body?.message ?? `Request failed (${res.status})`, body?.fields);
}

export async function apiGet<T>(path: string, params?: Record<string, string | undefined>): Promise<T> {
  const entries = Object.entries(params ?? {}).filter(([, v]) => v) as [string, string][];
  const qs = new URLSearchParams(entries).toString();
  const res = await fetch(`/api${path}${qs ? `?${qs}` : ""}`);
  if (!res.ok) throw await parseError(res);
  return res.json() as Promise<T>;
}

export async function apiPostForm<T>(path: string, body: FormData): Promise<T> {
  const res = await fetch(`/api${path}`, { method: "POST", body });
  if (!res.ok) throw await parseError(res);
  return res.json() as Promise<T>;
}

export async function apiPostJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw await parseError(res);
  return res.json() as Promise<T>;
}