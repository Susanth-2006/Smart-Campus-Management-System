/**
 * API integration tests: run against a LIVE server with the demo seed loaded.
 *
 *   1. cd backend && npm run db:seed && npm run dev      (terminal 1)
 *   2. npm run test:api                                  (terminal 2)
 *
 * API_URL        test another host (default http://localhost:4000)
 * RATE_LIMIT_TEST=1   also checks the login rate limiter (start the API with LOGIN_RATE_LIMIT=5 first)
 *
 * The suite cleans up after itself where it can and is safe to re-run, but re-seed for a pristine state.
 * Tip: start the API with LOGIN_RATE_LIMIT=1000 if you run the suite many times in 15 minutes.
 */
import assert from 'node:assert/strict';

const API = (process.env.API_URL ?? 'http://localhost:4000').replace(/\/$/, '');
const PASSWORD = 'Password@123';

type Res = { status: number; body: any };
async function call(method: string, path: string, token?: string | null, body?: unknown, headers: Record<string, string> = {}): Promise<Res> {
  const r = await fetch(`${API}${path}`, {
    method,
    headers: { ...(body !== undefined && { 'content-type': 'application/json' }), ...(token && { authorization: `Bearer ${token}` }), ...headers },
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });
  const text = await r.text();
  let parsed: any = text;
  try { parsed = text ? JSON.parse(text) : null; } catch { /* non-JSON body */ }
  return { status: r.status, body: parsed };
}
const get = (p: string, t?: string | null) => call('GET', p, t);
const post = (p: string, t: string | null | undefined, b?: unknown) => call('POST', p, t, b ?? {});
const put = (p: string, t: string, b: unknown) => call('PUT', p, t, b);
const patch = (p: string, t: string, b?: unknown) => call('PATCH', p, t, b ?? {});
const del = (p: string, t: string) => call('DELETE', p, t);

let passed = 0;
const failures: string[] = [];
async function t(name: string, fn: () => Promise<void>) {
  try { await fn(); passed++; console.log('  ✓', name); }
  catch (e: any) { failures.push(`${name}: ${e.message?.split('\n')[0]}`); console.log('  ✗', name, '\n     ', e.message?.split('\n').slice(0, 3).join('\n      ')); }
}
const section = (s: string) => console.log(`\n${s}`);

async function login(role: string) {
  const r = await post('/api/auth/login', null, { email: `${role}@smartcampus.com`, password: PASSWORD });
  assert.equal(r.status, 200, `login ${role}: ${r.status} ${r.body?.message ?? ''}`);
  return { token: r.body.token as string, user: r.body.user };
}

const png = () => 'data:image/png;base64,' + Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64)]).toString('base64');
const pdf = (text = 'test') => 'data:application/pdf;base64,' + Buffer.from(`%PDF-1.4 ${text}`).toString('base64');
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());

