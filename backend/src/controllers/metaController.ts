import { asyncHandler } from '../utils/errors';
import { Role } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { oneOf, textParam } from '../utils/query';

export const listDepartments = asyncHandler(async (_req, res) => {
  res.json(await prisma.department.findMany({ orderBy: { name: 'asc' } }));
});

export const listFaculty = asyncHandler(async (_req, res) => {
  res.json(await prisma.faculty.findMany({
    include: { user: { select: { name: true, email: true } }, department: { select: { code: true, name: true } }, _count: { select: { courses: true } } },
    orderBy: { user: { name: 'asc' } },
  }));
});

export const listStaff = asyncHandler(async (_req, res) => {
  res.json(await prisma.campusStaff.findMany({ include: { user: { select: { name: true, email: true } } }, orderBy: { user: { name: 'asc' } } }));
});

export const stats = asyncHandler(async (_req, res) => {
  const since = new Date(); since.setUTCDate(since.getUTCDate() - 56);
  const [students, faculty, courses, pendingComplaints, depts, byCategory, byStatus, att] = await Promise.all([
    prisma.student.count(), prisma.faculty.count(), prisma.course.count(),
    prisma.complaint.count({ where: { status: { notIn: ['RESOLVED', 'CLOSED'] } } }),
    prisma.department.findMany({ select: { code: true, name: true, _count: { select: { students: true, courses: true } } } }),
    prisma.complaint.groupBy({ by: ['category'], _count: { _all: true } }),
    prisma.complaint.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.attendance.findMany({ where: { date: { gte: since } }, select: { date: true, status: true } }),
  ]);
  const weeks = new Map<string, { a: number; t: number }>();
  for (const r of att) {
    const d = new Date(r.date); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    const k = d.toISOString().slice(0, 10), w = weeks.get(k) ?? { a: 0, t: 0 };
    w.t++; if (r.status !== 'ABSENT') w.a++; weeks.set(k, w);
  }
  res.json({
    totals: { students, faculty, courses, pendingComplaints },
    studentsByDepartment: depts.map((d) => ({ code: d.code, name: d.name, students: d._count.students, courses: d._count.courses })),
    attendanceTrend: [...weeks.entries()].sort().map(([week, w]) => ({ week, percentage: Math.round((w.a / w.t) * 1000) / 10 })),
    complaintsByCategory: byCategory.map((c) => ({ category: c.category, count: c._count._all })),
    complaintsByStatus: byStatus.map((c) => ({ status: c.status, count: c._count._all })),
  });
});

export const search = asyncHandler(async (req, res) => {
  const u = req.user!;
  const q = textParam(req.query.q) ?? '';
  if (q.length < 2) return res.json([]);
  const ci = { contains: q, mode: 'insensitive' as const };
  const staffOrAdmin = u.role === 'ADMIN' || u.role === 'FACULTY';
  const [courses, faculty, announcements, complaints, students] = await Promise.all([
    prisma.course.findMany({ where: { OR: [{ name: ci }, { code: ci }] }, include: { faculty: { include: { user: { select: { name: true } } } } }, take: 5 }),
    prisma.faculty.findMany({ where: { user: { name: ci } }, include: { user: { select: { name: true } }, department: true }, take: 4 }),
    prisma.announcement.findMany({ where: { title: ci, ...(u.role !== 'ADMIN' && { audience: { has: u.role } }) }, take: 4 }),
    u.role === 'FACULTY' ? Promise.resolve([] as any[]) : (prisma.complaint.findMany({
      where: { title: ci, ...(u.role === 'STUDENT' && { studentId: u.profileId }), ...(u.role === 'STAFF' && { task: { staffId: u.profileId } }) }, take: 4,
    }) as Promise<any[]>),
    staffOrAdmin ? (prisma.student.findMany({ where: { OR: [{ rollNo: ci }, { user: { name: ci } }], ...(u.role === 'FACULTY' && { enrollments: { some: { course: { facultyId: u.profileId } } } }) }, include: { user: { select: { name: true } } }, take: 4 }) as Promise<any[]>) : Promise.resolve([] as any[]),
  ]);
  const base = u.role === 'FACULTY' ? '/teaching/courses' : u.role === 'ADMIN' ? '/management/courses' : '/academics/courses';
  res.json([
    ...courses.map((c) => ({ type: 'Course', label: `${c.code} · ${c.name}`, sub: c.faculty.user.name, to: `${base}/${c.id}` })),
    ...faculty.map((f) => ({ type: 'Faculty', label: f.user.name, sub: f.department.name, to: u.role === 'ADMIN' ? '/management/faculty' : '/academics/faculty' })),
    ...announcements.map((a) => ({ type: 'Announcement', label: a.title, sub: a.category.toLowerCase(), to: `/campus/announcements/${a.id}` })),
    ...complaints.map((c) => ({ type: 'Complaint', label: `#${c.ticketNo} ${c.title}`, sub: c.status.replace('_', ' ').toLowerCase(), to: `/campus/complaints/${c.id}` })),
    ...students.map((s) => ({ type: 'Student', label: s.user.name, sub: s.rollNo, to: u.role === 'ADMIN' ? '/management/students' : '/students' })),
  ]);
});

export const listUsers = asyncHandler(async (req, res) => {
  const q = textParam(req.query.q) ?? '';
  const role = oneOf(req.query.role, Object.values(Role), 'role');
  res.json(await prisma.user.findMany({
    where: { ...(role && { role }), ...(q && { OR: [{ name: { contains: q, mode: 'insensitive' } }, { email: { contains: q, mode: 'insensitive' } }] }) },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
    orderBy: { name: 'asc' }, take: 200,
  }));
});
