export const greeting = (d = new Date()) => (d.getHours() < 12 ? 'Good morning' : d.getHours() < 17 ? 'Good afternoon' : 'Good evening');
export const firstName = (n: string) => n.replace(/^Dr\.\s*/, '').split(' ')[0];
export const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
export const fmtTime = (t: string) => { const [h, m] = t.split(':').map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`; };
export const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const POINTS: Record<string, number> = { O: 10, 'A+': 9, A: 8, 'B+': 7, B: 6, C: 5, F: 0 };
export function gpa(marks: { grade: string | null; course: { credits: number } }[]) {
  const rows = marks.filter((m) => m.grade);
  const credits = rows.reduce((a, m) => a + m.course.credits, 0);
  return credits ? Math.round((rows.reduce((a, m) => a + POINTS[m.grade!] * m.course.credits, 0) / credits) * 10) / 10 : 0;
}
// green-neutral is not needed: brand palette only. >=85 navy, 75-85 peach, <75 clay
export const attTone = (p: number) => (p >= 85 ? { bar: 'bg-navy', text: 'text-navy', label: 'On track' } : p >= 75 ? { bar: 'bg-peach', text: 'text-clay', label: 'Watch' } : { bar: 'bg-clay', text: 'text-clay', label: 'Low' });

export const MAX = { internal: 20, assignment: 10, midExam: 20, finalExam: 50 } as const;
export const gradeOf = (t: number) => (t >= 90 ? 'O' : t >= 80 ? 'A+' : t >= 70 ? 'A' : t >= 60 ? 'B+' : t >= 50 ? 'B' : t >= 40 ? 'C' : 'F');
export const STATUS_LABEL: Record<string, string> = { SUBMITTED: 'Submitted', UNDER_REVIEW: 'Under review', ASSIGNED: 'Assigned', IN_PROGRESS: 'In progress', RESOLVED: 'Resolved', CLOSED: 'Closed' };
export const FLOW = ['SUBMITTED', 'UNDER_REVIEW', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
export const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const today = () => ymd(new Date());
export const addDays = (s: string, n: number) => { const d = new Date(`${s}T00:00:00`); d.setDate(d.getDate() + n); return ymd(d); };
export const fmtSize = (b: number) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`);
