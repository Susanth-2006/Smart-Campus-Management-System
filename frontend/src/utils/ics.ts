import { TimetableEntry } from '../types';

const pad = (n: number) => String(n).padStart(2, '0');
const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
/** RFC 5545 §3.1: lines longer than 75 characters are folded with CRLF + space. */
const fold = (line: string) => line.length <= 75 ? line : line.match(/.{1,74}/g)!.map((p, i) => (i ? ' ' + p : p)).join('\r\n');
const ymd = (d: Date) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
const hm = (t: string) => t.replace(':', '') + '00';
const stampOf = (d: Date) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;

export const mondayOf = (d: Date) => { const m = new Date(d.getFullYear(), d.getMonth(), d.getDate()); m.setDate(m.getDate() - ((m.getDay() + 6) % 7)); return m; };

/**
 * A weekly-repeating calendar (.ics) of the timetable that Google / Apple / Outlook calendars can import.
 * Times are in the campus time zone (Asia/Kolkata, no daylight saving).
 */
export function buildIcs(entries: TimetableEntry[], opts: { weeks?: number; from?: Date; name?: string; now?: Date } = {}): string {
  const weeks = opts.weeks ?? 16, now = opts.now ?? new Date(), monday = mondayOf(opts.from ?? now);
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Smart Campus//Timetable//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    `X-WR-CALNAME:${esc(opts.name ?? 'Class timetable')}`, 'X-WR-TIMEZONE:Asia/Kolkata',
    'BEGIN:VTIMEZONE', 'TZID:Asia/Kolkata', 'BEGIN:STANDARD', 'DTSTART:19700101T000000', 'TZOFFSETFROM:+0530', 'TZOFFSETTO:+0530', 'TZNAME:IST', 'END:STANDARD', 'END:VTIMEZONE',
  ];
  for (const e of entries) {
    const day = new Date(monday); day.setDate(monday.getDate() + e.dayOfWeek - 1);
    const batch = e.section && e.section !== 'ALL' ? ` (${e.section})` : '';
    lines.push(
      'BEGIN:VEVENT',
      `UID:${e.id}@smartcampus`,
      `DTSTAMP:${stampOf(now)}`,
      `DTSTART;TZID=Asia/Kolkata:${ymd(day)}T${hm(e.startTime)}`,
      `DTEND;TZID=Asia/Kolkata:${ymd(day)}T${hm(e.endTime)}`,
      `RRULE:FREQ=WEEKLY;COUNT=${weeks}`,
      `SUMMARY:${esc(e.course.name + batch)}`,
      `LOCATION:${esc('Room ' + e.room)}`,
      `DESCRIPTION:${esc(`${e.course.code} · ${e.course.faculty.user.name}`)}`,
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}
