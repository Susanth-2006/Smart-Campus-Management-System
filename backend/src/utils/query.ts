import { HttpError } from './errors';

/** A query-string value that must be one of `allowed` (or absent). Anything else is a 400, never a 500. */
export function oneOf<T extends string>(value: unknown, allowed: readonly T[], label: string): T | undefined {
  if (value === undefined || value === '') return undefined;
  if (typeof value !== 'string' || !(allowed as readonly string[]).includes(value)) {
    throw new HttpError(400, `Invalid ${label}. Use one of: ${allowed.join(', ')}`);
  }
  return value as T;
}

/** A whole-number query-string value. Absent → `fallback` (or undefined). Garbage → 400. Out of range is clamped. */
export function intParam(value: unknown, label: string, opts: { min?: number; max?: number; fallback?: number } = {}): number | undefined {
  if (value === undefined || value === '') return opts.fallback;
  const n = typeof value === 'string' && /^-?\d+$/.test(value) ? Number(value) : NaN;
  if (!Number.isSafeInteger(n)) throw new HttpError(400, `${label} must be a whole number`);
  return Math.min(opts.max ?? Infinity, Math.max(opts.min ?? -Infinity, n));
}

/** A free-text query-string value (first one wins if the key was repeated). */
export function textParam(value: unknown): string | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  return typeof v === 'string' && v.trim() ? v.trim().slice(0, 100) : undefined;
}
