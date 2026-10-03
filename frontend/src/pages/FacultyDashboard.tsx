import { Link } from 'react-router-dom';
import { BookOpen, ClipboardCheck, FileSpreadsheet, Users } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useAnnouncements, useApi, useMarks, useTimetable } from '../services/queries';
import { AttendanceRecord, Course } from '../types';
import { firstName, fmtTime, greeting, today } from '../utils/format';
import { EmptyState, Skeleton, StatCard } from '../components/ui';

export default function FacultyDashboard() {
  const { user } = useAuth();
  const tt = useTimetable(), marks = useMarks(), ann = useAnnouncements();
  const courses = useApi<Course[]>(['courses', false, ''], '/courses?mine=true&q=');
  const marked = useApi<AttendanceRecord[]>(['attendance', 'records-day', 'all', today()], `/attendance?date=${today()}`);
  if (tt.isLoading || courses.isLoading) return <Skeleton className="h-96" />;

  const classes = (tt.data ?? []).filter((e) => e.dayOfWeek === new Date().getDay()).sort((a, b) => a.startTime.localeCompare(b.startTime));
  const done = new Set((marked.data ?? []).map((r) => r.courseId));
  const pending = classes.filter((c) => !done.has(c.course.id));
  const unpublished = (marks.data ?? []).filter((m) => !m.published).length;
  const students = (courses.data ?? []).reduce((a, c) => a + c._count.enrollments, 0);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-navy p-6 text-white sm:p-8"><h1 className="font-display text-3xl sm:text-4xl">{greeting()}, Dr. {firstName(user!.name)}.</h1><p className="text-white/70">Here's your teaching overview for today.</p></section>
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Today's classes" value={classes.length} to="/teaching/timetable" icon={<ClipboardCheck size={18} />} />
        <StatCard label="Courses" value={courses.data?.length ?? 0} to="/teaching/courses" icon={<BookOpen size={18} />} />
        <StatCard label="Students" value={students} to="/students" icon={<Users size={18} />} />
        <StatCard label="Marks unpublished" value={unpublished} hint={`${pending.length} attendance pending`} to="/teaching/marks" icon={<FileSpreadsheet size={18} />} />
      </section>
      <section className="grid gap-6 lg:grid-cols-3">
        <div className="card lg:col-span-2">
          <h2 className="mb-4 font-display text-2xl">Today's classes</h2>
          {!classes.length ? <EmptyState text="No classes today." /> : <ul className="space-y-3">{classes.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-4 rounded-2xl border border-line p-4">
              <span className="w-20 text-sm font-semibold text-clay">{fmtTime(c.startTime)}</span>
              <span className="flex-1"><span className="block font-semibold">{c.course.name}</span><span className="text-xs text-slate">Room {c.room}</span></span>
              {done.has(c.course.id) ? <span className="rounded-full bg-navy px-3 py-1 text-xs font-semibold text-white">Attendance done</span> : <Link to={`/teaching/attendance?courseId=${c.course.id}`} className="btn-accent !py-1.5">Mark attendance</Link>}
            </li>))}</ul>}
        </div>
        <div className="card"><h2 className="mb-4 font-display text-2xl">Announcements</h2>
          {!ann.data?.length ? <EmptyState text="No announcements." /> : <ul className="space-y-3">{ann.data.slice(0, 4).map((a) => <li key={a.id}><Link to={`/campus/announcements/${a.id}`} className="text-sm font-medium hover:text-clay">{a.title}</Link></li>)}</ul>}</div>
      </section>
    </div>
  );
}
