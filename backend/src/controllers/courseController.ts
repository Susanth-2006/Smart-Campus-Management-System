import { Prisma } from '../generated/prisma/client';
import { z } from 'zod';
import { asyncHandler, HttpError } from '../utils/errors';
import { prisma } from '../utils/prisma';
import { intParam, textParam } from '../utils/query';

const include = {
  department: { select: { id: true, code: true, name: true } },
  faculty: { select: { id: true, designation: true, user: { select: { name: true, email: true } } } },
  _count: { select: { enrollments: true } },
} as const;

export const listCourses = asyncHandler(async (req, res) => {
  const u = req.user!;
  const { departmentId, mine } = req.query as Record<string, string | undefined>;
  const q = textParam(req.query.q);
  const semester = intParam(req.query.semester, 'semester', { min: 1, max: 12 });
  const where: Prisma.CourseWhereInput = {
    ...(semester !== undefined && { semester }),
    ...(departmentId && { departmentId }),
    ...(q && { OR: [{ code: { contains: q, mode: 'insensitive' } }, { name: { contains: q, mode: 'insensitive' } }] }),
    ...(mine === 'true' && u.role === 'STUDENT' && { enrollments: { some: { studentId: u.profileId } } }),
    ...(mine === 'true' && u.role === 'FACULTY' && { facultyId: u.profileId }),
  };
  res.json(await prisma.course.findMany({ where, include, orderBy: { code: 'asc' } }));
});

export const getCourse = asyncHandler(async (req, res) => {
  const course = await prisma.course.findUnique({ where: { id: req.params.id }, include: { ...include, timetable: { orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }] } } });
  if (!course) throw new HttpError(404, 'Course not found');
  res.json(course);
});

const courseSchema = z.object({
  code: z.string().min(3).max(12).transform((s) => s.toUpperCase()),
  name: z.string().min(3).max(100),
  description: z.string().max(1000).optional(),
  credits: z.number().int().min(1).max(8),
  semester: z.number().int().min(1).max(8),
  room: z.string().min(1).max(20),
  departmentId: z.string().uuid(),
  facultyId: z.string().uuid(),
});

export const createCourse = asyncHandler(async (req, res) => {
  const course = await prisma.course.create({ data: courseSchema.parse(req.body), include });
  res.status(201).json(course);
});

export const updateCourse = asyncHandler(async (req, res) => {
  const course = await prisma.course.update({ where: { id: req.params.id }, data: courseSchema.partial().parse(req.body), include });
  res.json(course);
});

export const deleteCourse = asyncHandler(async (req, res) => {
  await prisma.course.delete({ where: { id: req.params.id } });
  res.status(204).end();
});
