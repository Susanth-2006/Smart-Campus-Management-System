import { HttpError } from './errors';

/** Strict YYYY-MM-DD → UTC midnight. Rejects impossible dates such as 2026-02-30 (JavaScript would silently roll them over). */
export function parseDay(s: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new HttpError(400, 'Date must be YYYY-MM-DD');
  const d = new Date(`${s}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s) throw new HttpError(400, 'Invalid date');
  return d;
}

/** Today's date (YYYY-MM-DD) on the campus clock, not the server's. Set CAMPUS_TZ to change it. */
export function campusToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: process.env.CAMPUS_TZ ?? 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
