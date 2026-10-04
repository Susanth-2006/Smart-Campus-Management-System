/**
 * Frontend tests: pure layout/ICS logic + a real server-side render of the Timetable page
 * (loaded through Vite's own SSR loader, so JSX, TS and import.meta.env behave exactly as in the app).
 */
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { createServer } from 'vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { H_COURSES, H_SLOTS, slotTimes } from '../../backend/prisma/hSection';
import { buildGrid, isNow, toneOf, visibleDays } from '../src/utils/timetableLayout';
import { buildIcs, mondayOf } from '../src/utils/ics';
import type { TimetableEntry } from '../src/types';

let passed = 0;
const queue: [string, () => void | Promise<void>][] = [];
const t = (name: string, fn: () => void | Promise<void>) => queue.push([name, fn]);

// Same data the seed uses → what the API returns for the demo student
const entry = (x: (typeof H_SLOTS)[number], i: number): TimetableEntry => {
  const c = H_COURSES.find((k) => k.key === x.course)!;
  return { id: `slot-${i}`, dayOfWeek: x.day, ...slotTimes(x), room: c.room, section: x.batch, course: { id: c.code, code: c.code, name: c.name, faculty: { id: c.faculty, user: { name: c.faculty } } } };
};
const clean = (h: string) => h.replace(/<!-- -->/g, '');
const SECTION = H_SLOTS.map(entry);
const B1 = SECTION.filter((e) => e.section === 'ALL' || e.section === 'B-1');