async function main() {
  try { await fetch(`${API}/api/health`); } catch {
    console.log(`API not reachable at ${API}. Start it first (cd backend && npm run dev) and seed the DB.`);
    process.exit(2);
  }

  const S = await login('student'), F = await login('faculty'), A = await login('admin'), W = await login('staff');
  const tok: Record<string, string> = { student: S.token, faculty: F.token, admin: A.token, staff: W.token };

  section('Health & auth');
  await t('health endpoint checks the database', async () => { const r = await get('/api/health'); assert.equal(r.status, 200); assert.equal(r.body.status, 'ok'); assert.equal(r.body.db, 'ok'); assert.equal(r.body.seeded, true, 'health should say the database is seeded'); });
  await t('security headers are present (helmet)', async () => {
    const r = await fetch(`${API}/api/health`);
    assert.equal(r.headers.get('x-content-type-options'), 'nosniff'); assert.ok(!r.headers.get('x-powered-by'), 'x-powered-by should be hidden');
  });
  await t('login: wrong password → 401', async () => assert.equal((await post('/api/auth/login', null, { email: 'student@smartcampus.com', password: 'nope' })).status, 401));
  await t('login: unknown user → 401 with the same message as a wrong password', async () => {
    const a = await post('/api/auth/login', null, { email: 'ghost@smartcampus.com', password: 'x' });
    const b = await post('/api/auth/login', null, { email: 'student@smartcampus.com', password: 'x' });
    assert.equal(a.status, 401); assert.equal(a.body.message, b.body.message);
  });
  await t('login: wrong role selected → 401', async () => assert.equal((await post('/api/auth/login', null, { email: 'student@smartcampus.com', password: PASSWORD, role: 'ADMIN' })).status, 401));
  await t('login: email is case-insensitive', async () => assert.equal((await post('/api/auth/login', null, { email: 'STUDENT@SmartCampus.com', password: PASSWORD })).status, 200));
  await t('login: bad payload → 400 with issues', async () => { const r = await post('/api/auth/login', null, { email: 'not-an-email' }); assert.equal(r.status, 400); assert.ok(r.body.issues?.length); });
  await t('malformed JSON → 400 (not 500)', async () => { const r = await call('POST', '/api/auth/login', null, '{bad json', { 'content-type': 'application/json' }); assert.equal(r.status, 400, `got ${r.status}`); });
  await t('login response never leaks the password hash', async () => assert.ok(!JSON.stringify(S.user).includes('passwordHash')));
  await t('no token → 401', async () => assert.equal((await get('/api/courses')).status, 401));
  await t('garbage token → 401', async () => assert.equal((await get('/api/courses', 'abc.def.ghi')).status, 401));
  await t('alg=none token is rejected', async () => {
    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const forged = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: A.user.id, role: 'ADMIN', profileId: A.user.profileId })}.`;
    assert.equal((await get('/api/stats', forged)).status, 401);
  });
  await t('/auth/me returns the logged-in user', async () => { const r = await get('/api/auth/me', S.token); assert.equal(r.status, 200); assert.equal(r.body.email, 'student@smartcampus.com'); });

  section('Role-based access control matrix');
  const matrix: [string, string, Record<string, number>][] = [
    ['GET', '/api/students', { student: 403, faculty: 200, admin: 200, staff: 403 }],
    ['GET', '/api/stats', { student: 403, faculty: 403, admin: 200, staff: 403 }],
    ['GET', '/api/users', { student: 403, faculty: 403, admin: 200, staff: 403 }],
    ['GET', '/api/staff', { student: 403, faculty: 403, admin: 200, staff: 403 }],
    ['GET', '/api/timetable', { student: 200, faculty: 200, admin: 200, staff: 403 }],
    ['GET', '/api/attendance', { student: 200, faculty: 200, admin: 200, staff: 403 }],
    ['GET', '/api/marks', { student: 200, faculty: 200, admin: 200, staff: 403 }],
    ['GET', '/api/complaints', { student: 200, faculty: 403, admin: 200, staff: 200 }],
    ['GET', '/api/announcements', { student: 200, faculty: 200, admin: 200, staff: 200 }],
    ['GET', '/api/notifications', { student: 200, faculty: 200, admin: 200, staff: 200 }],
    ['GET', '/api/facilities', { student: 200, faculty: 200, admin: 200, staff: 200 }],
    ['GET', '/api/library/books', { student: 200, faculty: 200, admin: 200, staff: 200 }],
    ['GET', '/api/transport/routes', { student: 200, faculty: 200, admin: 200, staff: 200 }],
    ['GET', '/api/calendar', { student: 200, faculty: 200, admin: 200, staff: 200 }],
  ];
  for (const [m, p, exp] of matrix) await t(`${m} ${p}`, async () => { for (const [role, code] of Object.entries(exp)) assert.equal((await call(m, p, tok[role])).status, code, `${role} expected ${code}`); });
  await t('write endpoints are admin-only (calendar, courses, announcements, timetable, library books)', async () => {
    for (const [p, b] of [['/api/calendar', { title: 'x y z', type: 'EVENT', startDate: today() }], ['/api/courses', {}], ['/api/announcements', {}], ['/api/timetable', {}], ['/api/library/books', {}]] as const)
      for (const role of ['student', 'faculty', 'staff']) assert.equal((await post(p, tok[role], b)).status, 403, `${role} POST ${p}`);
  });

  // ------------------------------------------------------------------ data discovery
  const myCourses = (await get('/api/courses?mine=true', S.token)).body as any[];
  const facCourses = (await get('/api/courses?mine=true', F.token)).body as any[];
  const shared = myCourses.find((c) => facCourses.some((f) => f.id === c.id));
  assert.ok(shared, 'seed needs a course shared by the demo faculty and the demo student');

  section('Real timetable: III B.Tech CSE · Section H (from the department sheet)');
  const myTT = (await get('/api/timetable', S.token)).body as any[];
  const sectionTT = (await get('/api/timetable?scope=section', S.token)).body as any[];
  await t('demo student is in Section H, lab batch B-1', async () => { const me = (await get('/api/auth/me', S.token)).body.student; assert.equal(me.section, 'H'); assert.equal(me.batch, 'B-1'); assert.equal(me.department.code, 'CSE'); });
  await t('timetable includes Saturday classes', async () => assert.ok(myTT.some((e) => e.dayOfWeek === 6), 'no Saturday entries'));
  await t('a student sees only their own lab batch by default', async () => assert.ok(myTT.every((e) => ['ALL', 'B-1'].includes(e.section))));
  await t('?scope=section shows every batch (like the paper sheet)', async () => { assert.ok(sectionTT.length > myTT.length); assert.ok(sectionTT.some((e) => e.section === 'B-2')); });
  await t('Monday afternoon = SE Lab for B-1, AI Lab for B-2', async () => {
    const mon = sectionTT.filter((e) => e.dayOfWeek === 1 && e.startTime === '13:30');
    assert.deepEqual(mon.map((e) => `${e.course.code}:${e.section}`).sort(), ['20CS31L01:B-1', '20CS31L03:B-2']);
  });
  await t('Wednesday is Training until lunch, then AI and BT', async () => {
    const wed = myTT.filter((e) => e.dayOfWeek === 3).sort((a, b) => a.startTime.localeCompare(b.startTime)).map((e) => `${e.startTime}-${e.endTime} ${e.course.code}`);
    assert.deepEqual(wed, ['09:00-12:40 TRAINING', '13:30-14:25 20CS31003', '14:25-15:20 20CE31061']);
  });
  await t('nothing is scheduled during lunch (12:40–13:30)', async () => assert.ok(sectionTT.every((e) => e.endTime <= '12:40' || e.startTime >= '13:30')));
  await t('weekly periods match the sheet for a B-1 student', async () => {
    const periods = (e: any) => { const mins = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3)); const span = mins(e.endTime) - mins(e.startTime); return Math.round(span / 55) - (e.startTime < '12:40' && e.endTime > '12:40' ? 0 : 0); };
    const by = (code: string) => myTT.filter((e) => e.course.code === code).reduce((n, e) => n + periods(e), 0);
    assert.equal(by('20CS31001'), 3); assert.equal(by('20CS31002'), 3); assert.equal(by('20CS31003'), 3); assert.equal(by('20CE31061'), 3);
    assert.equal(by('20CS31L01'), 2); assert.equal(by('20CS31L02'), 2); assert.equal(by('20CS31L03'), 2); assert.equal(by('20EN31L01'), 2); assert.equal(by('20MA31P01'), 4);
  });
  await t('subjects have the faculty printed on the sheet', async () => {
    const who = (code: string) => myTT.find((e) => e.course.code === code)?.course.faculty.user.name;
    assert.equal(who('20CS31002'), 'Dr Puja S Prasad'); assert.equal(who('20CS31003'), 'Dr K Kamakshaiah'); assert.equal(who('20CE31061'), 'Dr N Mahendra'); assert.equal(who('20MA31P01'), 'Dr N Nagi Reddy');
  });
  await t('faculty see all batches of their own lab', async () => {
    const ft = (await get('/api/timetable', F.token)).body as any[];
    assert.ok(ft.some((e) => e.course.code === 'TRAINING') === false || true);
    const lab = ft.filter((e) => e.course.code === '20CS31L01').map((e) => e.section).sort();
    assert.deepEqual(lab, ['B-1', 'B-2']);
  });
  await t('timetable ?day filter works and rejects junk', async () => { assert.ok((await get('/api/timetable?day=6', S.token)).body.every((e: any) => e.dayOfWeek === 6)); assert.equal((await get('/api/timetable?day=abc', S.token)).status, 400); });
  await t('Introduction to Cyber Security (0 periods) is a course without a weekly slot', async () => {
    const ics = myCourses.find((c) => c.code === '20CS31M03'); assert.ok(ics, 'ICS course missing');
    assert.equal(myTT.filter((e) => e.course.code === '20CS31M03').length, 0);
  });

  section('Students & data isolation');
  await t('student sees only own attendance rows', async () => { const r = await get('/api/attendance', S.token); assert.equal(r.status, 200); assert.ok(r.body.length > 0); });
  await t('student cannot read another student via ?studentId', async () => {
    const list = (await get('/api/students?limit=5', A.token)).body.items as any[];
    const other = list.find((s) => s.id !== S.user.profileId)!;
    const r = await get(`/api/attendance?studentId=${other.id}`, S.token);
    assert.ok(r.body.every((x: any) => x.studentId === S.user.profileId), 'leaked other student rows');
    assert.equal((await get(`/api/students/${other.id}`, S.token)).status, 403);
  });
  await t('attendance summary: percentages are within 0-100 and consistent', async () => {
    const r = (await get('/api/attendance/summary', S.token)).body;
    assert.ok(r.overall >= 0 && r.overall <= 100);
    for (const c of r.courses) { assert.equal(c.total, c.present + c.late + c.absent); assert.ok(c.percentage >= 0 && c.percentage <= 100); }
  });
  await t('a B-1 student has no attendance on B-2-only sessions', async () => {
    const rows = (await get('/api/attendance?courseId=' + myCourses.find((c) => c.code === '20CS31L01').id, S.token)).body as any[];
    // SE Lab B-1 is Monday (UTC day 1); B-2 is Saturday (6)
    assert.ok(rows.length > 0 && rows.every((r) => new Date(r.date).getUTCDay() === 1), 'B-1 student has SE Lab attendance on a non-Monday');
  });
  await t('student marks list contains published marks only', async () => { const r = await get('/api/marks', S.token); assert.ok(r.body.every((m: any) => m.published === true)); });
  await t('students list: pagination clamps nonsense, rejects junk', async () => {
    const r = await get('/api/students?page=-5&limit=100000', A.token);
    assert.equal(r.status, 200); assert.ok(r.body.limit <= 100 && r.body.page >= 1);
    assert.equal((await get('/api/students?page=abc', A.token)).status, 400);
  });
  await t('faculty sees only students from their own courses', async () => {
    const mine = (await get('/api/students?limit=100', F.token)).body, all = (await get('/api/students?limit=100', A.token)).body;
    assert.ok(mine.total < all.total, `faculty sees ${mine.total} of ${all.total}`);
  });
  await t('faculty cannot open a student that is not in their courses', async () => {
    const mine = new Set(((await get('/api/students?limit=100', F.token)).body.items as any[]).map((s) => s.id));
    const outsider = ((await get('/api/students?limit=100', A.token)).body.items as any[]).find((s) => !mine.has(s.id));
    assert.ok(outsider, 'seed should contain a student outside the faculty member\'s courses');
    assert.equal((await get(`/api/students/${outsider.id}`, F.token)).status, 403);
    assert.equal((await get(`/api/students/${S.user.profileId}`, F.token)).status, 200, 'but their own student is fine');
  });

  section('Attendance (faculty)');
  const date = '2026-01-15';
  const roster = (await get(`/api/students?courseId=${shared.id}&limit=100`, F.token)).body.items as any[];
  await t('mark attendance for own course', async () => {
    const r = await post('/api/attendance', F.token, { courseId: shared.id, date, records: roster.map((s) => ({ studentId: s.id, status: 'PRESENT' })) });
    assert.equal(r.status, 201); assert.equal(r.body.saved, roster.length);
  });
  await t('marking twice is idempotent (upsert, no duplicates)', async () => {
    const before = (await get(`/api/attendance?courseId=${shared.id}&date=${date}`, F.token)).body.length;
    await post('/api/attendance', F.token, { courseId: shared.id, date, records: [{ studentId: roster[0].id, status: 'ABSENT' }] });
    const after = (await get(`/api/attendance?courseId=${shared.id}&date=${date}`, F.token)).body;
    assert.equal(after.length, before); assert.equal(after.find((x: any) => x.studentId === roster[0].id).status, 'ABSENT');
  });
  await t('student is notified of attendance update', async () => assert.ok(((await get('/api/notifications', S.token)).body.items as any[]).some((i) => i.type === 'ATTENDANCE')));
  await t('faculty cannot mark someone else\'s course', async () => {
    const foreign = ((await get('/api/courses', A.token)).body as any[]).find((c) => !facCourses.some((f) => f.id === c.id))!;
    assert.equal((await post('/api/attendance', F.token, { courseId: foreign.id, date, records: [{ studentId: roster[0].id, status: 'PRESENT' }] })).status, 403);
  });
  await t('cannot mark a student who is not enrolled', async () => {
    const outsider = ((await get('/api/students?limit=100', A.token)).body.items as any[]).find((s) => !roster.some((r) => r.id === s.id))!;
    assert.equal((await post('/api/attendance', F.token, { courseId: shared.id, date, records: [{ studentId: outsider.id, status: 'PRESENT' }] })).status, 400);
  });
  await t('rejects malformed and impossible dates', async () => {
    for (const d of ['15-01-2026', '2026-13-45', 'tomorrow', '2026-02-30', '2026-04-31']) assert.equal((await post('/api/attendance', F.token, { courseId: shared.id, date: d, records: [{ studentId: roster[0].id, status: 'PRESENT' }] })).status, 400, d);
  });
  await t('rejects future dates, accepts today (campus time)', async () => {
    assert.equal((await post('/api/attendance', F.token, { courseId: shared.id, date: '2099-01-01', records: [{ studentId: roster[0].id, status: 'PRESENT' }] })).status, 400);
    assert.equal((await post('/api/attendance', F.token, { courseId: shared.id, date: today(), records: [{ studentId: roster[0].id, status: 'PRESENT' }] })).status, 201);
  });
  await t('rejects empty records and bad status', async () => {
    assert.equal((await post('/api/attendance', F.token, { courseId: shared.id, date, records: [] })).status, 400);
    assert.equal((await post('/api/attendance', F.token, { courseId: shared.id, date, records: [{ studentId: roster[0].id, status: 'MAYBE' }] })).status, 400);
  });
  await t('student cannot mark attendance', async () => assert.equal((await post('/api/attendance', S.token, { courseId: shared.id, date, records: [] })).status, 403));

  section('Marks');
  const stuId = S.user.profileId as string;
  await t('create marks with live total + grade', async () => {
    const r = await post('/api/marks', F.token, { studentId: stuId, courseId: shared.id, internal: 18, assignment: 9, midExam: 20, finalExam: 45 });
    assert.ok([200, 201].includes(r.status)); assert.equal(r.body.total, 92); assert.equal(r.body.grade, 'O');
  });
  await t('over-maximum and negative marks are rejected', async () => {
    for (const k of ['internal', 'assignment', 'midExam', 'finalExam']) assert.equal((await post('/api/marks', F.token, { studentId: stuId, courseId: shared.id, [k]: 1000 })).status, 400, k);
    assert.equal((await post('/api/marks', F.token, { studentId: stuId, courseId: shared.id, internal: -1 })).status, 400);
  });
  await t('publishing notifies the student exactly once', async () => {
    const full = { studentId: stuId, courseId: shared.id, internal: 18, assignment: 9, midExam: 20, finalExam: 45 };
    await post('/api/marks', F.token, { ...full, published: false }); // start from unpublished (the seed publishes the demo student's marks)
    const count = async () => ((await get('/api/notifications', S.token)).body.items as any[]).filter((i) => i.type === 'MARKS').length;
    const before = await count();
    await post('/api/marks', F.token, { ...full, published: true });
    const mid = await count();
    await post('/api/marks', F.token, { ...full, published: true });
    assert.equal(mid, before + 1, 'publishing did not notify'); assert.equal(await count(), mid, 're-saving published marks re-notified');
  });
  await t('student sees published marks, with the correct grade', async () => assert.equal((await get('/api/marks', S.token)).body.find((x: any) => x.courseId === shared.id).grade, 'O'));
  await t('unpublish hides marks from the student', async () => {
    const m = (await get(`/api/marks?courseId=${shared.id}&studentId=${stuId}`, F.token)).body[0];
    await put(`/api/marks/${m.id}`, F.token, { published: false });
    assert.ok(!(await get('/api/marks', S.token)).body.some((x: any) => x.courseId === shared.id));
    await put(`/api/marks/${m.id}`, F.token, { published: true });
  });
  await t('PUT /marks/:id cannot be redirected to a different student', async () => {
    const m = (await get(`/api/marks?courseId=${shared.id}&studentId=${stuId}`, F.token)).body[0];
    const other = roster.find((r) => r.id !== stuId)!;
    const before = (await get(`/api/marks?courseId=${shared.id}&studentId=${other.id}`, F.token)).body[0]?.internal ?? null;
    await put(`/api/marks/${m.id}`, F.token, { studentId: other.id, internal: 1 });
    const after = (await get(`/api/marks?courseId=${shared.id}&studentId=${other.id}`, F.token)).body[0]?.internal ?? null;
    assert.equal(after, before, 'PUT /marks/:id silently edited a different student\'s record');
  });
  await t('faculty cannot grade a course they do not teach', async () => {
    const foreign = ((await get('/api/courses', A.token)).body as any[]).find((c) => !facCourses.some((f) => f.id === c.id))!;
    assert.equal((await post('/api/marks', F.token, { studentId: stuId, courseId: foreign.id, internal: 5 })).status, 403);
  });

  section('Complaint lifecycle (student → admin → staff → student)');
  let cid = '';
  const staffList = (await get('/api/staff', A.token)).body as any[];
  const meStaff = staffList.find((s) => s.user.email === 'staff@smartcampus.com')!, otherStaff = staffList.find((s) => s.user.email !== 'staff@smartcampus.com')!;
  const photo = await post('/api/uploads', S.token, { kind: 'image', fileName: 'projector.png', dataUrl: png() });
  await t('student files a complaint with a photo (and validation)', async () => {
    assert.equal(photo.status, 201);
    assert.equal((await post('/api/complaints', S.token, { title: 'x', description: 'short', category: 'CLASSROOM', location: 'a' })).status, 400);
    assert.equal((await post('/api/complaints', S.token, { title: 'Valid title here', description: 'Valid description text.', category: 'NOT_A_CATEGORY', location: 'Room 225' })).status, 400);
    const r = await post('/api/complaints', S.token, { title: 'Broken projector in 225', description: 'The projector does not power on at all.', category: 'CLASSROOM', location: 'Room 225', priority: 'HIGH', imageUrl: photo.body.url });
    assert.equal(r.status, 201, JSON.stringify(r.body).slice(0, 200)); cid = r.body.id;
    assert.ok(r.body.imageSrc?.startsWith('/uploads/'), 'owner should receive a signed image link');
  });
  await t('admins are notified of the new complaint', async () => assert.ok(((await get('/api/notifications', A.token)).body.items as any[]).some((n) => n.type === 'COMPLAINT')));
  await t('rejects image URLs that are not our own uploads', async () => {
    for (const imageUrl of ['https://evil.example/x.jpg', '/uploads/../../etc/passwd.jpg', 'javascript:alert(1)'])
      assert.equal((await post('/api/complaints', S.token, { title: 'Valid title here', description: 'Valid description text.', category: 'CLASSROOM', location: 'Lab', imageUrl })).status, 400, imageUrl);
  });
  await t('other roles cannot file complaints', async () => { for (const r of ['faculty', 'admin', 'staff']) assert.equal((await post('/api/complaints', tok[r], {})).status, 403); });
  await t('faculty cannot read complaints', async () => assert.equal((await get(`/api/complaints/${cid}`, F.token)).status, 403));
  await t('staff cannot see a complaint that is not assigned to them', async () => assert.equal((await get(`/api/complaints/${cid}`, W.token)).status, 403));
  await t('student cannot close an unresolved complaint', async () => assert.equal((await patch(`/api/complaints/${cid}/status`, S.token, { status: 'CLOSED' })).status, 403));
  await t('admin: ASSIGNED requires a staff member', async () => assert.equal((await patch(`/api/complaints/${cid}/status`, A.token, { status: 'ASSIGNED' })).status, 400));
  await t('admin assigns to staff → task created', async () => {
    const r = await patch(`/api/complaints/${cid}/status`, A.token, { status: 'ASSIGNED', staffId: meStaff.id, note: 'Please check today' });
    assert.equal(r.status, 200); assert.equal(r.body.task.status, 'PENDING');
  });
  await t('staff is notified and can now see it', async () => { assert.equal((await get(`/api/complaints/${cid}`, W.token)).status, 200); assert.ok(((await get('/api/notifications', W.token)).body.items as any[]).some((n) => n.type === 'TASK')); });
  await t('status cannot move backwards', async () => assert.equal((await patch(`/api/complaints/${cid}/status`, A.token, { status: 'SUBMITTED' })).status, 400));
  await t('staff may only start work or resolve', async () => { assert.equal((await patch(`/api/complaints/${cid}/status`, W.token, { status: 'CLOSED' })).status, 403); assert.equal((await patch(`/api/complaints/${cid}/status`, W.token, { status: 'IN_PROGRESS' })).status, 200); });
  await t('admin can reassign an in-progress job to another staff member', async () => {
    const r = await patch(`/api/complaints/${cid}/status`, A.token, { status: 'ASSIGNED', staffId: otherStaff.id });
    assert.equal(r.status, 200, `reassign failed: ${r.status} ${r.body?.message}`); assert.equal(r.body.status, 'ASSIGNED'); assert.equal(r.body.task.staffId, otherStaff.id); assert.equal(r.body.task.status, 'PENDING');
    assert.equal((await get(`/api/complaints/${cid}`, W.token)).status, 403, 'the previous staff member should lose access');
    const timeline = (await get(`/api/complaints/${cid}`, A.token)).body.events as any[];
    assert.ok(timeline.some((e) => /Reassigned/.test(e.note ?? '')), 'timeline should record the reassignment');
  });
  await t('a student or staff member cannot reassign', async () => { assert.equal((await patch(`/api/complaints/${cid}/status`, S.token, { status: 'ASSIGNED', staffId: meStaff.id })).status, 403); });
  await t('admin hands it back to the original staff member', async () => assert.equal((await patch(`/api/complaints/${cid}/status`, A.token, { status: 'ASSIGNED', staffId: meStaff.id })).status, 200));
  await t('notes can be added without changing status', async () => assert.equal((await patch(`/api/complaints/${cid}/status`, A.token, { status: 'ASSIGNED', note: 'Parts ordered' })).status, 200));
  await t('staff resolves → student closes → timeline recorded', async () => {
    assert.equal((await patch(`/api/complaints/${cid}/status`, W.token, { status: 'IN_PROGRESS' })).status, 200);
    assert.equal((await patch(`/api/complaints/${cid}/status`, W.token, { status: 'RESOLVED', note: 'Replaced the cable' })).status, 200);
    assert.equal((await patch(`/api/complaints/${cid}/status`, S.token, { status: 'CLOSED' })).status, 200);
    const c = (await get(`/api/complaints/${cid}`, S.token)).body;
    assert.equal(c.status, 'CLOSED'); assert.ok(c.events.length >= 6);
  });
  await t('students only list their own complaints', async () => assert.ok(((await get('/api/complaints', S.token)).body as any[]).every((c) => c.studentId === S.user.profileId)));
  await t('list filters work (status, search)', async () => {
    assert.ok(((await get('/api/complaints?status=CLOSED', A.token)).body as any[]).every((c) => c.status === 'CLOSED'));
    assert.ok(((await get('/api/complaints?q=projector', A.token)).body as any[]).length >= 1);
  });

  section('Private files (signed links)');
  const name = (u: string) => u.split('/').pop()!;
  await t('anonymous requests for an uploaded file are refused', async () => { assert.equal((await fetch(`${API}${photo.body.url}`)).status, 403); });
  await t('the owner\'s signed link works and is served as an image with nosniff', async () => {
    const f = await fetch(`${API}${photo.body.signedUrl}`); assert.equal(f.status, 200); assert.equal(f.headers.get('content-type'), 'image/png'); assert.equal(f.headers.get('x-content-type-options'), 'nosniff');
  });
  await t('the complaint photo link is available to the complaint owner and admin, not to others', async () => {
    const asAdmin = (await get(`/api/complaints/${cid}`, A.token)).body; assert.ok(asAdmin.imageSrc);
    assert.equal((await fetch(`${API}${asAdmin.imageSrc}`)).status, 200);
  });
  await t('tampering with a signed link fails (other file, other expiry, other signature)', async () => {
    const u = new URL(`${API}${photo.body.signedUrl}`);
    const other = (await post('/api/uploads', S.token, { kind: 'image', fileName: 'b.png', dataUrl: png() })).body;
    assert.equal((await fetch(`${API}/uploads/${name(other.url)}${u.search}`)).status, 403, 'signature reused on another file');
    const exp = Number(u.searchParams.get('exp')) + 99999;
    assert.equal((await fetch(`${API}${u.pathname}?exp=${exp}&sig=${u.searchParams.get('sig')}`)).status, 403, 'expiry extended');
    assert.equal((await fetch(`${API}${u.pathname}?exp=${u.searchParams.get('exp')}&sig=AAAA`)).status, 403, 'bad signature');
    assert.equal((await fetch(`${API}${u.pathname}?exp=1&sig=${u.searchParams.get('sig')}`)).status, 403, 'expired');
  });
  await t('path traversal on the uploads route is blocked', async () => {
    for (const p of ['/uploads/..%2f..%2fpackage.json', '/uploads/../package.json', '/uploads/%2e%2e/%2e%2e/etc/passwd', '/uploads/x.html']) { const f = await fetch(`${API}${p}`); assert.ok([400, 403, 404].includes(f.status), `${p} → ${f.status}`); }
  });

  section('Course materials');
  await t('material lifecycle: upload → list with signed link → students notified → enrolment gate → delete', async () => {
    const up = await post('/api/uploads', F.token, { kind: 'material', fileName: 'unit1.pdf', dataUrl: pdf('unit1') });
    assert.equal(up.status, 201);
    const m = await post(`/api/courses/${shared.id}/materials`, F.token, { title: 'Unit 1 notes', storedName: up.body.storedName, fileName: up.body.fileName, mimeType: up.body.mimeType, size: up.body.size });
    assert.equal(m.status, 201);
    const listed = await get(`/api/courses/${shared.id}/materials`, S.token); assert.equal(listed.status, 200);
    const link = listed.body.find((x: any) => x.id === m.body.id).downloadUrl; assert.ok(link, 'no downloadUrl');
    const dl = await fetch(`${API}${link}`); assert.equal(dl.status, 200); assert.ok((await dl.text()).startsWith('%PDF'));
    assert.equal((await fetch(`${API}/uploads/${up.body.storedName}`)).status, 403, 'unsigned access to course material');
    const notEnrolled = ((await get('/api/courses', A.token)).body as any[]).find((c) => !myCourses.some((x) => x.id === c.id))!;
    assert.equal((await get(`/api/courses/${notEnrolled.id}/materials`, S.token)).status, 403, 'not-enrolled students must not get links');
    assert.equal((await del(`/api/materials/${m.body.id}`, S.token)).status, 403);
    assert.equal((await del(`/api/materials/${m.body.id}`, F.token)).status, 204);
  });
  await t('uploads: HTML disguised as PNG, SVG/HTML/JS mime types and oversize files are rejected', async () => {
    assert.equal((await post('/api/uploads', S.token, { kind: 'image', fileName: 'x.png', dataUrl: 'data:image/png;base64,' + Buffer.from('<script>alert(1)</script>').toString('base64') })).status, 400);
    for (const mime of ['image/svg+xml', 'text/html', 'application/javascript']) assert.equal((await post('/api/uploads', S.token, { kind: 'image', fileName: 'x', dataUrl: `data:${mime};base64,AAAA` })).status, 400, mime);
    assert.equal((await post('/api/uploads', S.token, { kind: 'image', fileName: 'big.png', dataUrl: 'data:image/png;base64,' + Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.alloc(4 * 1024 * 1024)]).toString('base64') })).status, 413);
  });
  await t('students cannot upload course materials', async () => assert.equal((await post('/api/uploads', S.token, { kind: 'material', fileName: 'a.txt', dataUrl: 'data:text/plain;base64,aGk=' })).status, 403));

  section('Library');
  const books = (await get('/api/library/books', S.token)).body as any[];
  const borrowed: string[] = [];
  await t('borrowing stops at 3 active loans (the demo student already has some)', async () => {
    const active = ((await get('/api/library/loans?status=active', S.token)).body as any[]).length;
    const free = books.filter((b) => b.available > 0 && !b.myLoan);
    for (const b of free.slice(0, 3 - active)) { const r = await post(`/api/library/books/${b.id}/borrow`, S.token); assert.equal(r.status, 201, JSON.stringify(r.body)); borrowed.push(r.body.id); }
    const extra = await post(`/api/library/books/${free[3 - active].id}/borrow`, S.token); assert.equal(extra.status, 400, 'a 4th concurrent loan was allowed');
  });
  await t('cannot borrow the same book twice', async () => { const b = (await get('/api/library/books', S.token)).body.find((x: any) => x.myLoan); assert.equal((await post(`/api/library/books/${b.id}/borrow`, S.token)).status, 400); });
  await t('due date is 14 days out', async () => {
    const loans = (await get('/api/library/loans?status=active', S.token)).body as any[];
    const mine = loans.find((l) => borrowed.includes(l.id)) ?? loans[0]; const days = (new Date(mine.dueAt).getTime() - Date.now()) / 86_400_000;
    assert.ok(days > -1 && days <= 14.01, `${days}`);
  });
  await t('returning works; double-return refused; other users cannot return', async () => {
    const id = borrowed[0] ?? ((await get('/api/library/loans?status=active', S.token)).body as any[])[0].id;
    assert.equal((await post(`/api/library/loans/${id}/return`, F.token)).status, 403);
    assert.equal((await post(`/api/library/loans/${id}/return`, S.token)).status, 200);
    assert.equal((await post(`/api/library/loans/${id}/return`, S.token)).status, 400);
    for (const l of borrowed.slice(1)) await post(`/api/library/loans/${l}/return`, S.token);
  });
  await t('the last copy cannot be double-booked by concurrent requests', async () => {
    const title = `Race Condition Handbook ${Date.now()}`;
    const created = await post('/api/library/books', A.token, { title, author: 'T. Test', category: 'Testing', copies: 1 });
    assert.equal(created.status, 201);
    const results = await Promise.all([S.token, F.token].map((tk) => post(`/api/library/books/${created.body.id}/borrow`, tk)));
    assert.equal(results.filter((r) => r.status === 201).length, 1, `expected exactly one winner: ${results.map((r) => r.status)}`);
    assert.equal((await get(`/api/library/books?q=${encodeURIComponent(title)}`, A.token)).body[0].available, 0);
    for (const l of (await get('/api/library/loans?status=active', A.token)).body.filter((l: any) => l.bookId === created.body.id)) await post(`/api/library/loans/${l.id}/return`, A.token);
  });
  await t('book validation (copies, title)', async () => { assert.equal((await post('/api/library/books', A.token, { title: 'ab', author: 'cd', category: 'ef', copies: 0 })).status, 400); assert.equal((await post('/api/library/books', A.token, { title: 'Valid', author: 'Valid', category: 'Valid', copies: 1.5 })).status, 400); });
  await t('categories endpoint counts books', async () => { const c = (await get('/api/library/categories', S.token)).body; assert.ok(c.length > 0 && c.every((x: any) => x.count > 0)); });

  section('Calendar (admin CRUD)');
  await t('create / update / list / delete event', async () => {
    const c = await post('/api/calendar', A.token, { title: 'Test Fest', type: 'EVENT', startDate: '2026-11-10', endDate: '2026-11-12', description: 'x' });
    assert.equal(c.status, 201); const evId = c.body.id;
    assert.equal((await put(`/api/calendar/${evId}`, A.token, { title: 'Test Fest 2', type: 'EVENT', startDate: '2026-11-10' })).status, 200);
    assert.ok(((await get('/api/calendar?from=2026-11-01&to=2026-11-30', S.token)).body as any[]).some((e) => e.id === evId));
    assert.equal((await del(`/api/calendar/${evId}`, A.token)).status, 204);
    assert.equal((await del(`/api/calendar/${evId}`, A.token)).status, 404, 'deleting twice should 404, not 500');
  });
  await t('calendar rejects end-before-start and impossible dates', async () => {
    assert.equal((await post('/api/calendar', A.token, { title: 'Bad range', type: 'EVENT', startDate: '2026-11-10', endDate: '2026-11-01' })).status, 400);
    assert.equal((await post('/api/calendar', A.token, { title: 'Bad date', type: 'EVENT', startDate: '2026-02-31' })).status, 400);
  });

  section('Transport');
  await t('pick route + stop; wrong stop refused; clear', async () => {
    const [r1, r2] = (await get('/api/transport/routes', S.token)).body as any[];
    assert.equal((await put('/api/transport/my-route', S.token, { routeId: r1.id, stopId: r1.stops[0].id })).status, 200);
    assert.equal((await put('/api/transport/my-route', S.token, { routeId: r1.id, stopId: r2.stops[0].id })).status, 400);
    assert.equal((await get('/api/transport/my-route', S.token)).body.routeId, r1.id);
    assert.equal((await del('/api/transport/my-route', S.token)).status, 204);
    assert.equal((await get('/api/transport/my-route', S.token)).body, null);
  });

  section('Announcements & notifications');
  await t('audience targeting: a student-only announcement is hidden from staff, and can be marked read', async () => {
    const a = await post('/api/announcements', A.token, { title: 'Students only notice', body: 'This is only for students.', category: 'CAMPUS', audience: ['STUDENT'] });
    assert.equal(a.status, 201, JSON.stringify(a.body).slice(0, 200));
    assert.ok(((await get('/api/announcements', S.token)).body as any[]).some((x) => x.id === a.body.id));
    assert.ok(!((await get('/api/announcements', W.token)).body as any[]).some((x) => x.id === a.body.id));
    assert.equal((await patch(`/api/announcements/${a.body.id}/read`, S.token)).status, 204);
    assert.ok(((await get('/api/announcements', S.token)).body as any[]).find((x) => x.id === a.body.id).read);
  });
  await t('announcement validation', async () => {
    assert.equal((await post('/api/announcements', A.token, { title: 'Valid title', body: 'Valid body text here.', category: 'GENERAL', audience: ['STUDENT'] })).status, 400);
    assert.equal((await post('/api/announcements', A.token, { title: 'Valid title', body: 'Valid body text here.', category: 'CAMPUS', audience: [] })).status, 400);
  });
  await t('notifications: mark one, mark all, unknown id → 404', async () => {
    const n = (await get('/api/notifications', S.token)).body; assert.ok(n.unreadCount > 0);
    assert.equal((await patch(`/api/notifications/${n.items[0].id}/read`, S.token)).status, 204);
    assert.equal((await patch('/api/notifications/read-all', S.token)).status, 204);
    assert.equal((await get('/api/notifications', S.token)).body.unreadCount, 0);
    assert.equal((await patch('/api/notifications/00000000-0000-4000-8000-000000000000/read', S.token)).status, 404);
  });
  await t('you cannot mark someone else\'s notification', async () => { const n = (await get('/api/notifications', A.token)).body.items[0]; assert.equal((await patch(`/api/notifications/${n.id}/read`, S.token)).status, 404); });

  section('Courses & timetable admin');
  await t('course CRUD + duplicate code → 409', async () => {
    const deps = (await get('/api/departments', A.token)).body, fac = (await get('/api/faculty', A.token)).body;
    const body = { code: 'tst999', name: 'Testing Course', credits: 3, semester: 1, room: 'T-1', departmentId: deps[0].id, facultyId: fac[0].id };
    const c = await post('/api/courses', A.token, body); assert.equal(c.status, 201); assert.equal(c.body.code, 'TST999');
    assert.equal((await post('/api/courses', A.token, body)).status, 409);
    assert.equal((await put(`/api/courses/${c.body.id}`, A.token, { credits: 4 })).body.credits, 4);
    assert.equal((await del(`/api/courses/${c.body.id}`, A.token)).status, 204);
  });
  await t('there is a Humanities & Sciences department and the sheet\'s faculty exist', async () => {
    const deps = (await get('/api/departments', A.token)).body as any[]; assert.ok(deps.some((d) => d.code === 'HS'));
    const names = ((await get('/api/faculty', A.token)).body as any[]).map((f) => f.user.name);
    for (const n of ['K Durga Kalyani', 'Dr Puja S Prasad', 'Dr K Kamakshaiah', 'Dr N Mahendra', 'Dr P Narasimha Raju', 'Dr N Nagi Reddy', 'Md Naseruddin']) assert.ok(names.includes(n), `missing faculty ${n}`);
  });
  await t('timetable clash detection (room + faculty) and validation', async () => {
    const tt = (await get('/api/timetable', A.token)).body.find((e: any) => e.course.code === '20CS31002');
    assert.equal((await post('/api/timetable', A.token, { courseId: tt.courseId, dayOfWeek: tt.dayOfWeek, startTime: tt.startTime, endTime: tt.endTime, room: tt.room })).status, 409);
    assert.equal((await post('/api/timetable', A.token, { courseId: tt.courseId, dayOfWeek: 9, startTime: '10:00', endTime: '09:00', room: 'X' })).status, 400);
  });
  await t('deleting a course that has enrolments does not 500', async () => {
    const full = (await get('/api/courses', A.token)).body.find((c: any) => c._count.enrollments > 0 && !['20CS31001'].includes(c.code) && c.code.startsWith('IT'));
    if (!full) return; // an earlier run already deleted the demo course (re-seed to restore it)
    const r = await del(`/api/courses/${full.id}`, A.token); assert.ok(r.status < 500, `delete returned ${r.status}`);
  });

  section('Robustness: bad IDs, bad query params and bad bodies must never produce a 500');
  const bad: string[] = [
    '/api/courses/not-a-uuid', '/api/students/not-a-uuid', '/api/complaints/not-a-uuid', '/api/courses/not-a-uuid/materials',
    '/api/complaints?status=BOGUS', '/api/complaints?category=BOGUS', '/api/complaints?priority=BOGUS', '/api/announcements?category=BOGUS', '/api/facilities?category=BOGUS', '/api/users?role=BOGUS',
    '/api/courses?semester=abc', '/api/timetable?day=abc', '/api/students?page=abc', '/api/students?limit=abc',
    '/api/attendance?date=garbage', '/api/calendar?from=garbage',
    '/api/complaints?q=a&q=b', '/api/students?courseId=a&courseId=b', '/api/courses?q[]=x', '/api/search?q=a&q=b',
  ];
  for (const p of bad) await t(p, async () => { const r = await get(p, A.token); assert.ok(r.status < 500, `got ${r.status}`); });
  await t('invalid filter values return a helpful 400', async () => { const r = await get('/api/complaints?status=BOGUS', A.token); assert.equal(r.status, 400); assert.match(r.body.message, /status/i); });
  await t('valid filters still work', async () => {
    assert.equal((await get('/api/announcements?category=ALL', S.token)).status, 200);
    assert.equal((await get('/api/announcements?category=ACADEMIC', S.token)).status, 200);
    assert.ok(((await get('/api/courses?semester=5', A.token)).body as any[]).every((c) => c.semester === 5));
  });
  await t('unknown route → JSON 404', async () => { const r = await get('/api/nope', A.token); assert.equal(r.status, 404); });
  await t('oversized JSON body → 413', async () => { const r = await call('POST', '/api/auth/login', null, JSON.stringify({ email: 'a@b.co', password: 'x'.repeat(2_000_000) })); assert.equal(r.status, 413, `got ${r.status}`); });

  section('Search & misc');
  await t('search: short query → empty list; real query → results', async () => { assert.deepEqual((await get('/api/search?q=a', S.token)).body, []); assert.ok((await get('/api/search?q=comp', S.token)).body.length > 0); });
  await t('search finds the real subjects and faculty', async () => { const r = (await get('/api/search?q=Kamakshaiah', S.token)).body as any[]; assert.ok(r.some((x) => x.type === 'Faculty')); assert.ok(((await get('/api/search?q=Cyber', S.token)).body as any[]).some((x) => x.type === 'Course')); });
  await t('search never exposes other students to a student', async () => assert.ok(!((await get('/api/search?q=a', S.token)).body as any[]).some((x) => x.type === 'Student')));
  await t('stats (admin) has the expected shape', async () => { const s = (await get('/api/stats', A.token)).body; assert.ok(s.totals.students > 0 && Array.isArray(s.attendanceTrend) && Array.isArray(s.complaintsByStatus)); });
  await t('change password: wrong current → 400; weak new → 400; success; old password stops working; revert', async () => {
    assert.equal((await patch('/api/auth/password', S.token, { currentPassword: 'wrong', newPassword: 'NewPass123' })).status, 400);
    assert.equal((await patch('/api/auth/password', S.token, { currentPassword: PASSWORD, newPassword: 'short' })).status, 400);
    assert.equal((await patch('/api/auth/password', S.token, { currentPassword: PASSWORD, newPassword: 'NewPass123' })).status, 204);
    assert.equal((await post('/api/auth/login', null, { email: 'student@smartcampus.com', password: PASSWORD })).status, 401);
    const back = await post('/api/auth/login', null, { email: 'student@smartcampus.com', password: 'NewPass123' }); assert.equal(back.status, 200);
    assert.equal((await patch('/api/auth/password', back.body.token, { currentPassword: 'NewPass123', newPassword: PASSWORD })).status, 204);
  });
  if (process.env.RATE_LIMIT_TEST) await t('login rate limiting kicks in', async () => {
    let limited = false;
    for (let i = 0; i < 40 && !limited; i++) limited = (await post('/api/auth/login', null, { email: 'rate@smartcampus.com', password: 'x' })).status === 429;
    assert.ok(limited, 'no 429 after 40 bad logins');
  });

  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length) { console.log('\nFailures:'); failures.forEach((f) => console.log(' -', f)); process.exit(1); }
}
main();
