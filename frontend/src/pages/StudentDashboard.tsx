import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, CalendarDays, ClipboardCheck, LifeBuoy, Megaphone, TrendingUp } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useAnnouncements, useAttendanceSummary, useComplaints, useMarks, useTimetable, useUpcoming } from '../services/queries';
import { attTone, firstName, fmtTime, gpa, greeting, toMin } from '../utils/format';
import { ClassModal } from '../components/ClassModal';
import { EmptyState, ErrorState, ProgressBar, Skeleton, StatCard } from '../components/ui';
import { TimetableEntry } from '../types';

const STATUS_LABEL: Record<string, string> = { SUBMITTED: 'Submitted', UNDER_REVIEW: 'Under review', ASSIGNED: 'Assigned', IN_PROGRESS: 'In progress', RESOLVED: 'Resolved', CLOSED: 'Closed' };

export default function StudentDashboard() {
  const { user } = useAuth();
  const tt = useTimetable(), att = useAttendanceSummary(), marks = useMarks(), ann = useAnnouncements(), cmp = useComplaints(), up = useUpcoming(21);
  const [selected, setSelected] = useState<TimetableEntry | null>(null);

  const today = useMemo(() => {
    const now = new Date(), mins = now.getHours() * 60 + now.getMinutes();
    const list = (tt.data ?? []).filter((e) => e.dayOfWeek === now.getDay()).sort((a, b) => a.startTime.localeCompare(b.startTime));
    const current = list.find((e) => toMin(e.startTime) <= mins && mins < toMin(e.endTime));
    const next = current ?? list.find((e) => toMin(e.startTime) > mins);
    return { list, highlight: next?.id, isLive: !!current, next };
  }, [tt.data]);

  const openComplaints = (cmp.data ?? []).filter((c) => !['RESOLVED', 'CLOSED'].includes(c.status));
  const latestComplaint = (cmp.data ?? [])[0];
  const courseCount = att.data?.courses.length ?? marks.data?.length ?? 0;

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <section className="relative overflow-hidden rounded-3xl bg-navy p-6 text-white sm:p-8">
        <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-clay/40" />
        <div className="absolute bottom-0 right-24 h-24 w-24 rounded-full bg-peach/30" />
        <h1 className="relative font-display text-3xl sm:text-4xl">{greeting()}, {firstName(user!.name)} 👋</h1>
        <p className="relative mt-1 text-white/70">Here's what's happening with your academics and campus today.</p>
        {today.next && (
          <button onClick={() => setSelected(today.next!)} className="relative mt-4 rounded-xl bg-white/10 px-4 py-2 text-left text-sm hover:bg-white/20">
            <span className="text-peach">{today.isLive ? 'Now' : 'Next class'}:</span> {today.next.course.name} · {fmtTime(today.next.startTime)} · {today.next.room}
          </button>
        )}
      </section>

      {/* Stats */}
      <section aria-label="Key statistics" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {att.isLoading || marks.isLoading ? Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-32" />) : (
          <>
            <StatCard label="Attendance" value={`${Math.round(att.data?.overall ?? 0)}%`} hint="Across all courses" to="/academics/attendance" icon={<ClipboardCheck size={18} />} />
            <StatCard label="Current GPA" value={gpa(marks.data ?? []) || '—'} hint="Published results" to="/academics/marks" icon={<TrendingUp size={18} />} />
            <StatCard label="Courses" value={courseCount} hint="This semester" to="/academics/courses" icon={<BookOpen size={18} />} />
            <StatCard label="Open Complaints" value={openComplaints.length} hint="Awaiting resolution" to="/campus/complaints" icon={<LifeBuoy size={18} />} />
          </>
        )}
      </section>

      {/* Schedule + attendance */}
      <section className="grid gap-6 lg:grid-cols-3">
        <div className="card lg:col-span-2">
          <div className="mb-4 flex items-center justify-between"><h2 className="font-display text-2xl">Today's schedule</h2><Link to="/academics/timetable" className="btn-ghost !py-1.5">View Full Timetable</Link></div>
          {tt.isLoading ? <Skeleton className="h-40" /> : tt.isError ? <ErrorState text="Unable to load your schedule. Try again." onRetry={() => tt.refetch()} /> :
            !today.list.length ? <EmptyState text="No classes today. Enjoy the break!" /> : (
            <ul className="space-y-3">
              {today.list.map((e) => (
                <li key={e.id}>
                  <button onClick={() => setSelected(e)} className={`flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition hover:border-clay ${e.id === today.highlight ? 'border-clay bg-peach/20' : 'border-line'}`}>
                    <span className="w-16 text-sm font-semibold text-clay">{e.startTime}</span>
                    <span className="flex-1"><span className="block font-semibold">{e.course.name}</span><span className="text-xs text-slate">Room {e.room} · {e.course.faculty.user.name}</span></span>
                    {e.id === today.highlight && <span className="rounded-full bg-clay px-2.5 py-1 text-xs font-semibold text-white">{today.isLive ? 'Now' : 'Up next'}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card">
          <h2 className="mb-4 font-display text-2xl">Attendance</h2>
          {att.isLoading ? <Skeleton className="h-40" /> : att.isError ? <ErrorState text="Unable to load attendance." onRetry={() => att.refetch()} /> : (
            <ul className="space-y-4">
              {att.data!.courses.map((c) => (
                <li key={c.courseId}>
                  <div className="mb-1 flex justify-between text-sm"><span className="font-medium">{c.name}</span><span className={`font-semibold ${attTone(c.percentage).text}`}>{c.percentage}%</span></div>
                  <ProgressBar value={c.percentage} tone={attTone(c.percentage).bar} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Announcements + complaint */}
      <section className="grid gap-6 lg:grid-cols-3">
        <div className="card lg:col-span-2">
          <div className="mb-4 flex items-center justify-between"><h2 className="font-display text-2xl">Announcements</h2><Link to="/campus/announcements" className="text-sm font-medium text-clay hover:underline">See all</Link></div>
          {ann.isLoading ? <Skeleton className="h-32" /> : ann.isError ? <ErrorState text="Unable to load announcements." onRetry={() => ann.refetch()} /> :
            !ann.data?.length ? <EmptyState text="No announcements yet." /> : (
            <ul className="divide-y divide-line">
              {ann.data.slice(0, 4).map((a) => (
                <li key={a.id}>
                  <Link to={`/campus/announcements/${a.id}`} className="flex items-start gap-3 py-3 hover:text-clay">
                    <Megaphone size={18} className="mt-0.5 shrink-0 text-peach" />
                    <span className="flex-1"><span className={`block text-sm ${a.read ? 'font-medium' : 'font-bold'}`}>{a.title}</span><span className="text-xs text-slate">{a.category.toLowerCase()} · {new Date(a.createdAt).toLocaleDateString()}</span></span>
                    {!a.read && <span className="mt-1.5 h-2 w-2 rounded-full bg-clay" aria-label="Unread" />}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-6">
        <div className="card">
          <h2 className="mb-4 font-display text-2xl">Coming up</h2>
          {up.isLoading ? <Skeleton className="h-20" /> : !up.data?.length ? <EmptyState text="Nothing in the next 3 weeks." /> : (
            <ul className="space-y-3">{up.data.slice(0, 4).map((e) => (
              <li key={e.id}><Link to="/academics/calendar" className="block text-sm hover:text-clay"><b>{e.title}</b><span className="block text-xs text-slate">{new Date(e.startDate).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })} · {e.type.toLowerCase()}</span></Link></li>
            ))}</ul>
          )}
        </div>
        <div className="card">
          <h2 className="mb-4 font-display text-2xl">Latest complaint</h2>
          {cmp.isLoading ? <Skeleton className="h-24" /> : !latestComplaint ? <EmptyState text="No complaints yet." /> : (
            <Link to={`/campus/complaints/${latestComplaint.id}`} className="block rounded-2xl border border-line p-4 hover:border-clay">
              <p className="text-xs text-slate">#{latestComplaint.ticketNo}</p>
              <p className="font-semibold">{latestComplaint.title}</p>
              <span className="mt-2 inline-block rounded-full bg-peach/30 px-3 py-1 text-xs font-semibold text-clay">{STATUS_LABEL[latestComplaint.status]}</span>
            </Link>
          )}
        </div>
        </div>
      </section>

      {/* Quick actions */}
      <section aria-label="Quick actions" className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          { to: '/academics/attendance', label: 'Attendance', icon: ClipboardCheck },
          { to: '/academics/marks', label: 'Marks', icon: TrendingUp },
          { to: '/academics/timetable', label: 'Timetable', icon: CalendarDays },
          { to: '/academics/courses', label: 'Courses', icon: BookOpen },
          { to: '/campus/complaints', label: 'Complaints', icon: LifeBuoy },
        ].map(({ to, label, icon: Icon }) => (
          <Link key={to} to={to} className="btn-ghost !flex-col !gap-1 !py-4"><Icon size={20} className="text-clay" />{label}</Link>
        ))}
      </section>

      <ClassModal entry={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
