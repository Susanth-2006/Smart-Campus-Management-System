import assert from 'node:assert/strict';
process.env.JWT_SECRET ??= 'unit-test-secret-unit-test-secret-0123456789';

let passed = 0;
const t = (name: string, fn: () => void | Promise<void>) => queue.push(async () => { await fn(); passed++; console.log('  ✓', name); });
const queue: (() => Promise<void>)[] = [];

import { H_COURSES, H_FACULTY, H_SECTION, H_SLOTS, LUNCH, PERIODS, periodsPerWeek, slotTimes } from '../backend/prisma/hSection';
import { parseDay, campusToday } from '../backend/src/utils/date';
import { intParam, oneOf, textParam } from '../backend/src/utils/query';
import { HttpError, errorHandler } from '../backend/src/utils/errors';
import { signedPath, storedNameOf, verifySignature } from '../backend/src/utils/signedUrl';

// ------------------------------------------------------------------ dates
t('parseDay accepts real dates and rejects impossible ones', () => {
  assert.equal(parseDay('2026-02-28').toISOString(), '2026-02-28T00:00:00.000Z'); assert.equal(parseDay('2028-02-29').getUTCDate(), 29);
  for (const bad of ['2026-02-30', '2026-04-31', '2027-02-29', '2026-13-01', '2026-00-10', '26-01-01', '2026-1-1', '', 'today', '2026-01-01T00:00:00Z']) assert.throws(() => parseDay(bad), HttpError, bad);
});
t('campusToday uses the campus clock (IST), not UTC', () => {
  assert.equal(campusToday(new Date('2026-10-04T20:00:00Z')), '2026-10-05'); // 01:30 IST next day
  assert.equal(campusToday(new Date('2026-10-04T10:00:00Z')), '2026-10-04');
});

// ------------------------------------------------------------------ query helpers
t('oneOf: valid, absent, invalid', () => {
  assert.equal(oneOf('A', ['A', 'B'] as const, 'x'), 'A'); assert.equal(oneOf(undefined, ['A'] as const, 'x'), undefined); assert.equal(oneOf('', ['A'] as const, 'x'), undefined);
  for (const bad of ['C', ['A'], 5, {}, 'a']) assert.throws(() => oneOf(bad, ['A', 'B'] as const, 'status'), /Invalid status/);
});
t('intParam: parses, clamps, defaults, rejects junk', () => {
  assert.equal(intParam('5', 'n'), 5); assert.equal(intParam(undefined, 'n', { fallback: 7 }), 7); assert.equal(intParam('-5', 'n', { min: 1 }), 1); assert.equal(intParam('999', 'n', { max: 100 }), 100);
  for (const bad of ['abc', '1.5', '1e3', ' 5', '5 ', ['5'], '9'.repeat(30)]) assert.throws(() => intParam(bad, 'n'), HttpError, String(bad));
});
t('textParam: first value of a repeated key, trimmed, capped', () => {
  assert.equal(textParam(['a', 'b']), 'a'); assert.equal(textParam('  hi '), 'hi'); assert.equal(textParam(''), undefined); assert.equal(textParam({ x: 1 }), undefined); assert.equal(textParam('x'.repeat(500))!.length, 100);
});

// ------------------------------------------------------------------ error handler
const mockRes = () => { const r: any = { code: 0, body: null }; r.status = (c: number) => { r.code = c; return r; }; r.json = (b: unknown) => { r.body = b; return r; }; return r; };
t('errorHandler turns body-parser failures into 400 / 413', () => {
  let r = mockRes(); errorHandler(Object.assign(new SyntaxError('bad'), { type: 'entity.parse.failed', status: 400 }), {} as any, r, () => {}); assert.equal(r.code, 400);
  r = mockRes(); errorHandler(Object.assign(new Error('big'), { type: 'entity.too.large', status: 413 }), {} as any, r, () => {}); assert.equal(r.code, 413);
  r = mockRes(); const orig = console.error; console.error = () => {}; errorHandler(new Error('boom'), {} as any, r, () => {}); console.error = orig; assert.equal(r.code, 500); assert.ok(!JSON.stringify(r.body).includes('boom'), 'internal messages must not leak');
});

