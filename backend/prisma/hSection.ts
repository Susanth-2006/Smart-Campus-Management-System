/**
 * Real class data: III B.Tech, I Semester, H-Section, Dept. of Computer Science & Engineering.
 * Geethanjali College of Engineering & Technology · A.Y. 2026-27 · Version 02 · W.E.F. 06-07-2026 · Room 225
 * Class teacher: Md Naseruddin
 *
 * Transcribed from the department's timetable sheet. Kept free of Prisma imports so the seed AND the tests can both use it.
 * Days: 1 = Monday … 6 = Saturday.
 */

export const H_SECTION = {
  college: 'Geethanjali College of Engineering & Technology',
  department: 'CSE',
  programme: 'III B.Tech',
  semester: 5, // I-semester of the 3rd year
  section: 'H',
  room: '225',
  classTeacher: 'Md Naseruddin',
  academicYear: '2026-27',
  version: '02',
  effectiveFrom: '2026-07-06',
} as const;

/** Period → [start, end]. Lunch is 12:40–13:30 and never has a class. */
export const PERIODS = {
  1: ['09:00', '09:55'],
  2: ['09:55', '10:50'],
  3: ['10:50', '11:45'],
  4: ['11:45', '12:40'],
  5: ['13:30', '14:25'],
  6: ['14:25', '15:20'],
} as const;
export type Period = keyof typeof PERIODS;
export const LUNCH = ['12:40', '13:30'] as const;

export type Kind = 'theory' | 'lab' | 'training' | 'audit';
/** Which academic department owns the course (used for the Course → Department link). */
export type OwnerDept = 'CSE' | 'CE' | 'HS';

export interface HCourse {
  key: string; // short name used on the sheet
  code: string;
  name: string;
  faculty: string; // exactly as printed on the sheet
  periods: number; // "No. of Periods" column (per week)
  kind: Kind;
  owner: OwnerDept;
  room: string;
}

const CLASSROOM = H_SECTION.room;

export const H_COURSES: HCourse[] = [
  { key: 'SE', code: '20CS31001', name: 'Software Engineering', faculty: 'K Durga Kalyani', periods: 3, kind: 'theory', owner: 'CSE', room: CLASSROOM },
  { key: 'CN', code: '20CS31002', name: 'Computer Networks', faculty: 'Dr Puja S Prasad', periods: 3, kind: 'theory', owner: 'CSE', room: CLASSROOM },
  { key: 'AI', code: '20CS31003', name: 'Artificial Intelligence', faculty: 'Dr K Kamakshaiah', periods: 3, kind: 'theory', owner: 'CSE', room: CLASSROOM },
  { key: 'BT', code: '20CE31061', name: 'Building Technology (OE-1)', faculty: 'Dr N Mahendra', periods: 3, kind: 'theory', owner: 'CE', room: CLASSROOM },
  { key: 'SE LAB', code: '20CS31L01', name: 'Software Engineering Lab', faculty: 'K Durga Kalyani', periods: 2, kind: 'lab', owner: 'CSE', room: 'SE Lab' },
  { key: 'CN LAB', code: '20CS31L02', name: 'Computer Networks Lab', faculty: 'Dr Puja S Prasad', periods: 2, kind: 'lab', owner: 'CSE', room: 'CN Lab' },
  { key: 'AI LAB', code: '20CS31L03', name: 'Artificial Intelligence Lab', faculty: 'Dr K Kamakshaiah', periods: 2, kind: 'lab', owner: 'CSE', room: 'AI Lab' },
  { key: 'PCS LAB', code: '20EN31L01', name: 'Professional Communication Skills Lab', faculty: 'Dr P Narasimha Raju', periods: 2, kind: 'lab', owner: 'HS', room: 'PCS Lab' },
  { key: 'LR-I', code: '20MA31P01', name: 'Logical Reasoning-I (LR-I)', faculty: 'Dr N Nagi Reddy', periods: 4, kind: 'theory', owner: 'HS', room: CLASSROOM },
  // Listed on the sheet with 0 periods: no weekly slot
  { key: 'ICS', code: '20CS31M03', name: 'Introduction to Cyber Security (ICS)', faculty: 'Md Naseruddin', periods: 0, kind: 'audit', owner: 'CSE', room: CLASSROOM },
  // The yellow "TRAINING" blocks. Not a subject, but it needs a home so it shows in the timetable and attendance.
  { key: 'TRAINING', code: 'TRAINING', name: 'Training', faculty: 'Md Naseruddin', periods: 0, kind: 'training', owner: 'CSE', room: CLASSROOM },
];

export type Batch = 'ALL' | 'B-1' | 'B-2';
export interface HSlot { day: number; from: Period; to: Period; course: string; batch: Batch }

const s = (day: number, from: Period, to: Period, course: string, batch: Batch = 'ALL'): HSlot => ({ day, from, to, course, batch });

export const H_SLOTS: HSlot[] = [
  // Monday
  s(1, 1, 4, 'TRAINING'),
  s(1, 5, 6, 'SE LAB', 'B-1'), s(1, 5, 6, 'AI LAB', 'B-2'),
  // Tuesday
  s(2, 1, 1, 'CN'), s(2, 2, 2, 'BT'), s(2, 3, 4, 'LR-I'),
  s(2, 5, 6, 'TRAINING'),
  // Wednesday
  s(3, 1, 4, 'TRAINING'),
  s(3, 5, 5, 'AI'), s(3, 6, 6, 'BT'),
  // Thursday
  s(4, 1, 1, 'AI'), s(4, 2, 2, 'SE'),
  s(4, 3, 4, 'AI LAB', 'B-1'), s(4, 3, 4, 'CN LAB', 'B-2'),
  s(4, 5, 6, 'TRAINING'),
  // Friday
  s(5, 1, 1, 'SE'), s(5, 2, 2, 'CN'), s(5, 3, 4, 'LR-I'),
  s(5, 5, 6, 'PCS LAB'),
  // Saturday
  s(6, 1, 1, 'AI'), s(6, 2, 2, 'BT'), s(6, 3, 3, 'SE'), s(6, 4, 4, 'CN'),
  s(6, 5, 6, 'CN LAB', 'B-1'), s(6, 5, 6, 'SE LAB', 'B-2'),
];

export const slotTimes = (x: HSlot) => ({ startTime: PERIODS[x.from][0], endTime: PERIODS[x.to][1] });

/** Every distinct faculty on the sheet and the academic department they belong to. */
export const H_FACULTY: { name: string; dept: OwnerDept }[] = (() => {
  const seen = new Map<string, OwnerDept>();
  for (const c of H_COURSES) {
    // Faculty belong to the department that offers their course, except the class teacher who is CSE
    if (!seen.has(c.faculty)) seen.set(c.faculty, c.owner);
  }
  return [...seen].map(([name, dept]) => ({ name, dept }));
})();

/** Periods a course occupies per week for ONE student batch (parallel lab batches each attend once). */
export function periodsPerWeek(courseKey: string, batch: 'B-1' | 'B-2' = 'B-1'): number {
  return H_SLOTS.filter((x) => x.course === courseKey && (x.batch === 'ALL' || x.batch === batch)).reduce((n, x) => n + (x.to - x.from + 1), 0);
}
