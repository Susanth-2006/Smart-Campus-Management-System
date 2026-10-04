import { Prisma } from '@prisma/client';
import { asyncHandler, HttpError } from '../utils/errors';
import { prisma } from '../utils/prisma';
import { intParam, textParam } from '../utils/query';

const include = { user: { select: { name: true, email: true, phone: true } }, department: true } as const;

export const listStudents = asyncHandler(async (req, res) => {
  const u = req.user!;
  const { departmentId, section, courseId } = req.query as Record<string, string | undefined>;
  const q = textParam(req.query.q);
  const page = intParam(req.query.page, 'page', { min: 1, max: 100_000, fallback: 1 })!;
  const limit = intParam(req.query.limit, 'limit', { min: 1, max: 100, fallback: 50 })!;

  const where: Prisma.StudentWhereInput = {
    ...(departmentId && { departmentId }),
    ...(section && { section }),
    ...(q && { OR: [{ rollNo: { contains: q, mode: 'insensitive' } }, { user: { name: { contains: q, mode: 'insensitive' } } }] }),
    ...(courseId && { enrollments: { some: { courseId } } }),
    // Faculty only see students enrolled in their own courses
    ...(u.role === 'FACULTY' && { enrollments: { some: { course: { facultyId: u.profileId }, ...(courseId && { courseId }) } } }),
  };

  const [items, total] = await Promise.all([
    prisma.student.findMany({ where, include, orderBy: { rollNo: 'asc' }, skip: (page - 1) * limit, take: limit }),
    prisma.student.count({ where }),
  ]);
  res.json({ items, total, page, limit });
});

export const getStudent = asyncHandler(async (req, res) => {
  const u = req.user!;
  if (u.role === 'STUDENT' && u.profileId !== req.params.id) throw new HttpError(403, 'You can only view your own record');
  // Faculty can open only the students who are enrolled in one of their courses (same rule as the students list)
  if (u.role === 'FACULTY') {
    const teaches = await prisma.enrollment.findFirst({ where: { studentId: req.params.id, course: { facultyId: u.profileId } }, select: { id: true } });
    if (!teaches) throw new HttpError(403, 'This student is not enrolled in any of your courses');
  }
  const student = await prisma.student.findUnique({
    where: { id: req.params.id },
    include: { ...include, enrollments: { include: { course: { include: { faculty: { include: { user: { select: { name: true } } } } } } } } },
  });
  if (!student) throw new HttpError(404, 'Student not found');
  res.json(student);
});