// ------------------------------------------------------------------ signed links
t('signed links verify, expire, and cannot be re-pointed', () => {
  const name = '0b8f3c1e-52a4-4d6b-9f10-7a3c2d1e4b5f.pdf', other = '1b8f3c1e-52a4-4d6b-9f10-7a3c2d1e4b5f.pdf', now = 1_800_000_000_000;
  const u = new URL('http://x' + signedPath(name, 60, now)); const exp = u.searchParams.get('exp'), sig = u.searchParams.get('sig');
  assert.equal(storedNameOf(u.pathname), name);
  assert.ok(verifySignature(name, exp, sig, now)); assert.ok(verifySignature(name, exp, sig, now + 59_000));
  assert.ok(!verifySignature(name, exp, sig, now + 61_000), 'expired');
  assert.ok(!verifySignature(other, exp, sig, now), 'other file'); assert.ok(!verifySignature(name, String(Number(exp) + 1), sig, now), 'extended expiry');
  assert.ok(!verifySignature(name, exp, 'AAAA', now)); assert.ok(!verifySignature(name, undefined, sig, now)); assert.ok(!verifySignature(name, exp, undefined, now)); assert.ok(!verifySignature(name, 'abc', sig, now));
});

// ------------------------------------------------------------------ H-Section data (transcribed from the department sheet)
const periodsOf = (x: { from: number; to: number }) => x.to - x.from + 1;
t('H-Section: weekly periods per subject equal the sheet\'s "No. of Periods" column for BOTH lab batches', () => {
  const sheet: Record<string, number> = { '20CS31001': 3, '20CS31002': 3, '20CS31003': 3, '20CE31061': 3, '20CS31L01': 2, '20CS31L02': 2, '20CS31L03': 2, '20EN31L01': 2, '20MA31P01': 4, '20CS31M03': 0 };
  for (const [code, n] of Object.entries(sheet)) { const c = H_COURSES.find((x) => x.code === code)!; assert.equal(c.periods, n, code); for (const b of ['B-1', 'B-2'] as const) assert.equal(periodsPerWeek(c.key, b), n, `${code} ${b}`); }
});
t('H-Section: every period of the week is filled for each batch, with no student clashes', () => {
  for (const batch of ['B-1', 'B-2']) {
    const used = new Set<string>();
    for (const x of H_SLOTS.filter((s) => s.batch === 'ALL' || s.batch === batch)) for (let p = x.from; p <= x.to; p++) { const k = `${x.day}-${p}`; assert.ok(!used.has(k), `${batch} clash on ${k}`); used.add(k); }
    assert.equal(used.size, 6 * 6, `${batch} should use all 36 periods (6 days x 6 periods)`);
  }
});
t('H-Section: no faculty member teaches two things at once, and lab batches are paired in parallel', () => {
  const fac = (key: string) => H_COURSES.find((c) => c.key === key)!.faculty;
  const seen = new Set<string>();
  for (const x of H_SLOTS) for (let p = x.from; p <= x.to; p++) { const k = `${fac(x.course)}|${x.day}-${p}`; assert.ok(!seen.has(k), `faculty double-booked ${k}`); seen.add(k); }
  const labs = H_SLOTS.filter((x) => x.batch !== 'ALL'); assert.equal(labs.length % 2, 0);
  for (const x of labs.filter((l) => l.batch === 'B-1')) assert.ok(labs.some((y) => y.batch === 'B-2' && y.day === x.day && y.from === x.from && y.to === x.to), `no parallel B-2 session for ${x.course} on day ${x.day}`);
});
t('H-Section: nothing is scheduled over lunch, periods are well-formed, courses exist', () => {
  for (const x of H_SLOTS) { const { startTime, endTime } = slotTimes(x); assert.ok(startTime < endTime); assert.ok(endTime <= LUNCH[0] || startTime >= LUNCH[1], `${x.course} overlaps lunch`); assert.ok(x.day >= 1 && x.day <= 6); assert.ok(H_COURSES.some((c) => c.key === x.course), x.course); }
  const ps = Object.values(PERIODS); for (let i = 1; i < ps.length; i++) assert.ok(ps[i][0] >= ps[i - 1][1], 'periods overlap');
});
t('H-Section: course codes are unique; sheet facts', () => {
  assert.equal(new Set(H_COURSES.map((c) => c.code)).size, H_COURSES.length);
  assert.equal(H_SECTION.room, '225'); assert.equal(H_SECTION.classTeacher, 'Md Naseruddin'); assert.equal(H_SECTION.section, 'H'); assert.equal(H_SECTION.semester, 5);
  assert.deepEqual(H_FACULTY.map((f) => f.name).sort(), ['Dr K Kamakshaiah', 'Dr N Mahendra', 'Dr N Nagi Reddy', 'Dr P Narasimha Raju', 'Dr Puja S Prasad', 'K Durga Kalyani', 'Md Naseruddin']);
  assert.equal(H_SLOTS.filter((x) => x.day === 6).length > 0, true, 'Saturday has classes');
});

(async () => { for (const f of queue) await f(); console.log(`\n${passed} passed (backend utilities & real timetable data)`); })().catch((e) => { console.error('\n✗ FAILED:', e.message); process.exit(1); });