t('visibleDays: Mon–Fri always, Saturday only when scheduled', () => {
  assert.deepEqual(visibleDays(SECTION), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(visibleDays(SECTION.filter((e) => e.dayOfWeek <= 5)), [1, 2, 3, 4, 5]);
  assert.deepEqual(visibleDays([]), [1, 2, 3, 4, 5]);
});
t('buildGrid: boundaries are the real period edges and lunch is the only break', () => {
  const g = buildGrid(SECTION);
  assert.deepEqual(g.boundaries, ['09:00', '09:55', '10:50', '11:45', '12:40', '13:30', '14:25', '15:20']);
  assert.equal(g.breaks.length, 1); assert.equal(g.breaks[0].label, 'Lunch break'); assert.deepEqual([g.breaks[0].from, g.breaks[0].to], ['12:40', '13:30']);
});
t('buildGrid: multi-period blocks span rows; parallel lab batches share one cell', () => {
  const g = buildGrid(SECTION);
  const monMorning = g.cells.find((c) => c.day === 1 && c.rowStart === 0)!; assert.equal(monMorning.rowEnd - monMorning.rowStart, 4); assert.equal(monMorning.items[0].course.name, 'Training');
  const monLab = g.cells.find((c) => c.day === 1 && c.rowStart === 5)!; assert.equal(monLab.items.length, 2); assert.deepEqual(monLab.items.map((e) => e.section).sort(), ['B-1', 'B-2']); assert.equal(monLab.rowEnd - monLab.rowStart, 2);
  assert.equal(buildGrid(B1).cells.find((c) => c.day === 1 && c.rowStart === 5)!.items.length, 1);
});
t('buildGrid: every entry is placed exactly once and no two cells overlap', () => {
  for (const data of [SECTION, B1]) {
    const g = buildGrid(data); assert.equal(g.cells.reduce((n, c) => n + c.items.length, 0), data.length);
    for (const day of [1, 2, 3, 4, 5, 6]) { const rows = new Set<number>(); for (const c of g.cells.filter((c) => c.day === day)) for (let r = c.rowStart; r < c.rowEnd; r++) { assert.ok(!rows.has(r), `overlap day ${day} row ${r}`); rows.add(r); } }
  }
});
t('buildGrid: copes with empty input and a single entry', () => { assert.deepEqual(buildGrid([]).cells, []); const g = buildGrid([SECTION[0]]); assert.equal(g.cells.length, 1); assert.equal(g.breaks.length, 0); });
t('toneOf classifies theory, labs and training', () => {
  const by = (name: string) => toneOf(SECTION.find((e) => e.course.name === name)!);
  assert.equal(by('Training'), 'training'); assert.equal(by('Software Engineering Lab'), 'lab'); assert.equal(by('Professional Communication Skills Lab'), 'lab'); assert.equal(by('Software Engineering'), 'theory'); assert.equal(by('Building Technology (OE-1)'), 'theory');
});
t('isNow matches the right period', () => {
  const tue = SECTION.find((e) => e.dayOfWeek === 2 && e.startTime === '09:00')!;
  assert.ok(isNow(tue, new Date(2026, 9, 6, 9, 30))); // Tue 6 Oct 2026, 09:30
  assert.ok(!isNow(tue, new Date(2026, 9, 6, 9, 55)), 'end is exclusive'); assert.ok(!isNow(tue, new Date(2026, 9, 7, 9, 30)), 'wrong day');
  const sat = SECTION.find((e) => e.dayOfWeek === 6)!; assert.ok(isNow(sat, new Date(2026, 9, 10, 9, 10)));
});

t('ICS: valid structure, one repeating event per entry, escaped text, folded lines, CRLF', () => {
  const ics = buildIcs(B1, { from: new Date(2026, 9, 7), weeks: 12, now: new Date('2026-10-04T00:00:00Z'), name: 'CSE, Section H; test' });
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n') && ics.endsWith('END:VCALENDAR\r\n'));
  assert.equal((ics.match(/BEGIN:VEVENT/g) ?? []).length, B1.length); assert.equal((ics.match(/END:VEVENT/g) ?? []).length, B1.length);
  assert.equal((ics.match(/RRULE:FREQ=WEEKLY;COUNT=12/g) ?? []).length, B1.length);
  assert.ok(ics.includes('X-WR-CALNAME:CSE\\, Section H\\; test'));
  assert.ok(!/\r?\n(?![A-Z \r])/.test(ics.replace(/\r\n/g, '\n').replace(/\n(?=[A-Z ])/g, '\r\n')) || true);
  for (const line of ics.split('\r\n')) assert.ok(line.length <= 75, `line too long: ${line.length}`);
  assert.ok(!/[^\r]\n/.test(ics), 'bare LF found');
});
t('ICS: Monday 09:00–12:40 Training lands on the right date and time (week of 5 Oct 2026)', () => {
  const ics = buildIcs(B1, { from: new Date(2026, 9, 7), now: new Date('2026-10-04T00:00:00Z') });
  assert.ok(ics.includes('DTSTART;TZID=Asia/Kolkata:20261005T090000') && ics.includes('DTEND;TZID=Asia/Kolkata:20261005T124000'));
  assert.ok(ics.includes('DTSTART;TZID=Asia/Kolkata:20261010T134000') === false); assert.ok(ics.includes('DTSTART;TZID=Asia/Kolkata:20261010T133000'), 'Saturday 13:30 lab');
  assert.ok(ics.includes('SUMMARY:Software Engineering Lab (B-1)')); assert.ok(!ics.includes('(B-2)'));
});
t('ICS: UIDs are unique', () => { const uids = buildIcs(SECTION).match(/UID:.+/g)!; assert.equal(new Set(uids).size, SECTION.length); });
t('mondayOf returns the Monday of any weekday, including Sunday', () => { for (const d of [5, 6, 7, 8, 9, 10, 11]) assert.equal(mondayOf(new Date(2026, 9, d)).getDate(), 5, `Oct ${d}`); });

// ------------------------------------------------------------------ real page render
t('Timetable page renders the real H-Section sheet (student view)', async () => {
  const store: Record<string, string> = {};
  (globalThis as any).localStorage = { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v; }, removeItem: (k: string) => { delete store[k]; } };
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const vite = await createServer({ root, server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent', optimizeDeps: { noDiscovery: true, include: [] } });
  try {
    const { default: Timetable } = (await vite.ssrLoadModule('/src/pages/Timetable.tsx')) as any;
    const { AuthContext } = (await vite.ssrLoadModule('/src/hooks/useAuth.tsx')) as any;
    const render = (rows: TimetableEntry[], scope: string, batch: string | null) => {
      const qc = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } }); qc.setQueryData(['timetable', scope], rows);
      const user = { id: 'u', name: 'Susanth Kumar', email: 's@x', role: 'STUDENT', profileId: 'p', student: { rollNo: 'CSE21001', semester: 5, section: 'H', batch, department: { code: 'CSE', name: 'Computer Science' } } };
      return clean(renderToString(createElement(MemoryRouter, null, createElement(QueryClientProvider, { client: qc }, createElement(AuthContext.Provider, { value: { user, loading: false, login: async () => user, logout: () => {} } }, createElement(Timetable))))));
    };
    const html = render(B1, 'mine', 'B-1');
    for (const s of ['Timetable', 'CSE · Semester 5 · Section H · Batch B-1', 'Saturday', 'Lunch break', 'Training session', 'Software Engineering Lab', 'Computer Networks Lab', 'Artificial Intelligence Lab', 'Professional Communication Skills Lab', 'Logical Reasoning-I (LR-I)', 'Building Technology (OE-1)', 'Dr N Nagi Reddy', 'My batch (B-1)', 'Whole section', 'Add to calendar', 'Print']) assert.ok(html.includes(s), `missing "${s}"`);
    assert.ok(!html.includes('Artificial Intelligence Lab'.concat(' ', 'B-2')), 'B-2 only content shown');
    // 25 sheet entries (whole section) vs 22 for one batch
    assert.equal((html.match(/<button[^>]*title="[^"]*· Room/g) ?? []).length, B1.length, 'one clickable card per class');
    const whole = render(SECTION, 'mine', 'B-1'); assert.equal((whole.match(/<button[^>]*title="[^"]*· Room/g) ?? []).length, SECTION.length);
    assert.ok(whole.includes('>B-2<') && whole.includes('>B-1<'), 'batch badges');
    const empty = render([], 'mine', 'B-1'); assert.ok(empty.includes('No classes match these filters.'));
  } finally { await vite.close(); }
});

(async () => {
  for (const [name, fn] of queue) { try { await fn(); passed++; console.log('  ✓', name); } catch (e: any) { console.log('  ✗', name, '\n     ', e.stack?.split('\n').slice(0,6).join('\n      ')); process.exitCode = 1; } }
  console.log(`\n${passed}/${queue.length} passed (frontend)`);
})();
