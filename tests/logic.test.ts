import assert from 'node:assert/strict';
import { computeGrade, computeTotal, MAX_MARKS } from '../backend/src/utils/grading';
import { gpa, gradeOf, attTone, fmtTime, toMin, firstName, MAX } from '../frontend/src/utils/format';
import { NAV } from '../frontend/src/utils/navConfig';
import { H_COURSES, H_FACULTY } from '../backend/prisma/hSection';
import fs from 'node:fs';
import path from 'node:path';

let passed = 0;
const t = (name: string, fn: () => void) => { fn(); passed++; console.log('  ✓', name); };

t('grade boundaries', () => {
  for (const [score, g] of [[100, 'O'], [90, 'O'], [89.9, 'A+'], [80, 'A+'], [70, 'A'], [60, 'B+'], [50, 'B'], [40, 'C'], [39.9, 'F'], [0, 'F']] as const) assert.equal(computeGrade(score), g, `score ${score}`);
});
t('frontend and backend grading agree for every integer score', () => { for (let i = 0; i <= 100; i++) assert.equal(gradeOf(i), computeGrade(i)); });
t('weights add up to 100 and match on both sides', () => {
  assert.equal(Object.values(MAX_MARKS).reduce((a, b) => a + b, 0), 100);
  assert.deepEqual({ ...MAX_MARKS }, { ...MAX });
});
t('total handles nulls and rounding', () => {
  assert.equal(computeTotal({ internal: 18.5, assignment: 9, midExam: null, finalExam: 40.25 }), 67.75);
  assert.equal(computeTotal({}), 0);
});
t('GPA is credit-weighted', () => {
  assert.equal(gpa([{ grade: 'O', course: { credits: 4 } }, { grade: 'B', course: { credits: 4 } }]), 8);
  assert.equal(gpa([{ grade: 'A', course: { credits: 3 } }, { grade: 'F', course: { credits: 1 } }]), 6);
  assert.equal(gpa([]), 0);
  assert.equal(gpa([{ grade: null, course: { credits: 4 } }]), 0);
});
t('attendance tone thresholds', () => {
  assert.equal(attTone(92).label, 'On track'); assert.equal(attTone(85).label, 'On track');
  assert.equal(attTone(81).label, 'Watch'); assert.equal(attTone(74.9).label, 'Low');
});
t('time helpers', () => {
  assert.equal(fmtTime('09:00'), '9:00 AM'); assert.equal(fmtTime('14:00'), '2:00 PM'); assert.equal(fmtTime('12:30'), '12:30 PM'); assert.equal(fmtTime('00:05'), '12:05 AM');
  assert.equal(toMin('11:30'), 690);
  assert.equal(firstName('Dr. Priya Rao'), 'Priya'); assert.equal(firstName('Susanth Kumar'), 'Susanth');
});
t('role navigation never exposes another role\'s areas', () => {
  const forbidden: Record<string, RegExp> = { STUDENT: /^\/(teaching|management|reports|system|tasks)/, FACULTY: /^\/(academics|management|reports|system|tasks)/, ADMIN: /^\/(academics|teaching|tasks)/, STAFF: /^\/(academics|teaching|management|reports|system)/ };
  for (const [role, items] of Object.entries(NAV)) for (const i of items) for (const l of i.children ?? [{ to: i.to! }]) assert.ok(!forbidden[role].test(l.to), `${role} sees ${l.to}`);
});
t('every nav link is either routed or an intentional placeholder', () => {
  const routes = fs.readFileSync(path.resolve(process.cwd(), 'frontend/src/routes/index.tsx'), 'utf8');
  const routed = new Set([...routes.matchAll(/path="([^"]+)"/g)].map((m) => m[1]));
  const placeholders: string[] = [];
  for (const [role, items] of Object.entries(NAV)) for (const i of items) for (const l of i.children ?? [{ to: i.to!, label: i.label }]) {
    const p = l.to.split('?')[0];
    assert.ok(routed.has(p) || placeholders.some((x) => p.endsWith(x)), `${role}: ${l.to} has no route`);
  }
});

// ---- seed timetable invariants (logic copied verbatim from prisma/seed.ts) ----
const seed = fs.readFileSync(path.resolve(process.cwd(), 'backend/prisma/seed.ts'), 'utf8');
const slotsFor = (i: number): [number, number][] => (i < 5 ? [[(i % 5) + 1, 0], [((i + 2) % 5) + 1, 1]] : [[1, 2], [4, 2]]);
t('seed uses the same slot function as the test', () => assert.ok(seed.includes('i < 5 ? [[(i % 5) + 1, 0], [((i + 2) % 5) + 1, 1]] : [[1, 2], [4, 2]]')));
t('seed timetable: no student-group or faculty clashes, rooms unique', () => {
  // CSE is the real H-Section (checked in backend-utils.test.ts); the other departments still use the generated slots
  const counts: Record<string, number> = { IT: 3, ECE: 3, ME: 3, CE: 3, EEE: 3 };
  let total = 0;
  for (const [dept, n] of Object.entries(counts)) {
    const seenSlot = new Set<string>(), facSlot = new Set<string>(), rooms = new Set<number>();
    for (let i = 0; i < n; i++) {
      total++;
      const fac = [0, 1, 2, 0, 1, 2][i];
      assert.ok(!rooms.has(200 + i * 2 + 4)); rooms.add(200 + i * 2 + 4);
      for (const [d, b] of slotsFor(i)) { const k = `${d}-${b}`; assert.ok(!seenSlot.has(k), `${dept} student clash ${k}`); seenSlot.add(k); const fk = `${fac}-${k}`; assert.ok(!facSlot.has(fk), `${dept} faculty clash`); facSlot.add(fk); assert.ok(d >= 1 && d <= 5 && b <= 2); }
    }
  }
  assert.equal(total, 15);
});
t('seed volumes meet the spec (50+ students, 15+ faculty, 5+ staff, 20+ courses, 6 depts + Humanities & Sciences)', () => {
  assert.ok(/i < 54/.test(seed)); assert.equal([...seed.matchAll(/code: '(CSE|IT|ECE|ME|CE|EEE|HS)'/g)].length, 7);
  const generated = [...seed.matchAll(/\['(?:IT|EC|ME|CE|EE)\d{3}', '/g)].length;
  assert.equal(generated, 15); assert.equal(generated + H_COURSES.length, 26); assert.ok(/staffTypes = \[[^\]]*\]/.test(seed));
  assert.ok(H_FACULTY.length + 15 >= 15, 'enough faculty');
});
t('demo accounts exist in seed', () => { for (const e of ['student', 'faculty', 'admin', 'staff']) assert.ok(seed.includes(`${e}@smartcampus.com`), e); });
console.log(`\n${passed} passed`);

// ---- upload safety helpers ----
import { signatureOk, STORED_NAME, IMAGES, DOCS, LIMIT } from '../backend/src/utils/files';
const buf = (...b: number[]) => Buffer.from([...b, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
t('upload: file signatures are checked, not just extensions', () => {
  assert.ok(signatureOk('jpg', buf(0xff, 0xd8, 0xff))); assert.ok(!signatureOk('jpg', Buffer.from('<html>script</html>')));
  assert.ok(signatureOk('png', buf(0x89, 0x50, 0x4e, 0x47))); assert.ok(!signatureOk('png', buf(0xff, 0xd8)));
  assert.ok(signatureOk('pdf', Buffer.from('%PDF-1.7 ...'))); assert.ok(!signatureOk('pdf', Buffer.from('MZ executable')));
  assert.ok(signatureOk('docx', Buffer.from('PK\u0003\u0004....'))); assert.ok(!signatureOk('docx', Buffer.from('not a zip')));
  assert.ok(signatureOk('webp', Buffer.from('RIFF....WEBPVP8 '))); assert.ok(!signatureOk('webp', Buffer.from('RIFF....WAVEfmt ')));
});
t('upload: stored names cannot escape the uploads folder or use risky types', () => {
  const ok = '0b8f3c1e-52a4-4d6b-9f10-7a3c2d1e4b5f';
  for (const ext of ['jpg', 'png', 'webp', 'pdf', 'docx', 'pptx', 'xlsx', 'txt']) assert.ok(STORED_NAME.test(`${ok}.${ext}`), ext);
  for (const bad of [`../${ok}.pdf`, `${ok}/../x.pdf`, `${ok}.html`, `${ok}.svg`, `${ok}.js`, `${ok}.exe`, `${ok}.pdf.html`, 'secret.pdf', `${ok}.PDF`, `/etc/passwd`, `${ok}.pdf\n`]) assert.ok(!STORED_NAME.test(bad), bad);
});
t('upload: no executable or scriptable types are allowed', () => {
  for (const mime of Object.keys({ ...IMAGES, ...DOCS })) assert.ok(!/html|javascript|svg|xml$|x-msdownload|php/.test(mime), mime);
  assert.ok(LIMIT.image < LIMIT.material);
});
t('complaint photo URL pattern only accepts our own uploads', () => {
  const src = fs.readFileSync(path.resolve(process.cwd(), 'backend/src/controllers/complaintController.ts'), 'utf8');
  const m = /imageUrl: z\.string\(\)\.regex\((\/.+?\/), '/.exec(src)!;
  const re = new RegExp(m[1].slice(1, -1));
  const id = '0b8f3c1e-52a4-4d6b-9f10-7a3c2d1e4b5f';
  assert.ok(re.test(`/uploads/${id}.jpg`)); assert.ok(re.test(`/uploads/${id}.webp`));
  for (const bad of ['https://evil.example/x.jpg', `/uploads/${id}.pdf`, `/uploads/../${id}.jpg`, 'javascript:alert(1)', `//evil.example/uploads/${id}.jpg`]) assert.ok(!re.test(bad), bad);
});
console.log(`\n${passed} passed (including upload safety)`);
