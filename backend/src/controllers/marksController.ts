import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { asyncHandler, HttpError } from '../utils/errors';
import { prisma } from '../utils/prisma';
import { computeGrade, computeTotal, MAX_MARKS } from '../utils/grading';
import { notifyUsers } from '../utils/notify';

const include = {
  course: { select: { code: true, name: true, credits: true } },
  student: { select: { rollNo: true, user: { select: { name: true } } } },
} as const;

export const listMarks = asyncHandler(async (req, res) => {
  const u = req.user!;
  const { courseId, studentId } = req.query as Record<string, string | undefined>;
  const where: Prisma.MarksWhereInput = {
    ...(courseId && { courseId }),
    ...(u.role === 'STUDENT' ? { studentId: u.profileId, published: true } : studentId ? { studentId } : {}),
    ...(u.role === 'FACULTY' && { course: { facultyId: u.profileId } }),
  };
  res.json(await prisma.marks.findMany({ where, include, orderBy: { student: { rollNo: 'asc' } } }));
});

const num = (max: number) => z.number().min(0).max(max).nullable().optional();
const marksSchema = z.object({
  studentId: z.string().uuid(),
  courseId: z.string().uuid(),
  internal: num(MAX_MARKS.internal),
  assignment: num(MAX_MARKS.assignment),
  midExam: num(MAX_MARKS.midExam),
  finalExam: num(MAX_MARKS.finalExam),
  published: z.boolean().optional(),
});

async function assertOwnsCourse(user: NonNullable<Express.Request['user']>, courseId: string) {
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) throw new HttpError(404, 'Course not found');
  if (user.role === 'FACULTY' && course.facultyId !== user.profileId) throw new HttpError(403, 'This is not your course');
  return course;
}

async function save(req: any, res: any, forceId?: string) {
  const body = marksSchema.parse(req.body);
  const course = await assertOwnsCourse(req.user, body.courseId);
  const enrolled = await prisma.enrollment.findUnique({
    where: { studentId_courseId: { studentId: body.studentId, courseId: body.courseId } },
    include: { student: true },
  });
  if (!enrolled) throw new HttpError(400, 'Student is not enrolled in this course');

  const before = forceId ? await prisma.marks.findUnique({ where: { id: forceId } }) : await prisma.marks.findUnique({ where: { studentId_courseId: { studentId: body.studentId, courseId: body.courseId } } });
  const data = {
    internal: body.internal ?? null, assignment: body.assignment ?? null, midExam: body.midExam ?? null, finalExam: body.finalExam ?? null,
  };
  const total = computeTotal(data);
  const payload = { ...data, total, grade: computeGrade(total), published: body.published ?? before?.published ?? false };

  const saved = await prisma.marks.upsert({
    where: { studentId_courseId: { studentId: body.studentId, courseId: body.courseId } },
    update: payload,
    create: { studentId: body.studentId, courseId: body.courseId, ...payload },
    include,
  });

  if (saved.published && !before?.published) {
    await notifyUsers([enrolled.student.userId], { type: 'MARKS', title: 'Marks published', message: `Marks for ${course.name} have been published.`, link: '/academics/marks' });
  }
  res.status(before ? 200 : 201).json(saved);
}

export const createMarks = asyncHandler((req, res) => save(req, res));
export const updateMarks = asyncHandler(async (req, res) => {
  const existing = await prisma.marks.findUnique({ where: { id: req.params.id } });
  if (!existing) throw new HttpError(404, 'Marks record not found');
  req.body = { studentId: existing.studentId, courseId: existing.courseId, internal: existing.internal, assignment: existing.assignment, midExam: existing.midExam, finalExam: existing.finalExam, published: existing.published, ...req.body };
  return save(req, res, existing.id);
});
