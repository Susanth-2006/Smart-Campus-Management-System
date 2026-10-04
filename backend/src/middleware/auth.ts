import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { Role } from '../generated/prisma/client';
import { env } from '../utils/env';
import { HttpError } from '../utils/errors';

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return next(new HttpError(401, 'Authentication required'));
  try {
    const p = jwt.verify(header.slice(7), env.jwtSecret, { algorithms: ['HS256'] }) as { sub: string; role: Role; profileId: string };
    req.user = { id: p.sub, role: p.role, profileId: p.profileId };
    next();
  } catch {
    next(new HttpError(401, 'Session expired. Please sign in again.'));
  }
}

export const authorize =
  (...roles: Role[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) return next(new HttpError(403, 'You do not have access to this resource'));
    next();
  };
