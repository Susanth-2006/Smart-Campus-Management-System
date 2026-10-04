import bcrypt from 'bcrypt';
import { AttendanceStatus, ComplaintCategory, ComplaintStatus, Priority, PrismaClient, Role, TaskStatus } from '@prisma/client';
import { computeGrade, computeTotal, MAX_MARKS } from '../src/utils/grading';
import { H_COURSES, H_FACULTY, H_SECTION, H_SLOTS, slotTimes } from './hSection';

const prisma = new PrismaClient();

// Deterministic PRNG so every seed run produces the same campus
let s = 20250101;
const rand = () => {
  s |= 0; s = (s + 0x6d2b79f5) | 0;
  let t = Math.imul(s ^ (s >>> 15), 1 | s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick = <T,>(a: T[]) => a[Math.floor(rand() * a.length)];
const between = (lo: number, hi: number) => lo + rand() * (hi - lo);
const pad = (n: number, w = 3) => String(n).padStart(w, '0');

const FIRST = ['Aarav', 'Ananya', 'Rohan', 'Meera', 'Karthik', 'Divya', 'Arjun', 'Sneha', 'Vikram', 'Lakshmi', 'Rahul', 'Pooja', 'Aditya', 'Nisha', 'Siddharth', 'Kavya', 'Manoj', 'Ishita', 'Harsha', 'Tanvi', 'Naveen', 'Riya', 'Varun', 'Swathi', 'Imran', 'Fatima', 'Deepak', 'Anjali', 'Rakesh', 'Shreya'];
const LAST = ['Reddy', 'Sharma', 'Iyer', 'Nair', 'Gupta', 'Rao', 'Patel', 'Menon', 'Singh', 'Das', 'Khan', 'Verma', 'Naidu', 'Joshi', 'Kulkarni', 'Pillai', 'Bose', 'Chowdhury', 'Shetty', 'Mehta'];
const fullName = () => `${pick(FIRST)} ${pick(LAST)}`;

const DEPTS = [
  { code: 'CSE', name: 'Computer Science', room: 'C' },
  { code: 'IT', name: 'Information Technology', room: 'B' },
  { code: 'ECE', name: 'Electronics', room: 'E' },
  { code: 'ME', name: 'Mechanical', room: 'M' },
  { code: 'CE', name: 'Civil', room: 'V' },
  { code: 'EEE', name: 'Electrical', room: 'L' },
  { code: 'HS', name: 'Humanities & Sciences', room: 'H' }, // English, Mathematics, Logical Reasoning … (no students of its own)
];
const STUDENT_DEPTS = 6; // students are spread over the first six departments only

// CSE is not listed here: its courses, faculty and weekly timetable are the real H-Section data in ./hSection.ts
const COURSES: Record<string, [string, string][]> = {
  IT: [['IT301', 'Web Technologies'], ['IT302', 'Information Security'], ['IT303', 'Cloud Computing']],
  ECE: [['EC301', 'Digital Signal Processing'], ['EC302', 'VLSI Design'], ['EC303', 'Communication Systems']],
  ME: [['ME301', 'Thermodynamics'], ['ME302', 'Fluid Mechanics'], ['ME303', 'Machine Design']],
  CE: [['CE301', 'Structural Analysis'], ['CE302', 'Geotechnical Engineering'], ['CE303', 'Surveying']],
  EEE: [['EE301', 'Power Systems'], ['EE302', 'Control Systems'], ['EE303', 'Electrical Machines']],
};

const BANDS = [['09:00', '10:00'], ['11:00', '12:00'], ['14:00', '15:00']];
// Clash-free weekly slots for the i-th course of a department
const slotsFor = (i: number): [number, number][] =>
  i < 5 ? [[(i % 5) + 1, 0], [((i + 2) % 5) + 1, 1]] : [[1, 2], [4, 2]];

const day = (offset = 0) => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + offset);
  return d;
};
const ago = (hours: number) => new Date(Date.now() - hours * 3600_000);

