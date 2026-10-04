import bcrypt from 'bcrypt';
import { Role } from '@prisma/client';
import { z } from 'zod';
import { asyncHandler, HttpError } from '../utils/errors';
import { prisma } from '../utils/prisma';
import { signToken, toSafeUser } from '../services/authService';

const include = { student: { include: { department: true } }, faculty: { include: { department: true } }, admin: true, staff: true } as const;

// Compared against when the email is unknown, so "no such user" takes as long as "wrong password"
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  role: z.nativeEnum(Role).optional(),
});

export const login = asyncHandler(async (req, res) => {
  const { email, password, role } = loginSchema.parse(req.body);
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() }, include });
  const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH) && !!user;
  if (!user || !valid || (role && role !== user.role)) throw new HttpError(401, 'Invalid email, password or role');
  res.json({ token: signToken(user as any), user: toSafeUser(user as any) });
});

// JWTs are stateless: the client discards the token. Endpoint exists for a consistent API.
export const logout = asyncHandler(async (_req, res) => {
  res.status(204).end();
});

export const me = asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id }, include });
  if (!user) throw new HttpError(404, 'User not found');
  res.json(toSafeUser(user as any));
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Enter your current password'),
  newPassword: z.string().min(8, 'Use at least 8 characters').regex(/[A-Za-z]/, 'Include a letter').regex(/\d/, 'Include a number'),
});

export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = passwordSchema.parse(req.body);
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) throw new HttpError(400, 'Current password is incorrect');
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(newPassword, 10) } });
  res.status(204).end();
});
