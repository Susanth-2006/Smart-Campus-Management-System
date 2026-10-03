import { useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useAttendanceRecords, useAttendanceSummary } from '../services/queries';
import { attTone } from '../utils/format';
import { EmptyState, ErrorState, ProgressBar, Skeleton } from '../components/ui';

const CHIP = { PRESENT: 'bg-navy text-white', LATE: 'bg-peach text-navy', ABSENT: 'bg-clay text-white' } as const;

// Monday of the week containing d, as YYYY-MM-DD
const weekKey = (iso: string) => { const d = new Date(iso); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10); };

export default function Attendance() {
  const [courseId, setCourseId] = useState<string>();
  const [from, setFrom] = useState(''), [to, setTo] = useState('');
  const summary = useAttendanceSummary();
  const records = useAttendanceRecords(courseId, from || undefined, to || undefined);

  const trend = useMemo(() => {
    const weeks = new Map<string, { att: number; total: number }>();
    for (const r of records.data ?? []) {
      const k = weekKey(r.date), w = weeks.get(k) ?? { att: 0, total: 0 };
      w.total++; if (r.status !== 'ABSENT') w.att++;
      weeks.set(k, w);
    }
    return [...weeks.entries()].sort().map(([k, w]) => ({ week: new Date(k).toLocaleDateString([], { month: 'short', day: 'numeric' }), pct: Math.round((w.att / w.total) * 100) }));
  }, [records.data]);

  return (
    <div className="space-y-6">
      <header><h1 className="font-display text-4xl">Attendance</h1><p className="text-slate">See how you're doing in every course.</p></header>

      {summary.isLoading ? <Skeleton className="h-40" /> : summary.isError ? <ErrorState text="Unable to load attendance. Try again." onRetry={() => summary.refetch()} /> : (
        <>
          <section className="card flex flex-col items-center gap-6 sm:flex-row">
            <div className="relative h-36 w-36 shrink-0">
              <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90" role="img" aria-label={`Overall attendance ${summary.data!.overall}%`}>
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#E8DFD9" strokeWidth="3.2" />
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#A56F63" strokeWidth="3.2" strokeLinecap="round" strokeDasharray={`${summary.data!.overall} 100`} />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center"><span className="font-display text-3xl">{Math.round(summary.data!.overall)}%</span><span className="text-xs text-slate">overall</span></div>
            </div>
            <p className="text-slate">You've attended <b className="text-navy">{summary.data!.courses.reduce((a, c) => a + c.present + c.late, 0)}</b> of <b className="text-navy">{summary.data!.totalClasses}</b> classes. Most institutions expect at least 75% in every course.</p>
          </section>

          <section aria-label="Subjects" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {summary.data!.courses.map((c) => {
              const t = attTone(c.percentage), active = courseId === c.courseId;
              return (
                <button key={c.courseId} onClick={() => setCourseId(active ? undefined : c.courseId)} aria-pressed={active}
                  className={`card text-left transition hover:-translate-y-0.5 ${active ? '!border-clay ring-2 ring-peach' : ''}`}>
                  <p className="text-xs font-semibold text-clay">{c.code}</p>
                  <p className="font-semibold">{c.name}</p>
                  <div className="my-3 flex items-end justify-between"><span className={`font-display text-3xl ${t.text}`}>{c.percentage}%</span><span className="rounded-full bg-peach/30 px-2.5 py-0.5 text-xs font-semibold text-clay">{t.label}</span></div>
                  <ProgressBar value={c.percentage} tone={t.bar} />
                  <p className="mt-2 text-xs text-slate">{c.present} present · {c.late} late · {c.absent} absent</p>
                </button>
              );
            })}
          </section>
        </>
      )}

      <section className="card">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-display text-2xl">Weekly trend</h2>
          <div className="flex flex-wrap items-end gap-3 text-sm">
            <label className="block"><span className="mb-1 block text-xs text-slate">From</span><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input !py-1.5" /></label>
            <label className="block"><span className="mb-1 block text-xs text-slate">To</span><input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="input !py-1.5" /></label>
            {(courseId || from || to) && <button className="btn-ghost !py-1.5" onClick={() => { setCourseId(undefined); setFrom(''); setTo(''); }}>Clear filters</button>}
          </div>
        </div>
        {records.isLoading ? <Skeleton className="h-56" /> : !trend.length ? <EmptyState text="No attendance records for these filters." /> : (
          <div className="h-56">
            <ResponsiveContainer>
              <LineChart data={trend} margin={{ left: -16, right: 8, top: 8 }}>
                <CartesianGrid stroke="#E8DFD9" vertical={false} />
                <XAxis dataKey="week" stroke="#464858" fontSize={12} />
                <YAxis domain={[0, 100]} stroke="#464858" fontSize={12} unit="%" />
                <Tooltip formatter={(v: any) => [`${v}%`, 'Attendance']} contentStyle={{ borderRadius: 12, border: '1px solid #E8DFD9' }} />
                <Line type="monotone" dataKey="pct" stroke="#A56F63" strokeWidth={3} dot={{ r: 4, fill: '#0F3040' }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section className="card">
        <h2 className="mb-3 font-display text-2xl">History</h2>
        {records.isError ? <ErrorState text="Unable to load records." onRetry={() => records.refetch()} /> : !records.data?.length ? <EmptyState text="Nothing to show yet." /> : (
          <ul className="divide-y divide-line">
            {records.data.slice(0, 40).map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                <span><span className="font-medium">{r.course.name}</span><span className="block text-xs text-slate">{new Date(r.date).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })}</span></span>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${CHIP[r.status]}`}>{r.status[0] + r.status.slice(1).toLowerCase()}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
