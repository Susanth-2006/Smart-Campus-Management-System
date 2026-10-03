# Smart Campus: Backend

Express + TypeScript + Prisma + PostgreSQL, JWT auth, role-based access.

## Setup
```bash
cd backend
cp .env.example .env        # edit DATABASE_URL and JWT_SECRET
npm install
npx prisma migrate dev --name init
npm run db:seed
npm run dev                 # http://localhost:4000/api/health
```

## Demo logins (password: `Password@123`)
| Role | Email |
|---|---|
| Student (Susanth) | student@smartcampus.com |
| Faculty (Dr. Priya Rao) | faculty@smartcampus.com |
| Admin | admin@smartcampus.com |
| Campus Staff | staff@smartcampus.com |

Login: `POST /api/auth/login` `{ "email", "password", "role"? }` returns `{ token, user }`.
Send `Authorization: Bearer <token>` on every other call.

## Endpoints
| Area | Endpoints (role) |
|---|---|
| Auth | `POST /auth/login`, `POST /auth/logout`, `GET /auth/me` |
| Students | `GET /students` (admin, faculty: own students), `GET /students/:id` |
| Attendance | `GET /attendance`, `GET /attendance/summary`, `POST /attendance` (bulk mark: faculty/admin), `PUT /attendance/:id` |
| Marks | `GET /marks`, `POST /marks` (upsert, auto total + grade), `PUT /marks/:id` |
| Courses | `GET /courses`, `GET /courses/:id`, `POST/PUT/DELETE` (admin) |
| Timetable | `GET /timetable`, `POST`, `PUT /:id` (admin, clash detection) |
| Complaints | `GET /complaints`, `GET /complaints/:id` (timeline), `POST` (student), `PATCH /:id/status` |
| Announcements | `GET` (filters: category, q, unread), `POST`, `PUT /:id` (admin), `PATCH /:id/read` |
| Notifications | `GET`, `PATCH /:id/read`, `PATCH /read-all` |

## Behaviour worth knowing
- **Attendance save** upserts per student/course/date and notifies each student; summary endpoint feeds dashboards (LATE counts as attended).
- **Marks** out of 100: internal 20, assignment 10, mid 20, final 50. Out-of-range values return 400. Students only see `published` marks; publishing notifies them.
- **Complaints** move forward only: SUBMITTED → UNDER_REVIEW → ASSIGNED → IN_PROGRESS → RESOLVED → CLOSED. Admin assigns with `{status:"ASSIGNED", staffId}` (creates the MaintenanceTask). Staff can only set IN_PROGRESS/RESOLVED on their own tasks. Students can close a resolved complaint. Re-sending the same status with a `note` adds a note to the timeline. Every change notifies the student.
- **Announcements** are filtered by audience role; publishing notifies everyone in the audience.
- Faculty are restricted to their own courses (attendance, marks, students, timetable).
