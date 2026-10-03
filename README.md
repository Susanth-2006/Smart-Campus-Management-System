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
npx prisma migrate dev --name init
npm run db:seed
npm run dev                     # http://localhost:4000

# 3. Frontend (new terminal)
cd frontend
cp .env.example .env
npm install
npm run dev                     # http://localhost:5173
```

## Already running an earlier version? Read this first
This version adds new database tables (facilities, library, transport, calendar, materials). From `backend`:
```bash
npx prisma migrate dev --name pending_features
npm run db:seed        # wipes and re-creates the demo data, including the new tables
npm run dev
```
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

## Tests and verification
```bash
npm install          # at repo root (installs tsx)
npm test             # 17 logic tests: grading, GPA, nav vs routes, seed timetable, seed volumes, upload safety
npm run typecheck    # real tsc builds of backend and frontend (needs both installed)
```
What was verified before delivery (in a sandbox with no package registry access):
1. All 84 source files parse with 0 syntax errors.
2. Backend and frontend type-check with 0 errors against stubbed third-party types.
3. 17 logic tests pass (grading, GPA, role navigation vs routes, seed timetable clash-freedom, seed volumes, upload signature / filename / URL safety).
4. Render smoke test: 87 server-side renders pass (every page for every role it is meant for, plus navbar, breadcrumbs, menus and
   command palette), using the real component code with stubbed router/animation/chart/query libraries and mock API data.
5. Review fixes applied along the way: Map-from-tuple typing, `npm start` path, Vite type reference, recharts formatter typing,
   union-array typing in search, local-date handling for attendance (IST), lazy-loaded dashboards, CORS default for 127.0.0.1,
   non-link group breadcrumbs, staff notification link, role-gated requests on the course page.

**Not verified (could not be, without registry access):** installing the real dependencies, running Prisma migrations and the seed against
Postgres, starting the servers, real HTTP/auth round-trips, and interactive behaviour in a browser (effects, clicks, charts, animations).
Run the steps above; if anything fails, the error message is all that is needed to fix it.

## Known gaps (honest list)
(Facilities, Campus Map, Library, Transport, Academic Calendar, complaint photos and course materials are now built.)
- Never executed end-to-end by the author (see Tests and verification above).

- Facilities are read-only (seeded data; there is no admin editor). Library has no fines or reservations. Transport has no live bus tracking.
- Uploaded files live on the server's local disk (`backend/uploads`), not cloud storage; back them up if you deploy.
- Student "Performance over time" is not shown: marks have no time dimension; subject comparison is.
- Timetable week navigation changes the date range only (the schedule repeats weekly). The admin timetable view is read-only.
- Tests cover pure logic only; there are no API integration or UI tests yet.
