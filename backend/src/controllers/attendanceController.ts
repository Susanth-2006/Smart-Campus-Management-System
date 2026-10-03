import { AttendanceStatus, Prisma } from '@prisma/client';
import { z } from 'zod';
import { asyncHandler, HttpError } from '../utils/errors';
import { prisma } from '../utils/prisma';
import { parseDay } from '../utils/date';
import { notifyUsers } from '../utils/notify';

async function assertCourseAccess(user: NonNullable<Express.Request['user']>, courseId: string) {
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) throw new HttpError(404, 'Course not found');
  if (user.role === 'FACULTY' && course.facultyId !== user.profileId) throw new HttpError(403, 'This is not your course');
  return course;
}

export const listAttendance = asyncHandler(async (req, res) => {
  const u = req.user!;
  const { courseId, studentId, from, to, date } = req.query as Record<string, string | undefined>;
  const where: Prisma.AttendanceWhereInput = {
    ...(courseId && { courseId }),
    ...(date && { date: parseDay(date) }),
    ...((from || to) && { date: { ...(from && { gte: parseDay(from) }), ...(to && { lte: parseDay(to) }) } }),
    ...(u.role === 'STUDENT' ? { studentId: u.profileId } : studentId ? { studentId } : {}),
    ...(u.role === 'FACULTY' && { course: { facultyId: u.profileId } }),
  };
  const items = await prisma.attendance.findMany({
    where,
    include: { course: { select: { code: true, name: true } }, student: { select: { rollNo: true, user: { select: { name: true } } } } },
    orderBy: [{ date: 'desc' }, { student: { rollNo: 'asc' } }],
    take: 2000,
  });
  res.json(items);
});

export const attendanceSummary = asyncHandler(async (req, res) => {
  const u = req.user!;
  const studentId = u.role === 'STUDENT' ? u.profileId : (req.query.studentId as string | undefined);
  if (!studentId) throw new HttpError(400, 'studentId is required');
  const rows = await prisma.attendance.findMany({
    where: { studentId, ...(u.role === 'FACULTY' && { course: { facultyId: u.profileId } }) },
    include: { course: { select: { id: true, code: true, name: true } } },
  });
  const map = new Map<string, { courseId: string; code: string; name: string; total: number; present: number; late: number; absent: number }>();
  for (const r of rows) {
    const e = map.get(r.courseId) ?? { courseId: r.courseId, code: r.course.code, name: r.course.name, total: 0, present: 0, late: 0, absent: 0 };
    e.total++;
    if (r.status === 'PRESENT') e.present++;
    else if (r.status === 'LATE') e.late++;
    else e.absent++;
    map.set(r.courseId, e);
  }
  const courses = [...map.values()].map((c) => ({ ...c, percentage: c.total ? Math.round(((c.present + c.late) / c.total) * 1000) / 10 : 0 }));
  const total = courses.reduce((a, c) => a + c.total, 0);
  const attended = courses.reduce((a, c) => a + c.present + c.late, 0);
  res.json({ overall: total ? Math.round((attended / total) * 1000) / 10 : 0, totalClasses: total, courses });
});

const markSchema = z.object({
  courseId: z.string().uuid(),
  date: z.string(),
  records: z.array(z.object({ studentId: z.string().uuid(), status: z.nativeEnum(AttendanceStatus) })).min(1),
});

export const markAttendance = asyncHandler(async (req, res) => {
  const body = markSchema.parse(req.body);
  const course = await assertCourseAccess(req.user!, body.courseId);
  const date = parseDay(body.date);

  const enrolled = await prisma.enrollment.findMany({ where: { courseId: course.id }, select: { studentId: true, student: { select: { userId: true } } } });
  const enrolledIds = new Set(enrolled.map((e) => e.studentId));
  const bad = body.records.find((r) => !enrolledIds.has(r.studentId));
  if (bad) throw new HttpError(400, 'One or more students are not enrolled in this course');

  await prisma.$transaction(
    body.records.map((r) =>
      prisma.attendance.upsert({
        where: { studentId_courseId_date: { studentId: r.studentId, courseId: course.id, date } },
        update: { status: r.status },
        create: { studentId: r.studentId, courseId: course.id, date, status: r.status },
      }),
    ),
  );

  const userIds = enrolled.filter((e) => body.records.some((r) => r.studentId === e.studentId)).map((e) => e.student.userId);
  await notifyUsers(userIds, { type: 'ATTENDANCE', title: 'Attendance updated', message: `Your attendance for ${course.name} was updated.`, link: '/academics/attendance' });

  res.status(201).json({ message: 'Attendance saved successfully.', saved: body.records.length });
});

export const updateAttendance = asyncHandler(async (req, res) => {
  const { status } = z.object({ status: z.nativeEnum(AttendanceStatus) }).parse(req.body);
  const existing = await prisma.attendance.findUnique({ where: { id: req.params.id }, include: { student: true, course: true } });
  if (!existing) throw new HttpError(404, 'Attendance record not found');
  await assertCourseAccess(req.user!, existing.courseId);
  const updated = await prisma.attendance.update({ where: { id: existing.id }, data: { status } });
  await notifyUsers([existing.student.userId], { type: 'ATTENDANCE', title: 'Attendance updated', message: `Your attendance for ${existing.course.name} was updated.`, link: '/academics/attendance' });
  res.json(updated);
});
