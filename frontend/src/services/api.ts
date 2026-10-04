const DEFAULT_BASE = 'http://localhost:4000/api';
const BASE: string = import.meta.env.VITE_API_URL ?? DEFAULT_BASE;
/** Where the API lives (VITE_API_URL). Exposed so the login page can check it. */
export const API_BASE = BASE;
/** True when VITE_API_URL was never set: fine on your laptop, a mistake on a deployed site. */
export const API_BASE_IS_DEFAULT = !import.meta.env.VITE_API_URL;
export const TOKEN_KEY = 'sc_token';

export class ApiError extends Error {
  constructor(public status: number, message: string, public issues?: { path: string; message: string }[]) { super(message); }
}

export async function api<T = unknown>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const token = localStorage.getItem(TOKEN_KEY);
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }), ...init.headers },
      body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
    });
  } catch {
    // fetch only throws when no response could be read: server down, wrong URL, or blocked by CORS / a login wall
    throw new ApiError(0, `Cannot reach the server${BASE === DEFAULT_BASE && !import.meta.env.DEV ? ' (this site was built without VITE_API_URL)' : ''}. Check your connection; if you run this site, see the server status shown on the login page.`);
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  let data: any = {};
  let isJson = true;
  try { data = text ? JSON.parse(text) : {}; } catch { isJson = false; /* an HTML error page from the platform, not from our API */ }
  if (res.status === 401 && token) { localStorage.removeItem(TOKEN_KEY); window.dispatchEvent(new Event('sc:logout')); }
  if (!res.ok) throw new ApiError(res.status, data.message ?? (isJson ? 'Request failed' : `The server returned an unexpected response (HTTP ${res.status}). If this is your own deployment, see the server status on the login page.`), data.issues);
  return data as T;
}
