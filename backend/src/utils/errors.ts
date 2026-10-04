import { NextFunction, Request, RequestHandler, Response } from 'express';
import { Prisma } from '../generated/prisma/client';
import { ZodError } from 'zod';

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      message: 'Validation failed',
      issues: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
  }
  if (err instanceof HttpError) return res.status(err.status).json({ message: err.message });

  // Errors raised by express.json() before our code runs (bad JSON, body too large)
  const type = (err as { type?: string } | null)?.type;
  if (type === 'entity.parse.failed') return res.status(400).json({ message: 'Request body is not valid JSON' });
  if (type === 'entity.too.large') return res.status(413).json({ message: 'Request body is too large' });

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') return res.status(409).json({ message: 'Record already exists' });
    if (err.code === 'P2025') return res.status(404).json({ message: 'Record not found' });
    if (err.code === 'P2003') return res.status(400).json({ message: 'Invalid reference' });
    if (err.code === 'P2023') return res.status(400).json({ message: 'Invalid identifier' });
  }
  // A filter the database could not make sense of (e.g. ?courseId=a&courseId=b) is the caller's mistake, not ours
  if (err instanceof Prisma.PrismaClientValidationError) return res.status(400).json({ message: 'Invalid request parameters' });

  console.error(err);
  res.status(500).json({ message: 'Something went wrong. Please try again.' });
}
