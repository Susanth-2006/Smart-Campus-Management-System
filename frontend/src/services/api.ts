const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api';
export const TOKEN_KEY = 'sc_token';

export class ApiError extends Error {
  constructor(public status: number, message: string, public issues?: { path: string; message: string }[]) { super(message); }
}

export async function api<T = unknown>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const token = localStorage.getItem(TOKEN_KEY);
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }), ...init.headers },
    body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && token) { localStorage.removeItem(TOKEN_KEY); window.dispatchEvent(new Event('sc:logout')); }
  if (!res.ok) throw new ApiError(res.status, data.message ?? 'Request failed', data.issues);
  return data as T;
}
