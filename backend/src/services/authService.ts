import jwt from 'jsonwebtoken';
import { Prisma } from '@prisma/client';
import { env } from '../utils/env';

export type UserWithProfiles = Prisma.UserGetPayload<{
  include: { student: true; faculty: true; admin: true; staff: true };
}>;

export const profileIdOf = (u: UserWithProfiles) =>
  (u.student?.id ?? u.faculty?.id ?? u.admin?.id ?? u.staff?.id) as string;

export function signToken(u: UserWithProfiles) {
  return jwt.sign({ role: u.role, profileId: profileIdOf(u) }, env.jwtSecret, {
    subject: u.id,
    expiresIn: env.jwtExpiresIn as jwt.SignOptions['expiresIn'],
    algorithm: 'HS256',
  });
}

export function toSafeUser(u: UserWithProfiles) {
  const { passwordHash: _omit, student, faculty, admin, staff, ...rest } = u;
  return { ...rest, profileId: profileIdOf(u), student, faculty, admin, staff };
}
