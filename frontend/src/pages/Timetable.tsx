import { useMemo, useState } from 'react';
import { CalendarPlus, ChevronLeft, ChevronRight, Printer } from 'lucide-react';
import { useTimetable } from '../services/queries';
import { TimetableEntry } from '../types';
import { DAYS, fmtTime } from '../utils/format';
import { buildGrid, isNow, toneOf, Tone, visibleDays } from '../utils/timetableLayout';
import { buildIcs } from '../utils/ics';
import { useAuth } from '../hooks/useAuth';
import { ClassModal } from '../components/ClassModal';
import { EmptyState, ErrorState, Skeleton } from '../components/ui';

const mondayOf = (offset: number) => { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + offset * 7); d.setHours(0, 0, 0, 0); return d; };
const TONE: Record<Tone, string> = {
  theory: 'border-l-clay bg-white hover:bg-peach/20',
  lab: 'border-l-navy bg-white hover:bg-navy/5',
  training: 'border-l-slate/50 bg-paper hover:bg-peach/10',
};

export default function Timetable() {
  const { user } = useAuth();
  const batch = user?.student?.batch ?? null;
  const [scope, setScope] = useState<'mine' | 'section'>('mine');
  const { data, isLoading, isError, refetch } = useTimetable(scope);
  const [weekOffset, setWeekOffset] = useState(0);
  const [view, setView] = useState<'week' | 'day'>('week');
  const [day, setDay] = useState(() => Math.min(Math.max(new Date().getDay(), 1), 6));
  const [course, setCourse] = useState(''), [room, setRoom] = useState(''), [faculty, setFaculty] = useState('');
  const [selected, setSelected] = useState<TimetableEntry | null>(null);

  const all = data ?? [];
  const rows = useMemo(() => all.filter((e) => (!course || e.course.id === course) && (!room || e.room === room) && (!faculty || e.course.faculty.id === faculty)), [all, course, room, faculty]);
  const courses = useMemo(() => [...new Map(all.map((e) => [e.course.id, e.course] as const)).values()], [all]);
  const facultyList = useMemo(() => [...new Map(all.map((e) => [e.course.faculty.id, e.course.faculty] as const)).values()], [all]);
  const rooms = useMemo(() => [...new Set(all.map((e) => e.room))].sort(), [all]);
  const allDays = useMemo(() => visibleDays(all), [all]);
  const days = view === 'week' ? allDays : [Math.min(day, Math.max(...allDays))];
  const grid = useMemo(() => buildGrid(rows.filter((e) => days.includes(e.dayOfWeek))), [rows, days.join()]);

  const monday = mondayOf(weekOffset), last = new Date(monday); last.setDate(monday.getDate() + (allDays.includes(6) ? 5 : 4));
  const isThisWeek = weekOffset === 0, now = new Date(), todayNum = now.getDay() === 0 ? 7 : now.getDay();
  const cols = days.length;

  const downloadIcs = () => {
    const blob = new Blob([buildIcs(rows, { name: `${user?.student?.department.code ?? ''} timetable`.trim() })], { type: 'text/calendar;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'timetable.ics'; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl">Timetable</h1>
          <p className="text-slate">
            {user?.student && <span className="font-medium text-navy">{user.student.department.code} · Semester {user.student.semester} · Section {user.student.section}{batch ? ` · Batch ${batch}` : ''} · </span>}
            {monday.toLocaleDateString([], { day: 'numeric', month: 'short' })} – {last.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <button aria-label="Previous week" onClick={() => setWeekOffset((w) => w - 1)} className="btn-ghost !px-3"><ChevronLeft size={18} /></button>
          <button onClick={() => setWeekOffset(0)} className="btn-ghost" disabled={isThisWeek}>Current Week</button>
          <button aria-label="Next week" onClick={() => setWeekOffset((w) => w + 1)} className="btn-ghost !px-3"><ChevronRight size={18} /></button>
          <button onClick={downloadIcs} disabled={!rows.length} className="btn-ghost" title="Download a calendar file for Google / Apple / Outlook"><CalendarPlus size={16} />Add to calendar</button>
          <button onClick={() => window.print()} className="btn-ghost" aria-label="Print timetable"><Printer size={16} />Print</button>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <div role="tablist" aria-label="View" className="flex rounded-xl border border-line bg-white p-1">
          {(['week', 'day'] as const).map((v) => <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)} className={`rounded-lg px-4 py-1.5 text-sm font-semibold ${view === v ? 'bg-navy text-white' : 'text-slate'}`}>{v === 'week' ? 'Week' : 'Day'}</button>)}
        </div>
        {batch && (
          <div role="tablist" aria-label="Which sessions" className="flex rounded-xl border border-line bg-white p-1">
            <button role="tab" aria-selected={scope === 'mine'} onClick={() => setScope('mine')} className={`rounded-lg px-4 py-1.5 text-sm font-semibold ${scope === 'mine' ? 'bg-navy text-white' : 'text-slate'}`}>My batch ({batch})</button>
            <button role="tab" aria-selected={scope === 'section'} onClick={() => setScope('section')} className={`rounded-lg px-4 py-1.5 text-sm font-semibold ${scope === 'section' ? 'bg-navy text-white' : 'text-slate'}`}>Whole section</button>
          </div>
        )}
        {view === 'day' && <select aria-label="Day" value={days[0]} onChange={(e) => setDay(Number(e.target.value))} className="input !w-auto">{allDays.map((d) => <option key={d} value={d}>{DAYS[d % 7]}</option>)}</select>}
        <select aria-label="Filter by course" value={course} onChange={(e) => setCourse(e.target.value)} className="input !w-auto"><option value="">All courses</option>{courses.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.name}</option>)}</select>
        {facultyList.length > 1 && <select aria-label="Filter by faculty" value={faculty} onChange={(e) => setFaculty(e.target.value)} className="input !w-auto"><option value="">All faculty</option>{facultyList.map((f) => <option key={f.id} value={f.id}>{f.user.name}</option>)}</select>}
        <select aria-label="Filter by room" value={room} onChange={(e) => setRoom(e.target.value)} className="input !w-auto"><option value="">All rooms</option>{rooms.map((r) => <option key={r}>{r}</option>)}</select>
      </div>

      {isLoading ? <Skeleton className="h-80" /> : isError ? <ErrorState text="Unable to load your timetable. Try again." onRetry={() => refetch()} /> : !rows.length ? <EmptyState text="No classes match these filters." /> : (
        <div className="overflow-x-auto">
          <div className="grid gap-2" style={{ gridTemplateColumns: `4.5rem repeat(${cols}, minmax(${cols > 2 ? '9rem' : '16rem'}, 1fr))`, minWidth: cols > 2 ? `${4.5 + cols * 9}rem` : undefined }}>
            <div />
            {days.map((d, i) => <div key={d} style={{ gridColumn: i + 2, gridRow: 1 }} className={`rounded-xl py-2 text-center text-sm font-semibold ${isThisWeek && d === todayNum ? 'bg-clay text-white' : 'bg-white text-navy'}`}>{DAYS[d % 7]}</div>)}

            {grid.boundaries.slice(0, -1).map((b, r) => <div key={b} style={{ gridColumn: 1, gridRow: r + 2 }} className="pt-3 text-xs font-semibold text-slate">{fmtTime(b)}</div>)}

            {grid.breaks.map((br) => (
              <div key={br.row} style={{ gridColumn: `2 / span ${cols}`, gridRow: br.row + 2 }} className="flex items-center justify-center rounded-xl bg-peach/20 py-2 text-xs font-semibold uppercase tracking-widest text-clay">
                {br.label} · {fmtTime(br.from)} – {fmtTime(br.to)}
              </div>
            ))}

            {days.flatMap((d, i) => grid.boundaries.slice(0, -1).map((_, r) => ({ d, i, r }))).filter(({ d, r }) => !grid.breaks.some((b) => b.row === r) && !grid.cells.some((c) => c.day === d && r >= c.rowStart && r < c.rowEnd)).map(({ d, i, r }) => (
              <div key={`e${d}-${r}`} style={{ gridColumn: i + 2, gridRow: r + 2 }} className="rounded-2xl border border-dashed border-line" />
            ))}

            {grid.cells.map((c) => {
              const col = days.indexOf(c.day) + 2;
              return (
                <div key={`${c.day}-${c.rowStart}`} style={{ gridColumn: col, gridRow: `${c.rowStart + 2} / ${c.rowEnd + 2}` }} className="flex min-h-[4.5rem] flex-col gap-2">
                  {c.items.map((e) => {
                    const live = isThisWeek && isNow(e, now);
                    return (
                      <button key={e.id} title={`${e.course.faculty.user.name} · Room ${e.room}`} onClick={() => setSelected(e)}
                        className={`relative flex-1 rounded-2xl border border-line border-l-4 p-3 text-left text-sm shadow-soft transition hover:-translate-y-0.5 ${TONE[toneOf(e)]} ${live ? 'ring-2 ring-clay' : ''}`}>
                        {live && <span className="absolute right-2 top-2 rounded-full bg-clay px-2 py-0.5 text-[10px] font-bold uppercase text-white">Now</span>}
                        <span className="block font-semibold leading-tight">{e.course.name}{e.section !== 'ALL' && <span className="ml-1.5 rounded-full bg-navy/10 px-2 py-0.5 text-[10px] font-bold text-navy">{e.section}</span>}</span>
                        <span className="mt-1 block text-xs text-slate">{toneOf(e) === 'training' ? 'Training session' : `${e.course.code} · ${e.room}`}</span>
                        <span className="block text-xs text-slate">{fmtTime(e.startTime)} – {fmtTime(e.endTime)}</span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}
      <ClassModal entry={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
