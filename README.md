# Smart Campus Management System

React + TypeScript + Vite + Tailwind + Framer Motion + Recharts + TanStack Query (frontend)
Node + Express + TypeScript + Prisma + PostgreSQL + JWT/bcrypt (backend). No sidebar anywhere: sticky top navigation, dropdowns, breadcrumbs, command palette (Ctrl+K), mobile full-screen menu.

## Run it
```bash
# 1. Database (or point DATABASE_URL at any Postgres)
docker compose -f database/docker-compose.yml up -d

# 2. Backend
cd backend
cp .env.example .env            # set JWT_SECRET
npm install
npx prisma migrate dev            # applies the migrations in backend/prisma/migrations
npm run db:seed
npm run dev                     # http://localhost:4000

# 3. Frontend (new terminal)
cd frontend
cp .env.example .env
npm install
npm run dev                     # http://localhost:5173
```

## Already running an earlier version? Read this first
This version adds a `batch` column on students (lab batches B-1 / B-2) and replaces the demo CSE data with the real timetable. From `backend`:
```bash
npx prisma migrate deploy   # applies the new `student_batch` migration (use `migrate dev` while developing)
npm run db:seed             # wipes and re-creates the demo data
npm run dev
```
Set `NODE_ENV=production` and a strong `JWT_SECRET` (32+ random characters) when you deploy; the API refuses to start otherwise.
Uploaded photos and course materials are stored in `backend/uploads/` (created automatically, git-ignored).

## Demo accounts (password `Password@123`)
student@smartcampus.com · faculty@smartcampus.com · admin@smartcampus.com · staff@smartcampus.com
(the login page also has one-click demo buttons)

## What each role can do
- **Student**: dashboard, today's schedule, attendance (ring, subject cards, trend, history, filters), weekly/day timetable with filters, courses + detail tabs, marks with component breakdown, submit and track complaints (timeline, with an optional photo), announcements (read/unread, search, filters), notifications, search.
- **Faculty**: upload and remove course materials (students are notified), teaching dashboard, mark attendance (course/section/date, mark all present, saves and notifies students), marks entry with live total/grade and validation, publish results, students list, courses.
- **Everyone**: Facilities directory, Campus Map (pins, category filter, details), Library (search, borrow up to 3 books for 14 days, return, due/overdue tracking), Transport (routes, stops, pickup times, pick "my route" with next-bus time), Academic Calendar (month grid, upcoming list), change password (Settings), Events view (announcements filtered to events), Help Desk / Maintenance / Student Services pages that link to the real complaint and announcement features.
- **Admin**: add/remove calendar events, add books, view all library loans, users directory, analytics dashboard (clickable charts), course CRUD, publish announcements by audience, assign and update complaints, students and faculty directories.
- **Campus staff**: task queue, accept / add note / mark resolved.

## New endpoints in this version
`POST /uploads` (images for complaints, documents for faculty) · `GET/POST /courses/:id/materials`, `DELETE /materials/:id` · `GET /facilities` ·
`GET /library/books`, `/library/categories`, `/library/loans`, `POST /library/books` (admin), `/library/books/:id/borrow`, `/library/loans/:id/return` ·
`GET /transport/routes`, `GET/PUT/DELETE /transport/my-route` · `GET /calendar`, `POST/PUT/DELETE /calendar` (admin).
Uploads are validated by size, an allow-list of types, and the file's real signature; stored under random names; complaints only accept paths of our own uploads.

## Deploying
Step-by-step guide for Vercel (frontend + backend + free PostgreSQL): see **[DEPLOY.md](DEPLOY.md)**. The project is already prepared for it: serverless entry point (`backend/api/index.ts`), files stored in the database when running on Vercel (`STORAGE=db`), a Prisma client that needs no native engine, SPA routing, CORS allow-list and proxy handling.