async function main() {
  console.log('Clearing existing data…');
  for (const m of ['material', 'bookLoan', 'book', 'transportPass', 'routeStop', 'transportRoute', 'facility', 'calendarEvent', 'notification', 'announcementRead', 'announcement', 'maintenanceTask', 'complaintEvent', 'complaint', 'timetable', 'marks', 'attendance', 'enrollment', 'course', 'student', 'faculty', 'campusStaff', 'admin', 'user', 'department'] as const) {
    await (prisma[m] as any).deleteMany();
  }

  const hash = await bcrypt.hash('Password@123', 10);
  const mkUser = (email: string, name: string, role: Role) => prisma.user.create({ data: { email, name, role, passwordHash: hash, phone: `+91 9${pad(Math.floor(rand() * 1e9), 9)}` } });

  const depts = await Promise.all(DEPTS.map((d) => prisma.department.create({ data: { code: d.code, name: d.name } })));

  // ---- Faculty. Real names from the H-Section sheet come first in their department; the rest of each department is filled to 3 with demo names.
  // The first CSE faculty member (K Durga Kalyani) is the demo faculty login.
  const facultyByDept: Record<string, { id: string; userId: string }[]> = {};
  const facultyByName = new Map<string, { id: string; userId: string }>();
  let fCount = 0;
  for (const d of depts) {
    facultyByDept[d.code] = [];
    const real = H_FACULTY.filter((f) => f.dept === d.code).map((f) => f.name);
    const total = d.code === 'HS' ? real.length : Math.max(3, real.length);
    for (let i = 0; i < total; i++) {
      const demo = d.code === 'CSE' && i === 0;
      const name = real[i] ?? `Dr. ${fullName()}`;
      const user = await mkUser(demo ? 'faculty@smartcampus.com' : `faculty${++fCount}@smartcampus.com`, name, 'FACULTY');
      const f = await prisma.faculty.create({ data: { userId: user.id, departmentId: d.id, designation: real[i] ? 'Faculty' : pick(['Professor', 'Associate Professor', 'Assistant Professor']) } });
      facultyByDept[d.code].push({ id: f.id, userId: user.id });
      if (real[i]) facultyByName.set(name, { id: f.id, userId: user.id });
    }
  }
  const deptId = (code: string) => depts.find((d) => d.code === code)!.id;

  // ---- Courses + timetable
  const courses: { id: string; code: string; deptCode: string; name: string; facultyId: string; index: number; graded: boolean }[] = [];

  // CSE · III B.Tech I-Sem · H-Section (the real timetable)
  const hCourseId = new Map<string, string>();
  for (const [i, hc] of H_COURSES.entries()) {
    const fac = facultyByName.get(hc.faculty)!;
    const c = await prisma.course.create({
      data: { code: hc.code, name: hc.name, credits: hc.periods, semester: H_SECTION.semester, room: hc.room, departmentId: deptId(hc.owner), facultyId: fac.id,
        description: hc.kind === 'training' ? 'Scheduled training sessions for the section (see the timetable).' : `${hc.name}. ${hc.periods ? `${hc.periods} periods per week.` : 'No fixed weekly slot.'}` },
    });
    hCourseId.set(hc.key, c.id);
    // `deptCode: 'CSE'` = the cohort that is enrolled, whichever department owns the subject
    courses.push({ id: c.id, code: hc.code, deptCode: 'CSE', name: hc.name, facultyId: fac.id, index: i, graded: hc.periods > 0 });
  }
  await prisma.timetable.createMany({
    data: H_SLOTS.map((x) => {
      const hc = H_COURSES.find((c) => c.key === x.course)!;
      return { courseId: hCourseId.get(x.course)!, dayOfWeek: x.day, ...slotTimes(x), room: hc.room, section: x.batch };
    }),
  });

  for (const [di, d] of depts.entries()) {
    for (const [i, [code, name]] of (COURSES[d.code] ?? []).entries()) {
      const fac = facultyByDept[d.code][[0, 1, 2, 0, 1, 2][i]];
      const room = `${DEPTS[di].room}-${200 + i * 2 + 4}`;
      const c = await prisma.course.create({
        data: { code, name, credits: pick([3, 4, 4]), semester: 5, room, departmentId: d.id, facultyId: fac.id, description: `${name}: concepts, problem solving and applied labs for semester 5.` },
      });
      courses.push({ id: c.id, code, deptCode: d.code, name, facultyId: fac.id, index: i, graded: true });
      await prisma.timetable.createMany({
        data: slotsFor(i).map(([dow, band]) => ({ courseId: c.id, dayOfWeek: dow, startTime: BANDS[band][0], endTime: BANDS[band][1], room })),
      });
    }
  }

  // ---- Admin + staff
  const adminUser = await mkUser('admin@smartcampus.com', 'Meenakshi Raman', 'ADMIN');
  const admin = await prisma.admin.create({ data: { userId: adminUser.id } });
  const staffTypes = ['Electrician', 'Plumber', 'IT Support', 'Housekeeping', 'Maintenance'];
  const staff: { id: string; userId: string }[] = [];
  for (const [i, t] of staffTypes.entries()) {
    const u = await mkUser(i === 0 ? 'staff@smartcampus.com' : `staff${i + 1}@smartcampus.com`, i === 0 ? 'Ramesh Kumar' : fullName(), 'STAFF');
    const st = await prisma.campusStaff.create({ data: { userId: u.id, staffType: t } });
    staff.push({ id: st.id, userId: u.id });
  }

  // ---- Students (9 per dept = 54). Student #0 is the demo user, Susanth.
  const students: { id: string; userId: string; deptCode: string; demo: boolean; batch: string | null }[] = [];
  for (let i = 0; i < 54; i++) {
    const d = depts[i % STUDENT_DEPTS];
    const demo = i === 0;
    const u = await mkUser(demo ? 'student@smartcampus.com' : `student${i}@smartcampus.com`, demo ? 'Susanth Kumar' : fullName(), 'STUDENT');
    // Only the CSE H-Section is split into lab batches (demo student = B-1; the rest alternate)
    const batch = d.code === 'CSE' ? (Math.floor(i / STUDENT_DEPTS) % 2 ? 'B-2' : 'B-1') : null;
    const st = await prisma.student.create({ data: { userId: u.id, rollNo: `${d.code}21${pad(Math.floor(i / 6) + 1)}`, departmentId: d.id, semester: 5, section: d.code === 'CSE' ? H_SECTION.section : i % 2 ? 'B' : 'A', batch } });
    students.push({ id: st.id, userId: u.id, deptCode: d.code, demo, batch });
  }

  // ---- Enrollments, attendance, marks
  const timetable = await prisma.timetable.findMany();
  // A student only attends the sessions of their own lab batch (section "ALL" = the whole class)
  const slotsByCourse = new Map<string, { day: number; section: string }[]>();
  timetable.forEach((t) => slotsByCourse.set(t.courseId, [...(slotsByCourse.get(t.courseId) ?? []), { day: t.dayOfWeek, section: t.section }]));
  const attendsOn = (courseId: string, dayOfWeek: number, batch: string | null) =>
    (slotsByCourse.get(courseId) ?? []).some((x) => x.day === dayOfWeek && (x.section === 'ALL' || x.section === batch));
  const SUSANTH_BASE = [0.92, 0.87, 0.81, 0.9, 0.85, 0.88, 0.94, 0.79, 0.91, 0.86, 0.9];

  for (const st of students) {
    for (const c of courses.filter((c) => c.deptCode === st.deptCode)) {
      await prisma.enrollment.create({ data: { studentId: st.id, courseId: c.id } });
      const base = st.demo ? SUSANTH_BASE[c.index % SUSANTH_BASE.length] : between(0.72, 0.97);

      const rows: { studentId: string; courseId: string; date: Date; status: AttendanceStatus }[] = [];
      for (let off = -35; off <= -1; off++) {
        const date = day(off);
        if (!attendsOn(c.id, date.getUTCDay(), st.batch)) continue;
        const r = rand();
        rows.push({ studentId: st.id, courseId: c.id, date, status: r < base ? 'PRESENT' : r < base + 0.04 ? 'LATE' : 'ABSENT' });
      }
      await prisma.attendance.createMany({ data: rows });

      if (!c.graded) continue; // training / non-credit subjects have attendance but no marks

      const quality = st.demo ? 0.84 : between(0.45, 0.95);
      const part = (max: number) => Math.round(Math.min(max, max * (quality + between(-0.12, 0.1))) * 10) / 10;
      const m = { internal: part(MAX_MARKS.internal), assignment: part(MAX_MARKS.assignment), midExam: part(MAX_MARKS.midExam), finalExam: part(MAX_MARKS.finalExam) };
      const total = computeTotal(m);
      await prisma.marks.create({ data: { studentId: st.id, courseId: c.id, ...m, total, grade: computeGrade(total), published: st.demo || rand() < 0.8 } });
    }
  }

  // ---- Complaints (12) with timelines
  const FLOW: ComplaintStatus[] = ['SUBMITTED', 'UNDER_REVIEW', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
  const TEMPLATES: [string, string, ComplaintCategory, string, Priority][] = [
    ['Projector not working in Room 225', 'The projector in Room 225 shuts off after ten minutes, which disrupts lectures.', 'CLASSROOM', 'CSE Block, Room 225', 'HIGH'],
    ['Wi-Fi very slow in the library', 'Connection drops repeatedly on the second floor reading area.', 'INTERNET', 'Library, Floor 2', 'MEDIUM'],
    ['Water leakage in hostel washroom', 'Tap and pipe leaking near the third-floor washroom.', 'WATER', 'Boys Hostel, Floor 3', 'HIGH'],
    ['Flickering lights in lab', 'Three tube lights flicker constantly in Networks Lab.', 'ELECTRICITY', 'Block B, Networks Lab', 'MEDIUM'],
    ['Broken bench in seminar hall', 'Two benches have broken legs and are unsafe.', 'INFRASTRUCTURE', 'Seminar Hall', 'LOW'],
    ['Bus 7 consistently late', 'The route 7 bus has arrived 20 minutes late all week.', 'TRANSPORT', 'Main Gate', 'MEDIUM'],
    ['Lab computers not booting', 'Five systems in Lab 2 show boot errors.', 'LABORATORY', 'Block A, Lab 2', 'URGENT'],
    ['Library AC not cooling', 'The reading hall AC is running but not cooling.', 'LIBRARY', 'Library, Ground Floor', 'LOW'],
    ['Power socket sparks in room', 'A socket sparks when plugging in a charger.', 'ELECTRICITY', 'Girls Hostel, Room 214', 'URGENT'],
    ['Drinking water cooler empty', 'The cooler near the cafeteria has been dry since Monday.', 'WATER', 'Cafeteria', 'MEDIUM'],
    ['Whiteboard markers unavailable', 'No markers in any classroom of Block D.', 'CLASSROOM', 'Block D', 'LOW'],
    ['Corridor light out', 'Corridor lights on the first floor are not working.', 'ELECTRICITY', 'Block A, Floor 1', 'LOW'],
  ];
  const targetStatus: ComplaintStatus[] = ['IN_PROGRESS', 'RESOLVED', 'ASSIGNED', 'UNDER_REVIEW', 'SUBMITTED', 'CLOSED', 'IN_PROGRESS', 'RESOLVED', 'IN_PROGRESS', 'SUBMITTED', 'CLOSED', 'UNDER_REVIEW'];
  const taskOf: Partial<Record<ComplaintStatus, TaskStatus>> = { ASSIGNED: 'PENDING', IN_PROGRESS: 'IN_PROGRESS', RESOLVED: 'DONE', CLOSED: 'DONE' };
  const NOTES = ['Complaint submitted', 'Reviewed by campus administration', 'Assigned to maintenance team', 'Technician started work on site', 'Issue fixed and verified', 'Closed after student confirmation'];

  for (const [i, t] of TEMPLATES.entries()) {
    const st = i === 0 ? students[0] : students[1 + Math.floor(rand() * 53)];
    const status = targetStatus[i];
    const stage = FLOW.indexOf(status);
    const worker = i === 0 ? staff[0] : pick(staff);
    const start = 24 * (12 - i) + 6;
    const events = FLOW.slice(0, stage + 1).map((fs, k) => ({
      status: fs,
      note: NOTES[k],
      actorId: k === 0 || fs === 'CLOSED' ? st.userId : k <= 2 ? adminUser.id : worker.userId,
      createdAt: ago(start - k * 7),
    }));
    const c = await prisma.complaint.create({
      data: { title: t[0], description: t[1], category: t[2], location: t[3], priority: t[4], status, studentId: st.id, createdAt: ago(start), events: { create: events } },
    });
    if (stage >= 2) await prisma.maintenanceTask.create({ data: { complaintId: c.id, staffId: worker.id, status: taskOf[status]! } });
  }

  // ---- Announcements (8)
  const A: [string, string, 'ACADEMIC' | 'EVENTS' | 'CAMPUS' | 'EMERGENCY', Priority, Role[]][] = [
    ['Mid-semester exam schedule released', 'Mid-semester examinations begin next Monday. Hall tickets are available on the portal.', 'ACADEMIC', 'HIGH', ['STUDENT', 'FACULTY']],
    ['Annual Tech Fest registrations open', 'Registrations for TechNova are open until the end of the month. Form your teams now.', 'EVENTS', 'MEDIUM', ['STUDENT', 'FACULTY']],
    ['Library timing extended during exams', 'The central library will remain open until 10 PM on weekdays during the exam period.', 'CAMPUS', 'LOW', ['STUDENT', 'FACULTY', 'STAFF']],
    ['Power shutdown on Saturday morning', 'Scheduled electrical maintenance will cut power in Blocks A and B from 8 AM to 12 PM.', 'EMERGENCY', 'URGENT', ['STUDENT', 'FACULTY', 'STAFF']],
    ['CSE Department: Guest lecture on Cloud Systems', 'An industry guest lecture takes place this Friday at 3 PM in the main auditorium.', 'EVENTS', 'MEDIUM', ['STUDENT', 'FACULTY']],
    ['Marks entry deadline for internals', 'Faculty must submit internal marks by the end of next week.', 'ACADEMIC', 'HIGH', ['FACULTY']],
    ['Maintenance staff safety briefing', 'All maintenance staff should attend the safety briefing on Wednesday at 9 AM.', 'CAMPUS', 'MEDIUM', ['STAFF']],
    ['Scholarship applications due soon', 'Merit scholarship applications close in ten days. Submit documents at the student services desk.', 'ACADEMIC', 'MEDIUM', ['STUDENT']],
  ];
  const announcements: { id: string }[] = [];
  for (const [i, a] of A.entries()) {
    announcements.push(await prisma.announcement.create({ data: { title: a[0], body: a[1], category: a[2], priority: a[3], audience: a[4], authorId: admin.id, createdAt: ago(6 + i * 20) } }));
  }
  await prisma.announcementRead.create({ data: { announcementId: announcements[2].id, userId: students[0].userId } });


  // ---- Facilities (mapX/mapY are percentages on the campus map)
  const FAC: [string, string, string, string | null, string, string, number | null, number, number][] = [
    ['Block A: Computer Science', 'ACADEMIC', 'Block A', null, 'Lecture halls and faculty offices for Computer Science and IT.', 'Mon-Sat 8:00-18:00', 600, 22, 28],
    ['Block B: Information Technology', 'ACADEMIC', 'Block B', null, 'Classrooms, seminar rooms and the Networks Lab.', 'Mon-Sat 8:00-18:00', 500, 40, 24],
    ['Block C: Core Engineering', 'ACADEMIC', 'Block C', null, 'Electronics, Electrical and Mechanical classrooms.', 'Mon-Sat 8:00-18:00', 700, 58, 30],
    ['Computing Lab 1', 'LAB', 'Block A', 'Ground floor', '60 workstations for programming and software engineering labs.', 'Mon-Fri 9:00-17:00', 60, 20, 38],
    ['Electronics & VLSI Lab', 'LAB', 'Block C', 'First floor', 'Oscilloscopes, signal generators and FPGA boards.', 'Mon-Fri 9:00-17:00', 40, 60, 40],
    ['Central Library', 'LIBRARY', 'Library Building', 'All floors', 'Reading halls, reference section and digital resources.', 'Mon-Sat 8:00-22:00, Sun 10:00-16:00', 300, 40, 50],
    ['Main Auditorium', 'ACADEMIC', 'Auditorium', null, 'Seating for 800, used for guest lectures, convocation and fests.', 'By schedule', 800, 74, 22],
    ['Seminar Hall', 'ACADEMIC', 'Block B', 'Second floor', 'Air-conditioned hall with projector and video conferencing.', 'Mon-Sat 9:00-17:00', 120, 44, 16],
    ['Sports Ground', 'SPORTS', 'Sports Complex', null, 'Cricket and football ground with a 400 m track.', 'Daily 6:00-19:00', null, 82, 62],
    ['Indoor Stadium', 'SPORTS', 'Sports Complex', null, 'Badminton, table tennis, basketball and a gym.', 'Daily 6:00-21:00', 150, 70, 70],
    ['Main Cafeteria', 'FOOD', 'Student Centre', 'Ground floor', 'Breakfast, lunch, snacks and a juice counter.', 'Mon-Sat 7:30-20:00', 400, 52, 60],
    ['Coffee Corner', 'FOOD', 'Library Building', 'Ground floor', 'Coffee, tea and light snacks near the library.', 'Mon-Sat 8:00-20:00', 40, 36, 58],
    ['Boys Hostel', 'HOSTEL', 'Hostel Zone', null, 'Residence for boys with a mess and a common room.', 'Gate closes 22:00', 400, 14, 70],
    ['Girls Hostel', 'HOSTEL', 'Hostel Zone', null, 'Residence for girls with a mess and a common room.', 'Gate closes 21:30', 350, 24, 78],
    ['Administrative Office', 'ADMIN', 'Admin Block', 'Ground floor', 'Admissions, fees, certificates and student services desk.', 'Mon-Fri 9:30-16:30', null, 30, 14],
    ['Health Centre', 'MEDICAL', 'Student Centre', 'First floor', 'First aid, a visiting doctor and an ambulance on call.', 'Mon-Sat 9:00-17:00, emergencies 24x7', null, 62, 52],
    ['Main Gate', 'OTHER', 'Entrance', null, 'Security desk, visitor entry and bus pickup point.', '24x7', null, 50, 90],
  ];
  await prisma.facility.createMany({ data: FAC.map(([name, category, building, floor, description, hours, capacity, mapX, mapY]) => ({ name, category: category as any, building, floor, description, hours, capacity, mapX, mapY })) });

  // ---- Library: 40 books, then a few loans for the demo student
  const BOOKS: [string, string, string][] = [
    ['Introduction to Algorithms', 'Cormen, Leiserson, Rivest, Stein', 'Computer Science'], ['Data Structures and Algorithms in Java', 'Robert Lafore', 'Computer Science'],
    ['Computer Networking: A Top-Down Approach', 'Kurose and Ross', 'Computer Science'], ['Operating System Concepts', 'Silberschatz, Galvin, Gagne', 'Computer Science'],
    ['Database System Concepts', 'Silberschatz, Korth, Sudarshan', 'Computer Science'], ['Software Engineering', 'Ian Sommerville', 'Computer Science'],
    ['Introduction to the Theory of Computation', 'Michael Sipser', 'Computer Science'], ['Clean Code', 'Robert C. Martin', 'Computer Science'],
    ['The Pragmatic Programmer', 'Hunt and Thomas', 'Computer Science'], ['Designing Data-Intensive Applications', 'Martin Kleppmann', 'Computer Science'],
    ['Cryptography and Network Security', 'William Stallings', 'Information Technology'], ['Cloud Computing: Concepts and Design', 'Buyya, Vecchiola', 'Information Technology'],
    ['Web Development with Node and Express', 'Ethan Brown', 'Information Technology'], ['Digital Signal Processing', 'Proakis and Manolakis', 'Electronics'],
    ['CMOS VLSI Design', 'Weste and Harris', 'Electronics'], ['Communication Systems', 'Simon Haykin', 'Electronics'], ['Microelectronic Circuits', 'Sedra and Smith', 'Electronics'],
    ['Engineering Thermodynamics', 'P. K. Nag', 'Mechanical'], ['Fluid Mechanics', 'Frank M. White', 'Mechanical'], ['Design of Machine Elements', 'V. B. Bhandari', 'Mechanical'],
    ['Theory of Machines', 'S. S. Rattan', 'Mechanical'], ['Structural Analysis', 'R. C. Hibbeler', 'Civil'], ['Principles of Geotechnical Engineering', 'Braja M. Das', 'Civil'],
    ['Surveying and Levelling', 'Kanetkar and Kulkarni', 'Civil'], ['Reinforced Concrete Design', 'Pillai and Menon', 'Civil'], ['Power System Analysis', 'Hadi Saadat', 'Electrical'],
    ['Control Systems Engineering', 'Norman S. Nise', 'Electrical'], ['Electric Machinery Fundamentals', 'Stephen Chapman', 'Electrical'], ['Electrical Machines', 'P. S. Bimbhra', 'Electrical'],
    ['Engineering Mathematics', 'B. S. Grewal', 'Mathematics'], ['Linear Algebra and Its Applications', 'Gilbert Strang', 'Mathematics'], ['Probability and Statistics for Engineers', 'Miller and Freund', 'Mathematics'],
    ['Discrete Mathematics', 'Kenneth Rosen', 'Mathematics'], ['Concepts of Physics', 'H. C. Verma', 'Science'], ['Engineering Chemistry', 'Jain and Jain', 'Science'],
    ['Technical Communication', 'Meenakshi Raman', 'Humanities'], ['The Psychology of Money', 'Morgan Housel', 'Humanities'], ['Wings of Fire', 'A. P. J. Abdul Kalam', 'Humanities'],
    ['Atomic Habits', 'James Clear', 'Humanities'], ['Deep Work', 'Cal Newport', 'Humanities'],
  ];
  const books: { id: string }[] = [];
  for (const [i, [title, author, category]] of BOOKS.entries()) {
    const copies = 2 + (i % 4);
    books.push(await prisma.book.create({ data: { title, author, category, isbn: `978-81-${pad(1000 + i * 7, 4)}-${pad(i * 13 % 1000)}-${i % 10}`, copies, available: copies } }));
  }
  const loanFor = async (bookIdx: number, issuedDaysAgo: number, returned: boolean) => {
    const issuedAt = day(-issuedDaysAgo), dueAt = day(-issuedDaysAgo + 14);
    await prisma.bookLoan.create({ data: { bookId: books[bookIdx].id, userId: students[0].userId, issuedAt, dueAt, returnedAt: returned ? day(-issuedDaysAgo + 9) : null } });
    if (!returned) await prisma.book.update({ where: { id: books[bookIdx].id }, data: { available: { decrement: 1 } } });
  };
  await loanFor(0, 6, false);  // due in 8 days
  await loanFor(2, 12, false); // due in 2 days
  await loanFor(7, 30, true);  // returned earlier

  // ---- Transport: 5 routes x 6 stops, demo student rides route 1
  const ROUTES: [string, string, string, string, string][] = [
    ['R1', 'North Corridor', 'TS 09 UA 1201', 'Venkat Reddy', '+91 90000 11201'], ['R2', 'East Loop', 'TS 09 UA 1202', 'Salim Khan', '+91 90000 11202'],
    ['R3', 'South Link', 'TS 09 UA 1203', 'Prakash Nair', '+91 90000 11203'], ['R4', 'West Express', 'TS 09 UA 1204', 'Imran Ali', '+91 90000 11204'],
    ['R5', 'City Centre', 'TS 09 UA 1205', 'Suresh Babu', '+91 90000 11205'],
  ];
  const STOPS = [['Central Station', 'Market Square', 'Green Park', 'Hospital Junction', 'Tech Park Gate', 'College Main Gate'],
    ['East Bus Depot', 'Lake View', 'Old Town', 'Cinema Road', 'Metro Station', 'College Main Gate'],
    ['South Terminal', 'Riverside', 'Temple Street', 'Stadium Cross', 'Flyover Junction', 'College Main Gate'],
    ['West Gate', 'Garden Colony', 'Airport Road', 'Industrial Area', 'Bypass Cross', 'College Main Gate'],
    ['City Centre', 'Town Hall', 'Court Road', 'University Circle', 'Ring Road', 'College Main Gate']];
  let firstStop: { routeId: string; stopId: string } | null = null;
  for (const [ri, [number, name, vehicleNo, driverName, driverPhone]] of ROUTES.entries()) {
    const route = await prisma.transportRoute.create({ data: { number, name, vehicleNo, driverName, driverPhone, capacity: 40 } });
    for (const [si, stopName] of STOPS[ri].entries()) {
      const mins = 6 * 60 + 40 + si * 9; // 06:40 start, 9 minutes between stops
      const stop = await prisma.routeStop.create({ data: { routeId: route.id, name: stopName, order: si + 1, pickupTime: `${pad(Math.floor(mins / 60), 2)}:${pad(mins % 60, 2)}` } });
      if (ri === 0 && si === 2) firstStop = { routeId: route.id, stopId: stop.id };
    }
  }
  if (firstStop) await prisma.transportPass.create({ data: { userId: students[0].userId, ...firstStop } });

  // ---- Academic calendar (dates are relative to today so the demo always looks current)
  const CAL: [string, string, number, number, string][] = [
    ['Semester 5 classes begin', 'CLASS', -60, -60, 'Regular classes start for all departments.'],
    ['Republic Day Holiday', 'HOLIDAY', -45, -45, 'Campus closed.'],
    ['Internal marks submission', 'DEADLINE', 6, 6, 'Faculty must submit internal marks.'],
    ['Mid-semester examinations', 'EXAM', 10, 15, 'Hall tickets are on the portal.'],
    ['Assignment submission deadline', 'DEADLINE', 8, 8, 'Last date to submit semester assignments.'],
    ['TechNova Tech Fest', 'EVENT', 20, 22, 'Hackathon, workshops and a project expo.'],
    ['Guest lecture: Cloud Systems', 'EVENT', 3, 3, 'Main Auditorium, 3 PM.'],
    ['Festival Holiday', 'HOLIDAY', 28, 28, 'Campus closed.'],
    ['Last working day', 'CLASS', 55, 55, 'Final day of instruction.'],
    ['End-semester examinations', 'EXAM', 62, 75, 'Timetable will be announced two weeks before.'],
    ['Semester break', 'HOLIDAY', 76, 90, 'Campus offices open on weekdays only.'],
  ];
  await prisma.calendarEvent.createMany({ data: CAL.map(([title, type, a, b, description]) => ({ title, type: type as any, startDate: day(a), endDate: day(b), description })) });

  // ---- Notifications for demo accounts
  const complaint1 = await prisma.complaint.findFirst({ where: { studentId: students[0].id }, orderBy: { createdAt: 'asc' } });
  const dsCourse = courses[0];
  await prisma.notification.createMany({
    data: [
      { userId: students[0].userId, type: 'ATTENDANCE', title: 'Attendance updated', message: 'Your attendance was updated.', link: '/academics/attendance', createdAt: ago(1) },
      { userId: students[0].userId, type: 'ANNOUNCEMENT', title: 'New announcement', message: 'New announcement from CSE Department.', link: `/campus/announcements/${announcements[4].id}`, createdAt: ago(3) },
      { userId: students[0].userId, type: 'COMPLAINT', title: `Complaint #${complaint1?.ticketNo} update`, message: `Complaint #${complaint1?.ticketNo} is now in progress.`, link: `/campus/complaints/${complaint1?.id}`, createdAt: ago(5) },
      { userId: students[0].userId, type: 'MARKS', title: 'Marks published', message: `Marks for ${dsCourse.name} have been published.`, link: '/academics/marks', read: true, createdAt: ago(40) },
      { userId: facultyByDept.CSE[0].userId, type: 'ANNOUNCEMENT', title: 'New announcement', message: 'Marks entry deadline for internals', link: `/campus/announcements/${announcements[5].id}`, createdAt: ago(2) },
      { userId: adminUser.id, type: 'COMPLAINT', title: 'New complaint', message: 'Wi-Fi very slow in the library', link: '/campus/complaints', createdAt: ago(4) },
      { userId: staff[0].userId, type: 'TASK', title: 'New task assigned', message: 'Projector not working in Room 225', link: '/tasks', createdAt: ago(6) },
    ],
  });

  console.log(`Seeded: ${students.length} students, ${Object.values(facultyByDept).flat().length} faculty, ${staff.length} staff, ${courses.length} courses.`);
  console.log(`Demo student is in ${H_SECTION.programme} ${H_SECTION.department} Section ${H_SECTION.section} (Room ${H_SECTION.room}), using the real timetable.`);
  console.log('Demo logins (password for all: Password@123):');
  console.log('  student@smartcampus.com | faculty@smartcampus.com | admin@smartcampus.com | staff@smartcampus.com');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
