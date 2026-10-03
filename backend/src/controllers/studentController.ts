import { Prisma } from '@prisma/client';
import { asyncHandler, HttpError } from '../utils/errors';
import { prisma } from '../utils/prisma';

const include = { user: { select: { name: true, email: true, phone: true } }, department: true } as const;

export const listStudents = asyncHandler(async (req, res) => {
  const u = req.user!;
  const { q, departmentId, section, courseId } = req.query as Record<string, string | undefined>;
  const page = Math.max(1, Number(req.query.page ?? 1));
  const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 50)));

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
  const student = await prisma.student.findUnique({
    where: { id: req.params.id },
    include: { ...include, enrollments: { include: { course: { include: { faculty: { include: { user: { select: { name: true } } } } } } } } },
  });
  if (!student) throw new HttpError(404, 'Student not found');
  res.json(student);
});
