import { prisma } from './prisma';

type Payload = { type: string; title: string; message: string; link?: string };

export async function notifyUsers(userIds: string[], p: Payload) {
  const unique = [...new Set(userIds)];
  if (!unique.length) return;
  await prisma.notification.createMany({ data: unique.map((userId) => ({ userId, ...p })) });
}
