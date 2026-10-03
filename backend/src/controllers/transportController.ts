import { z } from 'zod';
import { asyncHandler, HttpError } from '../utils/errors';
import { prisma } from '../utils/prisma';

export const listRoutes = asyncHandler(async (_req, res) => {
  res.json(await prisma.transportRoute.findMany({
    include: { stops: { orderBy: { order: 'asc' } }, _count: { select: { passes: true } } },
    orderBy: { number: 'asc' },
  }));
});

export const myRoute = asyncHandler(async (req, res) => {
  const pass = await prisma.transportPass.findUnique({
    where: { userId: req.user!.id },
    include: { route: { include: { stops: { orderBy: { order: 'asc' } } } }, stop: true },
  });
  res.json(pass);
});

const schema = z.object({ routeId: z.string().uuid(), stopId: z.string().uuid() });

export const setMyRoute = asyncHandler(async (req, res) => {
  const { routeId, stopId } = schema.parse(req.body);
  const userId = req.user!.id;
  const route = await prisma.transportRoute.findUnique({ where: { id: routeId }, include: { stops: true, _count: { select: { passes: true } } } });
  if (!route) throw new HttpError(404, 'Route not found');
  if (!route.stops.some((s) => s.id === stopId)) throw new HttpError(400, 'That stop is not on this route');
  const existing = await prisma.transportPass.findUnique({ where: { userId } });
  if (existing?.routeId !== routeId && route._count.passes >= route.capacity) throw new HttpError(409, 'This route is full');
  const pass = await prisma.transportPass.upsert({
    where: { userId }, update: { routeId, stopId }, create: { userId, routeId, stopId },
    include: { route: { include: { stops: { orderBy: { order: 'asc' } } } }, stop: true },
  });
  res.json(pass);
});

export const clearMyRoute = asyncHandler(async (req, res) => {
  await prisma.transportPass.deleteMany({ where: { userId: req.user!.id } });
  res.status(204).end();
});
