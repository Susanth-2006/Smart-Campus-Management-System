import { asyncHandler, HttpError } from '../utils/errors';
import { prisma } from '../utils/prisma';

export const listNotifications = asyncHandler(async (req, res) => {
  const userId = req.user!.id;
  const [items, unreadCount] = await Promise.all([
    prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 50 }),
    prisma.notification.count({ where: { userId, read: false } }),
  ]);
  res.json({ items, unreadCount });
});

export const markNotificationRead = asyncHandler(async (req, res) => {
  const r = await prisma.notification.updateMany({ where: { id: req.params.id, userId: req.user!.id }, data: { read: true } });
  if (!r.count) throw new HttpError(404, 'Notification not found');
  res.status(204).end();
});

export const markAllRead = asyncHandler(async (req, res) => {
  await prisma.notification.updateMany({ where: { userId: req.user!.id, read: false }, data: { read: true } });
  res.status(204).end();
});
