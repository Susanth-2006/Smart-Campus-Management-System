import { z } from 'zod';
import { asyncHandler, HttpError } from '../utils/errors';
import { prisma } from '../utils/prisma';

const LOAN_DAYS = 14;
const MAX_LOANS = 3;

export const listBooks = asyncHandler(async (req, res) => {
  const u = req.user!;
  const { q, category } = req.query as Record<string, string | undefined>;
  const books = await prisma.book.findMany({
    where: {
      ...(category && { category }),
      ...(q && { OR: [{ title: { contains: q, mode: 'insensitive' } }, { author: { contains: q, mode: 'insensitive' } }, { isbn: { contains: q } }] }),
    },
    include: { loans: { where: { userId: u.id, returnedAt: null }, select: { id: true, dueAt: true } } },
    orderBy: { title: 'asc' },
    take: 200,
  });
  res.json(books.map(({ loans, ...b }) => ({ ...b, myLoan: loans[0] ?? null })));
});

export const listCategories = asyncHandler(async (_req, res) => {
  const rows = await prisma.book.groupBy({ by: ['category'], _count: { _all: true }, orderBy: { category: 'asc' } });
  res.json(rows.map((r) => ({ category: r.category, count: r._count._all })));
});

const bookSchema = z.object({
  title: z.string().trim().min(2).max(200),
  author: z.string().trim().min(2).max(120),
  category: z.string().trim().min(2).max(60),
  isbn: z.string().trim().max(20).optional(),
  copies: z.number().int().min(1).max(100),
});

export const createBook = asyncHandler(async (req, res) => {
  const b = bookSchema.parse(req.body);
  res.status(201).json(await prisma.book.create({ data: { ...b, isbn: b.isbn || null, available: b.copies } }));
});

export const borrow = asyncHandler(async (req, res) => {
  const u = req.user!;
  const book = await prisma.book.findUnique({ where: { id: req.params.id } });
  if (!book) throw new HttpError(404, 'Book not found');

  const loan = await prisma.$transaction(async (tx) => {
    const active = await tx.bookLoan.findMany({ where: { userId: u.id, returnedAt: null } });
    if (active.length >= MAX_LOANS) throw new HttpError(400, `You can borrow up to ${MAX_LOANS} books at a time`);
    if (active.some((l) => l.bookId === book.id)) throw new HttpError(400, 'You already have a copy of this book');
    if (active.some((l) => l.dueAt < new Date())) throw new HttpError(400, 'Please return your overdue books first');
    const taken = await tx.book.updateMany({ where: { id: book.id, available: { gt: 0 } }, data: { available: { decrement: 1 } } });
    if (!taken.count) throw new HttpError(409, 'No copies are available right now');
    return tx.bookLoan.create({ data: { bookId: book.id, userId: u.id, dueAt: new Date(Date.now() + LOAN_DAYS * 86_400_000) }, include: { book: true } });
  });
  res.status(201).json(loan);
});

export const listLoans = asyncHandler(async (req, res) => {
  const u = req.user!;
  const all = u.role === 'ADMIN';
  const active = req.query.status === 'active';
  res.json(await prisma.bookLoan.findMany({
    where: { ...(all ? {} : { userId: u.id }), ...(active && { returnedAt: null }) },
    include: { book: { select: { title: true, author: true } }, user: { select: { name: true, role: true } } },
    orderBy: [{ returnedAt: { sort: 'asc', nulls: 'first' } }, { dueAt: 'asc' }],
    take: 300,
  }));
});

export const returnLoan = asyncHandler(async (req, res) => {
  const u = req.user!;
  const loan = await prisma.bookLoan.findUnique({ where: { id: req.params.id } });
  if (!loan) throw new HttpError(404, 'Loan not found');
  if (loan.userId !== u.id && u.role !== 'ADMIN') throw new HttpError(403, 'This is not your loan');
  if (loan.returnedAt) throw new HttpError(400, 'Already returned');
  const [updated] = await prisma.$transaction([
    prisma.bookLoan.update({ where: { id: loan.id }, data: { returnedAt: new Date() }, include: { book: { select: { title: true, author: true } } } }),
    prisma.book.update({ where: { id: loan.bookId }, data: { available: { increment: 1 } } }),
  ]);
  res.json(updated);
});
