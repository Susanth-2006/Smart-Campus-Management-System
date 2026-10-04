# Deploying to Vercel

You will create **three things**: a free PostgreSQL database, the **backend** (API) and the **frontend** (website). The backend and frontend are two separate Vercel projects that come from the same GitHub repo. About 20 minutes the first time.

```
 Browser ──► Frontend (Vercel project 1, folder `frontend`)
                │  calls
                ▼
             Backend  (Vercel project 2, folder `backend`)  ──►  PostgreSQL (Neon)
```

> **Why two projects?** Vercel runs backends as short-lived *serverless functions*, not as one always-on server. The project is already prepared for that: the API lives in `backend/api/index.ts`, uploaded files are stored in the database (Vercel's disk is not persistent), and Prisma runs without a native engine.

---

## Step 0 — Put the code on GitHub
Push this repo to GitHub (`.env` files are already git-ignored, so no secrets leave your machine).

## Step 1 — Create the database (Neon, free)
1. Go to **vercel.com → Storage** (or the Marketplace) → **Neon** → create a database. Pick a region close to your users (for Hyderabad: Singapore).
2. Neon gives you two connection strings. Copy both:
   - **Pooled** (host contains `-pooler`) → used by the running website.
   - **Direct / unpooled** → used once, from your laptop, to create the tables.
3. Both end with `?sslmode=require`. Keep that part.

## Step 2 — Create the tables and demo data (from your laptop, once)
```bash
cd backend
npm install
export DATABASE_URL="<the DIRECT / unpooled connection string>"
npx prisma migrate deploy                 # creates every table
SEED_PASSWORD="choose-a-password" npm run db:seed   # loads the demo campus
```
- ⚠️ `db:seed` **erases everything** in that database first. Run it only on a fresh database.
- `SEED_PASSWORD` is the password for all demo accounts. If you leave it out it is `Password@123`, which everybody on the internet can guess. Choose your own for anything you share publicly.
- On Windows PowerShell use `$env:DATABASE_URL="..."` and `$env:SEED_PASSWORD="..."` instead of `export`.

## Step 3 — Deploy the backend
1. Vercel → **Add New… → Project** → import your GitHub repo.
2. **Root Directory:** `backend`. Framework Preset: **Other**. Leave the build settings as they are.
3. **Environment Variables:**

| Name | Value |
|---|---|
| `DATABASE_URL` | the **pooled** Neon connection string |
| `JWT_SECRET` | a long random string, e.g. run `openssl rand -base64 48` |
| `CLIENT_ORIGIN` | `https://YOUR-FRONTEND.vercel.app` (you do not know it yet; put a placeholder, fix it in Step 5) |

4. Deploy. When it finishes open `https://YOUR-BACKEND.vercel.app/api/health`. You should see `{"status":"ok","db":"ok"}`.
   - `db: unreachable` → the `DATABASE_URL` is wrong, or you pasted the string without `?sslmode=require`.
   - Vercel sets `NODE_ENV=production` for you, so the API refuses to start with a weak `JWT_SECRET` (this is on purpose).

## Step 4 — Deploy the frontend
1. **Add New… → Project** → the same repo again.
2. **Root Directory:** `frontend`. Framework Preset: **Vite** (detected automatically).
3. **Environment Variables:**

| Name | Value |
|---|---|
| `VITE_API_URL` | `https://YOUR-BACKEND.vercel.app/api` (must end with `/api`) |
| `VITE_DEMO_LOGINS` | optional: `false` hides the one-click demo-login buttons |
| `VITE_DEMO_PASSWORD` | only if you changed `SEED_PASSWORD`, so the demo buttons still work |

4. Deploy and copy the website URL.

## Step 4b — Turn OFF Vercel's login wall (do this for BOTH projects)
By default Vercel puts **Deployment Protection** in front of your deployments: visitors (and your website's own requests to the API) get Vercel's sign-in page instead of your app. If you skip this, the website loads for you but **login fails**, because the browser cannot read the API's answer.

For each project (backend **and** frontend): **Settings → Deployment Protection → Vercel Authentication → Disabled** (or "Only Preview Deployments"), then **Save**.

Also: share the project's **production domain** (for example `smart-campus-management-system.vercel.app`, shown at the top of the project page), not the long per-deployment links such as `…-9owiyhmjj.vercel.app`. Those long links are the ones that stay protected.

## Step 5 — Tell the backend where the website is
Backend project → **Settings → Environment Variables** → set `CLIENT_ORIGIN` to the frontend URL (no trailing slash), then **Deployments → ⋯ → Redeploy**. Without this the browser blocks the website's requests ("CORS error").

- Several sites? Separate them with commas: `https://a.vercel.app,https://b.com`
- Vercel *preview* URLs change on every push. Allow them with a wildcard: `https://smart-campus-*.vercel.app` (the `*` matches exactly one part of the hostname).

## Step 6 — Check it works
- [ ] Open the website, log in as the student, open **Timetable** (Saturday + lab batches should show).
- [ ] Faculty → open a course → **Materials** → upload a small PDF → open it as the student.
- [ ] Student → **New complaint** with a photo.

---

## "Login fails" — find out why in 2 minutes
The login page now checks the server by itself. If something is wrong, a **red box appears above the form** that names the problem and says what to change, and shows the API address the site is using. If everything is fine you see a small green "Server connected".

You can also test the backend directly. Open `https://YOUR-BACKEND.vercel.app/api/health` in a private/incognito window:

| You see | Meaning | Fix |
|---|---|---|
| `{"status":"ok","db":"ok","seeded":true}` | Backend is healthy | Problem is on the frontend: check `VITE_API_URL` (Step 4) and `CLIENT_ORIGIN` (Step 5) |
| A Vercel **sign-in page** | Deployment Protection is on | Step 4b |
| `{"status":"ok","db":"ok","seeded":false}` | Database is connected but empty | Run Step 2 (`migrate deploy`, then `db:seed`) |
| `{"status":"degraded","db":"unreachable"}` | Cannot reach the database | Fix `DATABASE_URL` (pooled string, ending `?sslmode=require`), redeploy |
| `404 NOT_FOUND` | Wrong project settings | Backend project's **Root Directory** must be `backend` |
| `500 FUNCTION_INVOCATION_FAILED` | The function crashed on start | Backend project → **Logs**. Usually a missing or short (< 32 characters) `JWT_SECRET`, or no `DATABASE_URL` |

Still stuck? In the browser press **F12 → Network**, click **Sign in**, click the red `login` request, and look at its **Status** and **Response**. Send me those two things.

## Things that behave differently on Vercel (good to know)
| Topic | What happens | Why |
|---|---|---|
| **Uploads** | Stored in the database. Max **3 MB** per file. | Vercel rejects request bodies above 4.5 MB and its disk is not persistent. For bigger files, move to Vercel Blob or S3. |
| **Free database size** | Neon's free plan is about 0.5 GB. | Files count towards it. Uploads are limited to 15 per 15 minutes per visitor by default (`UPLOAD_RATE_LIMIT`). |
| **Rate limits** | Counted per server instance, not globally. | Fine for a college project; for heavy traffic use a shared store such as Upstash Redis. |
| **Cold starts** | The first request after a quiet period can take 1–3 s. | Normal for serverless. |
| **Hobby plan** | Free, for non-commercial use. | A college project / portfolio is fine. |
| **Demo accounts** | Anyone who can see the login page can use the demo buttons. | Fine for a showcase. For private use: `VITE_DEMO_LOGINS=false` + your own `SEED_PASSWORD`, then create real users. |

## Troubleshooting
| Symptom | Fix |
|---|---|
| Site works for you but nobody else can open it | Deployment Protection is on (Step 4b), or you shared a per-deployment link instead of the production domain. |
| Browser console: *blocked by CORS policy* | `CLIENT_ORIGIN` on the backend does not exactly match the website URL (check `https`, no trailing slash), then redeploy the backend. |
| Login says *Cannot reach the server* or *unexpected response* | See the table above; the red box on the login page says which one. |
| Login says *Request failed* / network error | `VITE_API_URL` is wrong or missing `/api`. Environment variables are read at **build** time, so redeploy the frontend after changing it. |
| `/api/health` shows `db: unreachable` | Wrong `DATABASE_URL`, or the database is paused (Neon free databases sleep; the first request wakes them). |
| Refreshing a page like `/timetable` gives 404 | Frontend Root Directory is not `frontend`, so `frontend/vercel.json` is not used. |
| Build fails on `prisma generate` | Make sure Root Directory is `backend`. The `postinstall` script generates the client. |
| *This link is invalid or has expired* when opening a file | Signed file links last 1 hour. Reload the page. |
| Deploy works but every request is 500 | Open the project → **Logs**. A missing `JWT_SECRET` or `DATABASE_URL` is the usual cause. |

## Updating later
- Push to GitHub → both projects redeploy automatically.
- **Changed `schema.prisma`?** Create the migration locally (`npx prisma migrate dev`), commit it, then apply it to the live database from your laptop with the direct URL: `npx prisma migrate deploy`.
