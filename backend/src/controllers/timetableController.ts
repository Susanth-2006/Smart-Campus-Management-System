import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { asyncHandler, HttpError } from '../utils/errors';
import { prisma } from '../utils/prisma';

const include = {
  course: { select: { id: true, code: true, name: true, faculty: { select: { id: true, user: { select: { name: true } } } } } },
} as const;

export const listTimetable = asyncHandler(async (req, res) => {
  const u = req.user!;
  const { courseId, facultyId, room, day } = req.query as Record<string, string | undefined>;
  const where: Prisma.TimetableWhereInput = {
    ...(day && { dayOfWeek: Number(day) }),
    ...(room && { room }),
    course: {
      ...(courseId && { id: courseId }),
      ...(facultyId && { facultyId }),
      ...(u.role === 'STUDENT' && { enrollments: { some: { studentId: u.profileId } } }),
      ...(u.role === 'FACULTY' && { facultyId: u.profileId }),
    },
  };
  res.json(await prisma.timetable.findMany({ where, include, orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }] }));
});

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM');
const slotSchema = z
  .object({ courseId: z.string().uuid(), dayOfWeek: z.number().int().min(1).max(7), startTime: time, endTime: time, room: z.string().min(1), section: z.string().default('ALL') })
  .refine((s) => s.startTime < s.endTime, { message: 'End time must be after start time', path: ['endTime'] });

async function assertNoClash(slot: z.infer<typeof slotSchema>, ignoreId?: string) {
  const course = await prisma.course.findUnique({ where: { id: slot.courseId } });
  if (!course) throw new HttpError(404, 'Course not found');
  const clash = await prisma.timetable.findFirst({
    where: {
      id: ignoreId ? { not: ignoreId } : undefined,
      dayOfWeek: slot.dayOfWeek,
      startTime: { lt: slot.endTime },
      endTime: { gt: slot.startTime },
      OR: [{ room: slot.room }, { course: { facultyId: course.facultyId } }],
    },
    include: { course: { select: { code: true } } },
  });
  if (clash) throw new HttpError(409, `Clashes with ${clash.course.code} (${clash.startTime}-${clash.endTime}, room ${clash.room})`);
}

export const createSlot = asyncHandler(async (req, res) => {
  const slot = slotSchema.parse(req.body);
  await assertNoClash(slot);
  res.status(201).json(await prisma.timetable.create({ data: slot, include }));
});

export const updateSlot = asyncHandler(async (req, res) => {
  const existing = await prisma.timetable.findUnique({ where: { id: req.params.id } });
  if (!existing) throw new HttpError(404, 'Timetable entry not found');
  const slot = slotSchema.parse({ ...existing, ...req.body });
  await assertNoClash(slot, existing.id);
  res.json(await prisma.timetable.update({ where: { id: existing.id }, data: slot, include }));
});
