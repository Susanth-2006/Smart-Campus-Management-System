import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { useApi } from '../services/queries';
import { AttendanceRecord, Course, Person } from '../types';
import { today } from '../utils/format';
import { EmptyState, ErrorState, Skeleton } from '../components/ui';
import { useToast } from '../components/Toast';

type St = 'PRESENT' | 'ABSENT' | 'LATE';
const OPTS: { v: St; label: string; on: string }[] = [
  { v: 'PRESENT', label: 'Present', on: 'bg-navy text-white' }, { v: 'ABSENT', label: 'Absent', on: 'bg-clay text-white' }, { v: 'LATE', label: 'Late', on: 'bg-peach text-navy' },
];

export default function TeachAttendance() {
  const [sp, setSp] = useSearchParams();
  const toast = useToast(), qc = useQueryClient();
  const courses = useApi<Course[]>(['courses', false, ''], '/courses?mine=true&q=');
  const courseId = sp.get('courseId') ?? courses.data?.[0]?.id ?? '';
  const [date, setDate] = useState(today()), [section, setSection] = useState('');
  const roster = useApi<{ items: Person[] }>(['roster', courseId], `/students?courseId=${courseId}&limit=100`, !!courseId);
  const existing = useApi<AttendanceRecord[]>(['attendance', 'records-day', courseId, date], `/attendance?courseId=${courseId}&date=${date}`, !!courseId);
  const [marks, setMarks] = useState<Record<string, St>>({});
  useEffect(() => { setMarks(Object.fromEntries((existing.data ?? []).map((r: any) => [r.studentId, r.status]))); }, [existing.data, courseId, date]);

  const students = (roster.data?.items ?? []).filter((s) => !section || s.section === section);
  const save = useMutation({
    mutationFn: () => api('/attendance', { method: 'POST', json: { courseId, date, records: students.map((s) => ({ studentId: s.id, status: marks[s.id] })) } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['attendance'] }); qc.invalidateQueries({ queryKey: ['notifications'] }); toast('Attendance saved successfully.'); },
    onError: (e) => toast((e as Error).message, 'err'),
  });
  const missing = students.filter((s) => !marks[s.id]).length;

  return (
    <div className="space-y-5">
      <header><h1 className="font-display text-4xl">Mark attendance</h1><p className="text-slate">Choose a class, then tap each student.</p></header>
      <div className="card grid gap-3 sm:grid-cols-4">
        <label className="text-sm font-medium sm:col-span-2">Course<select value={courseId} onChange={(e) => setSp({ courseId: e.target.value })} className="input mt-1">{courses.data?.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.name}</option>)}</select></label>
        <label className="text-sm font-medium">Section<select value={section} onChange={(e) => setSection(e.target.value)} className="input mt-1"><option value="">All</option><option>A</option><option>B</option></select></label>
        <label className="text-sm font-medium">Date<input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} className="input mt-1" /></label>
      </div>
      {roster.isLoading ? <Skeleton className="h-64" /> : roster.isError ? <ErrorState text="Unable to load students." onRetry={() => roster.refetch()} /> : !students.length ? <EmptyState text="No students for this selection." /> : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button className="btn-ghost" onClick={() => setMarks(Object.fromEntries(students.map((s) => [s.id, 'PRESENT'])))}>Mark All Present</button>
            <span className="text-sm text-slate">{students.length - missing} of {students.length} marked</span>
          </div>
          <ul className="space-y-2">{students.map((s) => (
            <li key={s.id} className="card flex flex-wrap items-center justify-between gap-3 !p-3">
              <span><span className="text-xs text-slate">{s.rollNo}</span><span className="block font-medium">{s.user.name}</span></span>
              <div role="radiogroup" aria-label={`Attendance for ${s.user.name}`} className="flex gap-2">{OPTS.map((o) => (
                <button key={o.v} role="radio" aria-checked={marks[s.id] === o.v} onClick={() => setMarks((m) => ({ ...m, [s.id]: o.v }))} className={`min-h-11 min-w-[5.5rem] rounded-xl border px-4 text-sm font-semibold transition ${marks[s.id] === o.v ? `${o.on} border-transparent` : 'border-line bg-white text-slate hover:bg-peach/20'}`}>{o.label}</button>))}</div>
            </li>))}</ul>
          <div className="sticky bottom-4 flex justify-end"><button disabled={save.isPending} onClick={() => (missing ? toast(`${missing} student(s) not marked yet`, 'err') : save.mutate())} className="btn-primary shadow-soft">{save.isPending ? 'Saving…' : 'Save Attendance'}</button></div>
        </>
      )}
    </div>
  );
}
