import { AnnouncementCategory, Prisma, Priority, Role } from '@prisma/client';
import { z } from 'zod';
import { asyncHandler, HttpError } from '../utils/errors';
import { prisma } from '../utils/prisma';
import { notifyUsers } from '../utils/notify';

const withRead = (userId: string) => ({ author: { select: { user: { select: { name: true } } } }, reads: { where: { userId }, select: { id: true } } }) as const;
const shape = <T extends { reads: unknown[] }>(a: T) => {
  const { reads, ...rest } = a;
  return { ...rest, read: reads.length > 0 };
};

export const listAnnouncements = asyncHandler(async (req, res) => {
  const u = req.user!;
  const { category, q, unread } = req.query as Record<string, string | undefined>;
  const where: Prisma.AnnouncementWhereInput = {
    ...(u.role !== 'ADMIN' && { audience: { has: u.role } }),
    ...(category && category !== 'ALL' && { category: category as AnnouncementCategory }),
    ...(q && { OR: [{ title: { contains: q, mode: 'insensitive' } }, { body: { contains: q, mode: 'insensitive' } }] }),
    ...(unread === 'true' && { reads: { none: { userId: u.id } } }),
  };
  const items = await prisma.announcement.findMany({ where, include: withRead(u.id), orderBy: { createdAt: 'desc' } });
  res.json(items.map(shape));
});

const schema = z.object({
  title: z.string().trim().min(5).max(150),
  body: z.string().trim().min(10).max(5000),
  category: z.nativeEnum(AnnouncementCategory),
  priority: z.nativeEnum(Priority).default('MEDIUM'),
  audience: z.array(z.nativeEnum(Role)).min(1, 'Choose at least one audience'),
});

export const createAnnouncement = asyncHandler(async (req, res) => {
  const u = req.user!;
  const body = schema.parse(req.body);
  const a = await prisma.announcement.create({ data: { ...body, authorId: u.profileId }, include: withRead(u.id) });
  const targets = await prisma.user.findMany({ where: { role: { in: body.audience }, id: { not: u.id } }, select: { id: true } });
  await notifyUsers(targets.map((t) => t.id), { type: 'ANNOUNCEMENT', title: 'New announcement', message: a.title, link: `/campus/announcements/${a.id}` });
  res.status(201).json(shape(a));
});

export const updateAnnouncement = asyncHandler(async (req, res) => {
  const a = await prisma.announcement.update({ where: { id: req.params.id }, data: schema.partial().parse(req.body), include: withRead(req.user!.id) });
  res.json(shape(a));
});

export const markRead = asyncHandler(async (req, res) => {
  const exists = await prisma.announcement.findUnique({ where: { id: req.params.id } });
  if (!exists) throw new HttpError(404, 'Announcement not found');
  await prisma.announcementRead.upsert({
    where: { announcementId_userId: { announcementId: exists.id, userId: req.user!.id } },
    update: {},
    create: { announcementId: exists.id, userId: req.user!.id },
  });
  res.status(204).end();
});
