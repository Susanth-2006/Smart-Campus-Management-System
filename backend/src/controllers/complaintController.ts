import { ComplaintCategory, ComplaintStatus, Prisma, Priority, TaskStatus } from '@prisma/client';
import { z } from 'zod';
import { asyncHandler, HttpError } from '../utils/errors';
import { prisma } from '../utils/prisma';
import { notifyUsers } from '../utils/notify';

const FLOW: ComplaintStatus[] = ['SUBMITTED', 'UNDER_REVIEW', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
const TASK_FOR: Partial<Record<ComplaintStatus, TaskStatus>> = { ASSIGNED: 'PENDING', IN_PROGRESS: 'IN_PROGRESS', RESOLVED: 'DONE' };

const listInclude = {
  student: { select: { rollNo: true, user: { select: { name: true } } } },
  task: { include: { staff: { select: { id: true, staffType: true, user: { select: { name: true } } } } } },
} as const;

export const listComplaints = asyncHandler(async (req, res) => {
  const u = req.user!;
  const { status, category, priority, q } = req.query as Record<string, string | undefined>;
  const where: Prisma.ComplaintWhereInput = {
    ...(status && { status: status as ComplaintStatus }),
    ...(category && { category: category as ComplaintCategory }),
    ...(priority && { priority: priority as Priority }),
    ...(q && { OR: [{ title: { contains: q, mode: 'insensitive' } }, { location: { contains: q, mode: 'insensitive' } }] }),
    ...(u.role === 'STUDENT' && { studentId: u.profileId }),
    ...(u.role === 'STAFF' && { task: { staffId: u.profileId } }),
  };
  res.json(await prisma.complaint.findMany({ where, include: listInclude, orderBy: { createdAt: 'desc' }, take: 500 }));
});

export const getComplaint = asyncHandler(async (req, res) => {
  const u = req.user!;
  const c = await prisma.complaint.findUnique({
    where: { id: req.params.id },
    include: { ...listInclude, events: { include: { actor: { select: { name: true, role: true } } }, orderBy: { createdAt: 'asc' } } },
  });
  if (!c) throw new HttpError(404, 'Complaint not found');
  if (u.role === 'STUDENT' && c.studentId !== u.profileId) throw new HttpError(403, 'Not your complaint');
  if (u.role === 'STAFF' && c.task?.staffId !== u.profileId) throw new HttpError(403, 'Not assigned to you');
  if (u.role === 'FACULTY') throw new HttpError(403, 'You do not have access to this resource');
  res.json(c);
});

const createSchema = z.object({
  title: z.string().trim().min(5, 'Title is too short').max(120),
  description: z.string().trim().min(10, 'Please add a little more detail').max(2000),
  category: z.nativeEnum(ComplaintCategory),
  location: z.string().trim().min(2).max(120),
  priority: z.nativeEnum(Priority).default('MEDIUM'),
  imageUrl: z.string().regex(/^\/uploads\/[a-f0-9-]{36}\.(jpg|png|webp)$/, 'Invalid image').optional(),
});

export const createComplaint = asyncHandler(async (req, res) => {
  const u = req.user!;
  const body = createSchema.parse(req.body);
  const complaint = await prisma.complaint.create({
    data: { ...body, studentId: u.profileId, events: { create: { status: 'SUBMITTED', actorId: u.id, note: 'Complaint submitted' } } },
    include: listInclude,
  });
  const admins = await prisma.user.findMany({ where: { role: 'ADMIN' }, select: { id: true } });
  await notifyUsers(admins.map((a) => a.id), {
    type: 'COMPLAINT', title: `New complaint #${complaint.ticketNo}`, message: complaint.title, link: `/campus/complaints/${complaint.id}`,
  });
  res.status(201).json(complaint);
});

const statusSchema = z.object({
  status: z.nativeEnum(ComplaintStatus),
  note: z.string().trim().max(500).optional(),
  staffId: z.string().uuid().optional(),
});

export const updateStatus = asyncHandler(async (req, res) => {
  const u = req.user!;
  const body = statusSchema.parse(req.body);
  const c = await prisma.complaint.findUnique({ where: { id: req.params.id }, include: { task: true, student: true } });
  if (!c) throw new HttpError(404, 'Complaint not found');

  // Who may do what
  if (u.role === 'STUDENT') {
    if (c.studentId !== u.profileId) throw new HttpError(403, 'Not your complaint');
    if (body.status !== 'CLOSED' || c.status !== 'RESOLVED') throw new HttpError(403, 'You can only close a resolved complaint');
  } else if (u.role === 'STAFF') {
    if (c.task?.staffId !== u.profileId) throw new HttpError(403, 'This task is not assigned to you');
    if (!['IN_PROGRESS', 'RESOLVED'].includes(body.status)) throw new HttpError(403, 'Staff can only start work or mark resolved');
  } else if (u.role !== 'ADMIN') {
    throw new HttpError(403, 'You do not have access to this resource');
  }

  const from = FLOW.indexOf(c.status);
  const to = FLOW.indexOf(body.status);
  const noteOnly = to === from && !!body.note;
  if (to < from || (to === from && !noteOnly)) throw new HttpError(400, `Cannot move from ${c.status} back to ${body.status}`);
  if (body.status === 'ASSIGNED' && !body.staffId && !c.task) throw new HttpError(400, 'staffId is required to assign a complaint');

  const staff = body.staffId ? await prisma.campusStaff.findUnique({ where: { id: body.staffId } }) : null;
  if (body.staffId && !staff) throw new HttpError(404, 'Staff member not found');

  const updated = await prisma.$transaction(async (tx) => {
    if (body.status === 'ASSIGNED' && staff) {
      await tx.maintenanceTask.upsert({
        where: { complaintId: c.id },
        update: { staffId: staff.id, status: 'PENDING' },
        create: { complaintId: c.id, staffId: staff.id, status: 'PENDING' },
      });
    } else if (c.task && TASK_FOR[body.status]) {
      await tx.maintenanceTask.update({ where: { complaintId: c.id }, data: { status: TASK_FOR[body.status], ...(body.note && { notes: body.note }) } });
    }
    await tx.complaintEvent.create({ data: { complaintId: c.id, status: body.status, note: body.note, actorId: u.id } });
    return tx.complaint.update({ where: { id: c.id }, data: { status: body.status }, include: listInclude });
  });

  await notifyUsers([c.student.userId], {
    type: 'COMPLAINT',
    title: `Complaint #${c.ticketNo} update`,
    message: noteOnly ? `A note was added to your complaint.` : `Your complaint is now ${body.status.replace('_', ' ').toLowerCase()}.`,
    link: `/campus/complaints/${c.id}`,
  });
  if (body.status === 'ASSIGNED' && staff) {
    await notifyUsers([staff.userId], { type: 'TASK', title: 'New task assigned', message: c.title, link: `/campus/complaints/${c.id}` });
  }
  res.json(updated);
});
