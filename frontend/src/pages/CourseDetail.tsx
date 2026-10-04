import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useAnnouncements, useApi } from '../services/queries';
import { AttendanceSummary, Course, MarkRecord } from '../types';
import { DAYS, fmtTime, attTone } from '../utils/format';
import { Tabs } from '../components/Tabs';
import { MaterialsTab } from '../components/MaterialsTab';
import { EmptyState, ErrorState, ProgressBar, Skeleton } from '../components/ui';

const TABS = ['Overview', 'Faculty', 'Schedule', 'Attendance', 'Marks', 'Materials', 'Announcements'];

export default function CourseDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [tab, setTab] = useState('Overview');
  const course = useApi<Course>(['course', id], `/courses/${id}`);
  const student = user!.role === 'STUDENT';
  const att = useApi<AttendanceSummary>(['attendance', 'summary'], '/attendance/summary', student);
  const marks = useApi<MarkRecord[]>(['marks'], '/marks', student);
  const ann = useAnnouncements();
  if (course.isLoading) return <Skeleton className="h-64" />;
  if (course.isError || !course.data) return <ErrorState text="Unable to load this course." onRetry={() => course.refetch()} />;
  const c = course.data;
  const a = att.data?.courses.find((x) => x.courseId === c.id), m = marks.data?.find((x) => x.courseId === c.id);

  return (
    <div className="space-y-5">
      <header className="rounded-3xl bg-navy p-6 text-white">
        <span className="rounded-full bg-peach px-3 py-1 text-xs font-bold text-navy">{c.code}</span>
        <h1 className="mt-3 font-display text-4xl">{c.name}</h1>
        <p className="text-white/70">{c.faculty.user.name} · {c.credits} credits · Semester {c.semester} · Room {c.room}</p>
      </header>
      <Tabs tabs={TABS} value={tab} onChange={setTab} />
      <div className="card">
        {tab === 'Overview' && <p className="text-slate">{c.description ?? 'No description provided.'}<br />Department of {c.department.name} · {c._count.enrollments} students enrolled.</p>}
        {tab === 'Faculty' && <div><p className="font-semibold">{c.faculty.user.name}</p><p className="text-sm text-slate">{c.faculty.designation}, {c.department.name}</p><a className="text-sm text-clay underline" href={`mailto:${c.faculty.user.email}`}>{c.faculty.user.email}</a></div>}
        {tab === 'Schedule' && (!c.timetable?.length ? <EmptyState text="No sessions scheduled." /> : <ul className="divide-y divide-line">{c.timetable.map((t) => <li key={t.id} className="flex justify-between py-3 text-sm"><span className="font-medium">{DAYS[t.dayOfWeek % 7]}{t.section && t.section !== 'ALL' ? ` · Batch ${t.section}` : ''}</span><span>{fmtTime(t.startTime)} – {fmtTime(t.endTime)} · Room {t.room}</span></li>)}</ul>)}
        {tab === 'Attendance' && (student ? (a ? <div><p className="font-display text-4xl">{a.percentage}%</p><div className="my-2"><ProgressBar value={a.percentage} tone={attTone(a.percentage).bar} /></div><p className="text-sm text-slate">{a.present} present · {a.late} late · {a.absent} absent of {a.total} classes</p></div> : <EmptyState text="No attendance recorded yet." />) : <Link to="/teaching/attendance" className="btn-primary">Open attendance marking</Link>)}
        {tab === 'Marks' && (student ? (m ? <div><p className="font-display text-4xl">{m.total}<span className="text-lg text-slate"> / 100 · Grade {m.grade}</span></p></div> : <EmptyState text="Marks are not published yet." />) : <Link to="/teaching/marks" className="btn-primary">Open marks entry</Link>)}
        {tab === 'Materials' && <MaterialsTab courseId={c.id} canManage={user!.role === 'ADMIN' || (user!.role === 'FACULTY' && c.faculty.id === user!.profileId)} />}
        {tab === 'Announcements' && (!ann.data?.length ? <EmptyState text="No announcements." /> : <ul className="divide-y divide-line">{ann.data.filter((x) => x.category === 'ACADEMIC').slice(0, 5).map((x) => <li key={x.id}><Link to={`/campus/announcements/${x.id}`} className="block py-3 text-sm font-medium hover:text-clay">{x.title}</Link></li>)}</ul>)}
      </div>
    </div>
  );
}