## Real class data: CSE · III B.Tech I-Sem · Section H
The demo student (and the 8 other CSE students) belong to **Section H, Room 225**, and CSE uses the department's real timetable (A.Y. 2026-27, version 02, W.E.F. 06-07-2026): the 10 subjects with their faculty, the Saturday classes, the parallel lab batches (B-1 / B-2), the Training blocks and lunch. The data lives in one file, `backend/prisma/hSection.ts`, which the seed and the tests share. Students see their own batch by default, with a "Whole section" toggle that shows the sheet exactly as printed.
Things the sheet does not say, so the seed assumes them (change them in `hSection.ts` / `seed.ts`): credits = periods per week (Training and Introduction to Cyber Security carry none), lab rooms are named after the lab, Training takes place in Room 225, and the second Professional Communication Skills Lab faculty is cut off on the sheet ("Dr Mudasir A…") so only Dr P Narasimha Raju is recorded.

## Tests and verification
```bash
npm install                    # at repo root (installs tsx)
npm test                       # 43 offline tests: grading/GPA, nav vs routes, seed invariants, upload safety, date/query/error/signed-link helpers,
                               #   the real timetable data, timetable grid layout, calendar export, and a real render of the Timetable page
npm run typecheck              # real tsc builds of backend and frontend
# API integration tests (138) need a running API + seeded database:
cd backend && npm run db:seed && npm run dev      # terminal 1
npm run test:api                                  # terminal 2 (repo root)
```
`.github/workflows/ci.yml` runs all of this on every push (the API tests twice: files on disk and files in the database), against a real PostgreSQL, and also checks that the migrations match `schema.prisma`.

The API tests cover login and token handling, a role-by-endpoint permission matrix, data isolation between students, attendance, marks (publish / notify once), the full complaint lifecycle (assign, reassign, resolve, close), private file links, library loans including a concurrent-borrow race, calendar, transport, announcements, notifications, uploads, malformed input (no 500s) and the real timetable. Everything was run for real against PostgreSQL 16 (see the sandbox note in the changelog below).

## Known gaps (honest list)
- The browser UI has been rendered on the server and type-checked, but not clicked through in a real browser by the author: do a quick visual pass on the Timetable page (week + day view, print preview, "Add to calendar").
- Facilities are read-only (seeded data; there is no admin editor). Library has no fines or reservations. Transport has no live bus tracking.
- Uploaded files live on the server's disk locally (`backend/uploads`) and in the PostgreSQL database on Vercel (max 3 MB each there). Neither is cloud object storage; for large files switch to Vercel Blob or S3. Files that are uploaded but never attached to a complaint or course are not cleaned up yet. Downloads use 1-hour signed links.
- Student "Performance over time" is not shown: marks have no time dimension; subject comparison is.
- Timetable week navigation changes the date range only (the schedule repeats weekly). The admin timetable view is read-only. Students are assigned to a lab batch in the seed; there is no admin screen for it yet.
- Tokens are stateless JWTs: changing a password does not sign out other devices.
- `npm audit` still lists a build-time advisory in the Prisma CLI's config loader (not used at runtime) and react-router 6 (fixed only in v7, a breaking upgrade).

## Changelog (this round)
**Fixed:** malformed or oversized request bodies returned 500; bad query values (`?status=BOGUS`, `?page=abc`, repeated keys) returned 500; impossible dates such as `2026-02-30` were accepted; attendance could be marked for future dates; faculty could open any student's record; `PUT /marks/:id` could overwrite a different student's marks; admins could not reassign a complaint once work started; uploaded files (course notes, complaint photos) were readable by anyone with the link; the timetable's faculty filter never updated; critical/high advisories via `bcrypt` (now v6).
**Hardened:** JWT algorithm pinned, weak `JWT_SECRET` rejected in production, constant-time login for unknown emails, configurable rate limits, `/api/health` checks the database, graceful shutdown.
**Deployment:** Vercel-ready (serverless entry point, database file storage, engine-free Prisma client generated into `src/generated`, CORS allow-list with wildcards, proxy-aware rate limits, configurable demo logins/password) with a step-by-step `DEPLOY.md`, verified with Vercel's own CLI build.
**Added:** the real Section H timetable and faculty, lab batches, Saturday + parallel-session support in the timetable, "Now" highlight, print view, calendar (.ics) export, a Humanities & Sciences department, 43 offline tests, 138 API tests, CI.
