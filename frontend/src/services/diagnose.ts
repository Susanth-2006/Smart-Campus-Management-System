/**
 * "Is my API reachable and healthy?" for the login page.
 * Pure function (no React, no import.meta) so it can be unit-tested with a fake fetch.
 * The problems it names are the ones people really hit when deploying frontend and backend separately.
 */
export type ApiStatus =
  | { kind: 'checking' }
  | { kind: 'ok' }
  | { kind: 'problem'; code: 'not-configured' | 'unreachable' | 'blocked' | 'protected' | 'wrong-url' | 'bad-response' | 'db' | 'empty-db'; title: string; hint: string };

interface Opts { fetchImpl?: typeof fetch; isProd: boolean; usingDefaultBase: boolean; origin: string; timeoutMs?: number }

const problem = (code: Extract<ApiStatus, { kind: 'problem' }>['code'], title: string, hint: string): ApiStatus => ({ kind: 'problem', code, title, hint });

async function withTimeout<T>(fn: (signal: AbortSignal) => Promise<T>, ms: number): Promise<T> {
  const c = new AbortController(); const id = setTimeout(() => c.abort(), ms);
  try { return await fn(c.signal); } finally { clearTimeout(id); }
}

export async function diagnoseApi(base: string, o: Opts): Promise<ApiStatus> {
  const f = o.fetchImpl ?? fetch, ms = o.timeoutMs ?? 12_000, url = `${base.replace(/\/$/, '')}/health`;

  if (o.isProd && o.usingDefaultBase) {
    return problem('not-configured', 'This site does not know where its server is.',
      'The frontend was built without VITE_API_URL. In Vercel: frontend project → Settings → Environment Variables → add VITE_API_URL = https://YOUR-BACKEND.vercel.app/api, then Redeploy (the value is baked in at build time).');
  }

  let res: Response;
  try {
    res = await withTimeout((signal) => f(url, { signal, headers: { Accept: 'application/json' } }), ms);
  } catch {
    // Could not read any response. A "no-cors" request tells us whether something is answering at all.
    const answers = await withTimeout((signal) => f(url, { mode: 'no-cors', signal }), ms).then(() => true, () => false);
    return answers
      ? problem('blocked', 'The server answered, but the browser blocked the reply.',
          `Two usual causes: (1) Vercel "Deployment Protection" is switched on for the BACKEND project: turn it off under Settings → Deployment Protection. (2) CORS: the backend's CLIENT_ORIGIN must contain exactly ${o.origin} (then redeploy the backend).`)
      : problem('unreachable', 'Cannot reach the server.',
          `Nothing answered at ${url}. Check that VITE_API_URL is right (it must end with /api), that the backend deployment is live, and that you are online.`);
  }

  const type = res.headers.get('content-type') ?? '';
  let body: any = null;
  if (type.includes('json')) { try { body = await res.json(); } catch { /* handled below */ } }

  if (!body || typeof body !== 'object') {
    if (res.status === 401 || res.status === 403) {
      return problem('protected', 'The backend is behind a Vercel login wall.',
        'Vercel answered with its own sign-in page instead of the API. Open the BACKEND project → Settings → Deployment Protection → set Vercel Authentication to Disabled (or "Only Preview Deployments"), and use the project\'s production domain.');
    }
    if (res.status === 404) {
      return problem('wrong-url', 'The API was not found at this address.',
        `${url} returned 404. VITE_API_URL should be the BACKEND address ending in /api (not the frontend's own address).`);
    }
    return problem('bad-response', `The server sent an unexpected reply (HTTP ${res.status}).`,
      'It did not look like our API. Open the backend project → Logs in Vercel to see the error (a missing JWT_SECRET or DATABASE_URL is the usual cause).');
  }

  if (body.status !== 'ok' || body.db !== 'ok') {
    return problem('db', 'The server is running but cannot reach its database.',
      'Check DATABASE_URL on the backend project (use the pooled Neon string, ending ?sslmode=require), then redeploy. A paused free database wakes up on the next request.');
  }
  if (body.seeded === false) {
    return problem('empty-db', 'The database is connected but empty.',
      'Create the tables and demo data once from your computer: in the backend folder run "npx prisma migrate deploy" then "npm run db:seed" with DATABASE_URL set to your Neon DIRECT connection string.');
  }
  return { kind: 'ok' };
}
