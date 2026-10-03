import { CalendarEventType } from '@prisma/client';
import { z } from 'zod';
import { asyncHandler } from '../utils/errors';
import { prisma } from '../utils/prisma';
import { parseDay } from '../utils/date';

export const listEvents = asyncHandler(async (req, res) => {
  const { from, to } = req.query as Record<string, string | undefined>;
  const start = from ? parseDay(from) : new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
  const end = to ? parseDay(to) : new Date(start.getTime() + 120 * 86_400_000);
  // Any event that overlaps the requested window
  res.json(await prisma.calendarEvent.findMany({
    where: { startDate: { lte: end }, endDate: { gte: start } },
    orderBy: [{ startDate: 'asc' }, { title: 'asc' }],
  }));
});

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
const schema = z.object({
  title: z.string().trim().min(3).max(120),
  type: z.nativeEnum(CalendarEventType),
  startDate: day,
  endDate: day.optional(),
  description: z.string().trim().max(500).optional(),
}).refine((e) => !e.endDate || e.endDate >= e.startDate, { message: 'End date cannot be before the start date', path: ['endDate'] });

const toData = (b: z.infer<typeof schema>) => ({ title: b.title, type: b.type, startDate: parseDay(b.startDate), endDate: parseDay(b.endDate ?? b.startDate), description: b.description || null });

export const createEvent = asyncHandler(async (req, res) => {
  res.status(201).json(await prisma.calendarEvent.create({ data: toData(schema.parse(req.body)) }));
});

export const updateEvent = asyncHandler(async (req, res) => {
  res.json(await prisma.calendarEvent.update({ where: { id: req.params.id }, data: toData(schema.parse(req.body)) }));
});

export const deleteEvent = asyncHandler(async (req, res) => {
  await prisma.calendarEvent.delete({ where: { id: req.params.id } });
  res.status(204).end();
});
