import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { asyncHandler, HttpError } from '../utils/errors';
import { prisma } from '../utils/prisma';
import { notifyUsers } from '../utils/notify';
import { STORED_NAME } from '../utils/files';
import { UPLOAD_DIR } from './uploadController';

type User = NonNullable<Express.Request['user']>;

async function assertCanView(u: User, courseId: string) {
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) throw new HttpError(404, 'Course not found');
  if (u.role === 'FACULTY' && course.facultyId !== u.profileId) throw new HttpError(403, 'This is not your course');
  if (u.role === 'STUDENT') {
    const e = await prisma.enrollment.findUnique({ where: { studentId_courseId: { studentId: u.profileId, courseId } } });
    if (!e) throw new HttpError(403, 'You are not enrolled in this course');
  }
  if (u.role === 'STAFF') throw new HttpError(403, 'You do not have access to this resource');
  return course;
}

export const listMaterials = asyncHandler(async (req, res) => {
  await assertCanView(req.user!, req.params.id);
  res.json(await prisma.material.findMany({
    where: { courseId: req.params.id },
    include: { uploadedBy: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
  }));
});

const createSchema = z.object({
  title: z.string().trim().min(3, 'Give the material a title').max(120),
  storedName: z.string().regex(STORED_NAME, 'Invalid file'),
  fileName: z.string().trim().min(1).max(200),
  mimeType: z.string().max(150),
  size: z.number().int().positive(),
});

export const createMaterial = asyncHandler(async (req, res) => {
  const u = req.user!;
  if (u.role !== 'FACULTY' && u.role !== 'ADMIN') throw new HttpError(403, 'Only faculty can upload materials');
  const course = await assertCanView(u, req.params.id);
  const body = createSchema.parse(req.body);
  if (!fs.existsSync(path.join(UPLOAD_DIR, body.storedName))) throw new HttpError(400, 'Upload the file first');

  const material = await prisma.material.create({ data: { ...body, courseId: course.id, uploadedById: u.id }, include: { uploadedBy: { select: { name: true } } } });
  const enrolled = await prisma.enrollment.findMany({ where: { courseId: course.id }, select: { student: { select: { userId: true } } } });
  await notifyUsers(enrolled.map((e) => e.student.userId), { type: 'MATERIAL', title: 'New course material', message: `New material in ${course.name}: ${body.title}`, link: `/academics/courses/${course.id}` });
  res.status(201).json(material);
});

export const deleteMaterial = asyncHandler(async (req, res) => {
  const u = req.user!;
  const m = await prisma.material.findUnique({ where: { id: req.params.id }, include: { course: true } });
  if (!m) throw new HttpError(404, 'Material not found');
  if (u.role === 'FACULTY' ? m.course.facultyId !== u.profileId : u.role !== 'ADMIN') throw new HttpError(403, 'You cannot remove this material');
  await prisma.material.delete({ where: { id: m.id } });
  fs.promises.unlink(path.join(UPLOAD_DIR, m.storedName)).catch(() => {});
  res.status(204).end();
});
