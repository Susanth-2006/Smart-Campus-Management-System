import { TimetableEntry } from '../types';

export interface Cell { day: number; rowStart: number; rowEnd: number; items: TimetableEntry[] }
export interface Band { from: string; to: string; label: string }
export interface Grid {
  /** Sorted time boundaries, e.g. 09:00, 09:55 … Row i spans boundaries[i] → boundaries[i + 1]. */
  boundaries: string[];
  /** Rows nobody has class in (lunch). Rendered as a full-width band instead of empty cells. */
  breaks: (Band & { row: number })[];
  cells: Cell[];
}

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

/**
 * Turns a flat list of timetable entries into grid cells that can span several rows
 * (a 4-period Training block, a 2-period lab) and hold several parallel entries (lab batches B-1 / B-2).
 */
export function buildGrid(entries: TimetableEntry[]): Grid {
  const boundaries = [...new Set(entries.flatMap((e) => [e.startTime, e.endTime]))].sort();
  const covered = new Set<number>();
  const cells: Cell[] = [];

  const days = [...new Set(entries.map((e) => e.dayOfWeek))].sort((a, b) => a - b);
  for (const day of days) {
    const list = entries.filter((e) => e.dayOfWeek === day).sort((a, b) => a.startTime.localeCompare(b.startTime) || a.endTime.localeCompare(b.endTime));
    let cur: { start: string; end: string; items: TimetableEntry[] } | null = null;
    const flush = () => {
      if (!cur) return;
      const rowStart = boundaries.indexOf(cur.start), rowEnd = boundaries.indexOf(cur.end);
      for (let r = rowStart; r < rowEnd; r++) covered.add(r);
      cells.push({ day, rowStart, rowEnd, items: cur.items });
    };
    for (const e of list) {
      if (cur && e.startTime < cur.end) { // overlaps the current cell → share it
        cur.items.push(e);
        if (e.endTime > cur.end) cur.end = e.endTime;
      } else {
        flush();
        cur = { start: e.startTime, end: e.endTime, items: [e] };
      }
    }
    flush();
  }

  const breaks: Grid['breaks'] = [];
  for (let r = 0; r < boundaries.length - 1; r++) {
    if (covered.has(r)) continue;
    const from = boundaries[r], to = boundaries[r + 1];
    const midday = toMin(from) <= 13 * 60 && toMin(to) >= 12 * 60 + 30;
    breaks.push({ row: r, from, to, label: midday ? 'Lunch break' : 'Break' });
  }
  return { boundaries, breaks, cells };
}

/** Days to show as columns: Mon–Fri always, plus Saturday (and Sunday) only when something is scheduled. */
export function visibleDays(entries: TimetableEntry[]): number[] {
  const extra = [6, 7].filter((d) => entries.some((e) => e.dayOfWeek === d));
  return [1, 2, 3, 4, 5, ...extra];
}

export type Tone = 'theory' | 'lab' | 'training';
export const toneOf = (e: TimetableEntry): Tone => (/^training$/i.test(e.course.name) ? 'training' : / lab\b/i.test(e.course.name) ? 'lab' : 'theory');

/** The period (entry) in progress at `now`, if any. `dayOfWeek`: 1 = Monday … 7 = Sunday. */
export function isNow(e: TimetableEntry, now: Date): boolean {
  const dow = now.getDay() === 0 ? 7 : now.getDay();
  const m = now.getHours() * 60 + now.getMinutes();
  return e.dayOfWeek === dow && m >= toMin(e.startTime) && m < toMin(e.endTime);
}
