import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTimetable } from '../services/queries';
import { TimetableEntry } from '../types';
import { DAYS, fmtTime } from '../utils/format';
import { ClassModal } from '../components/ClassModal';
import { EmptyState, ErrorState, Skeleton } from '../components/ui';

const mondayOf = (offset: number) => { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + offset * 7); d.setHours(0, 0, 0, 0); return d; };

export default function Timetable() {
  const { data, isLoading, isError, refetch } = useTimetable();
  const [weekOffset, setWeekOffset] = useState(0);
  const [view, setView] = useState<'week' | 'day'>('week');
  const [day, setDay] = useState(Math.min(Math.max(new Date().getDay(), 1), 5));
  const [course, setCourse] = useState(''), [room, setRoom] = useState(''), [faculty, setFaculty] = useState('');
  const [selected, setSelected] = useState<TimetableEntry | null>(null);

  const monday = mondayOf(weekOffset), friday = new Date(monday); friday.setDate(monday.getDate() + 4);
  const rows = useMemo(() => (data ?? []).filter((e) => (!course || e.course.id === course) && (!room || e.room === room) && (!faculty || e.course.faculty.id === faculty)), [data, course, room]);
  const courses = useMemo(() => [...new Map((data ?? []).map((e) => [e.course.id, e.course] as const)).values()], [data]);
  const facultyList = useMemo(() => [...new Map((data ?? []).map((e) => [e.course.faculty.id, e.course.faculty] as const)).values()], [data]);
  const rooms = useMemo(() => [...new Set((data ?? []).map((e) => e.room))].sort(), [data]);
  const slots = useMemo(() => [...new Set(rows.map((e) => e.startTime))].sort(), [rows]);
  const days = view === 'week' ? [1, 2, 3, 4, 5] : [day];
  const isThisWeek = weekOffset === 0, todayNum = new Date().getDay();

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="font-display text-4xl">Timetable</h1><p className="text-slate">{monday.toLocaleDateString([], { day: 'numeric', month: 'short' })} – {friday.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}</p></div>
        <div className="flex items-center gap-2">
          <button aria-label="Previous week" onClick={() => setWeekOffset((w) => w - 1)} className="btn-ghost !px-3"><ChevronLeft size={18} /></button>
          <button onClick={() => setWeekOffset(0)} className="btn-ghost" disabled={isThisWeek}>Current Week</button>
          <button aria-label="Next week" onClick={() => setWeekOffset((w) => w + 1)} className="btn-ghost !px-3"><ChevronRight size={18} /></button>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <div role="tablist" className="flex rounded-xl border border-line bg-white p-1">
          {(['week', 'day'] as const).map((v) => <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)} className={`rounded-lg px-4 py-1.5 text-sm font-semibold ${view === v ? 'bg-navy text-white' : 'text-slate'}`}>{v === 'week' ? 'Week' : 'Day'}</button>)}
        </div>
        {view === 'day' && <select aria-label="Day" value={day} onChange={(e) => setDay(Number(e.target.value))} className="input !w-auto">{[1, 2, 3, 4, 5].map((d) => <option key={d} value={d}>{DAYS[d]}</option>)}</select>}
        <select aria-label="Filter by course" value={course} onChange={(e) => setCourse(e.target.value)} className="input !w-auto"><option value="">All courses</option>{courses.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.name}</option>)}</select>
        {facultyList.length > 1 && <select aria-label="Filter by faculty" value={faculty} onChange={(e) => setFaculty(e.target.value)} className="input !w-auto"><option value="">All faculty</option>{facultyList.map((f) => <option key={f.id} value={f.id}>{f.user.name}</option>)}</select>}
        <select aria-label="Filter by room" value={room} onChange={(e) => setRoom(e.target.value)} className="input !w-auto"><option value="">All rooms</option>{rooms.map((r) => <option key={r}>{r}</option>)}</select>
      </div>

      {isLoading ? <Skeleton className="h-80" /> : isError ? <ErrorState text="Unable to load your timetable. Try again." onRetry={() => refetch()} /> : !rows.length ? <EmptyState text="No classes match these filters." /> : (
        <div className="overflow-x-auto">
          <div className="grid min-w-[44rem] gap-3" style={{ gridTemplateColumns: `4.5rem repeat(${days.length}, minmax(0,1fr))` }}>
            <div />
            {days.map((d) => <div key={d} className={`rounded-xl py-2 text-center text-sm font-semibold ${isThisWeek && d === todayNum ? 'bg-clay text-white' : 'bg-white text-navy'}`}>{DAYS[d]}</div>)}
            {slots.map((s) => (
              <div key={s} className="contents">
                <div className="pt-3 text-xs font-semibold text-slate">{fmtTime(s)}</div>
                {days.map((d) => {
                  const e = rows.find((r) => r.dayOfWeek === d && r.startTime === s);
                  return e ? (
                    <button key={d} title={`${e.course.faculty.user.name} · Room ${e.room}`} onClick={() => setSelected(e)} className="rounded-2xl border border-line border-l-4 border-l-clay bg-white p-3 text-left text-sm shadow-soft transition hover:-translate-y-0.5 hover:bg-peach/20">
                      <span className="block font-semibold leading-tight">{e.course.name}</span>
                      <span className="mt-1 block text-xs text-slate">{e.course.code} · {e.room}</span>
                      <span className="block text-xs text-slate">{e.startTime}–{e.endTime}</span>
                    </button>
                  ) : <div key={d} className="rounded-2xl border border-dashed border-line" />;
                })}
              </div>
            ))}
          </div>
        </div>
      )}
      <ClassModal entry={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
