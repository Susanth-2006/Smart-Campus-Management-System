import crypto from 'node:crypto';
import { env } from './env';

/**
 * Uploaded files are private. The API hands out short-lived signed links only to people who are allowed to see
 * the file (enrolled students, the course's faculty, the complaint's owner / admin / assigned staff).
 * A link stops working after `ttlSeconds`, and cannot be edited to point at another file.
 */
const mac = (name: string, exp: number) => crypto.createHmac('sha256', env.jwtSecret).update(`file:${name}:${exp}`).digest('base64url');

export function signedPath(storedName: string, ttlSeconds = 3600, now = Date.now()): string {
  const exp = Math.floor(now / 1000) + ttlSeconds;
  return `/uploads/${storedName}?exp=${exp}&sig=${mac(storedName, exp)}`;
}

export function verifySignature(storedName: string, exp: unknown, sig: unknown, now = Date.now()): boolean {
  const e = typeof exp === 'string' ? Number(exp) : NaN;
  if (!Number.isInteger(e) || e * 1000 < now || typeof sig !== 'string') return false;
  const a = Buffer.from(sig), b = Buffer.from(mac(storedName, e));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** '/uploads/abc.jpg' → 'abc.jpg' */
export const storedNameOf = (urlPath: string) => urlPath.split('/').pop() ?? '';
