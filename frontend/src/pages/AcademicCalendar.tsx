import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { api, ApiError } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { useApi, useUpcoming } from '../services/queries';
import { CalendarEvent } from '../types';
import { today, ymd } from '../utils/format';
import { EmptyState, ErrorState, Modal, Skeleton } from '../components/ui';
import { useToast } from '../components/Toast';

const TYPE: Record<string, { chip: string; label: string }> = {
  HOLIDAY: { chip: 'bg-clay text-white', label: 'Holiday' }, EXAM: { chip: 'bg-navy text-white', label: 'Exam' }, DEADLINE: { chip: 'bg-peach text-navy', label: 'Deadline' },
  EVENT: { chip: 'bg-slate text-white', label: 'Event' }, CLASS: { chip: 'bg-line text-navy', label: 'Classes' },
};
const WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const d10 = (iso: string) => iso.slice(0, 10);
const nice = (s: string) => new Date(`${s}T00:00:00`).toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });

export default function AcademicCalendar() {
  const { user } = useAuth();
  const toast = useToast(), qc = useQueryClient();
  const isAdmin = user!.role === 'ADMIN';
  const [month, setMonth] = useState(() => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d; });
  const [sel, setSel] = useState(today()), [adding, setAdding] = useState(false);
  const days = useMemo(() => { const start = new Date(month); start.setDate(1 - start.getDay()); return Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; }); }, [month]);
  const from = ymd(days[0]), to = ymd(days[41]);
  const grid = useApi<CalendarEvent[]>(['calendar', 'grid', from, to], `/calendar?from=${from}&to=${to}`);
  const upcoming = useUpcoming(60);
  const on = (s: string) => (grid.data ?? []).filter((e) => d10(e.startDate) <= s && d10(e.endDate) >= s);
  const shift = (n: number) => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + n, 1));

  const del = useMutation({
    mutationFn: (id: string) => api(`/calendar/${id}`, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['calendar'] }); toast('Event removed'); },
    onError: (e) => toast((e as Error).message, 'err'),
  });

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="font-display text-4xl">Academic Calendar</h1><p className="text-slate">Holidays, exams, deadlines and events.</p></div>
        <div className="flex items-center gap-2">
          <button aria-label="Previous month" onClick={() => shift(-1)} className="btn-ghost !px-3"><ChevronLeft size={18} /></button>
          <span className="w-40 text-center font-semibold">{month.toLocaleDateString([], { month: 'long', year: 'numeric' })}</span>
          <button aria-label="Next month" onClick={() => shift(1)} className="btn-ghost !px-3"><ChevronRight size={18} /></button>
          <button onClick={() => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); setMonth(d); setSel(today()); }} className="btn-ghost">Today</button>
          {isAdmin && <button onClick={() => setAdding(true)} className="btn-primary"><Plus size={16} />Add event</button>}
        </div>
      </header>

      <div className="flex flex-wrap gap-2 text-xs">{Object.values(TYPE).map((t) => <span key={t.label} className={`rounded-full px-3 py-1 font-semibold ${t.chip}`}>{t.label}</span>)}</div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {grid.isError ? <ErrorState text="Unable to load the calendar." onRetry={() => grid.refetch()} /> : grid.isLoading ? <Skeleton className="h-96" /> : (
            <div className="overflow-x-auto"><div className="grid min-w-[34rem] grid-cols-7 gap-1">
              {WEEK.map((w) => <div key={w} className="py-1 text-center text-xs font-semibold text-slate">{w}</div>)}
              {days.map((d) => {
                const s = ymd(d), evs = on(s), inMonth = d.getMonth() === month.getMonth();
                return (
                  <button key={s} onClick={() => setSel(s)} aria-label={`${nice(s)}, ${evs.length} events`} aria-pressed={sel === s}
                    className={`min-h-20 rounded-xl border p-1.5 text-left align-top transition hover:bg-peach/20 ${sel === s ? 'border-clay bg-peach/25' : 'border-line bg-white'} ${inMonth ? '' : 'opacity-40'}`}>
                    <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${s === today() ? 'bg-clay text-white' : ''}`}>{d.getDate()}</span>
                    {evs.slice(0, 2).map((e) => <span key={e.id} className={`mt-0.5 block truncate rounded px-1 text-[10px] font-semibold ${TYPE[e.type].chip}`}>{e.title}</span>)}
                    {evs.length > 2 && <span className="text-[10px] text-slate">+{evs.length - 2} more</span>}
                  </button>
                );
              })}
            </div></div>
          )}
        </div>

        <aside className="space-y-4">
          <div className="card">
            <h2 className="font-display text-xl">{nice(sel)}</h2>
            {!on(sel).length ? <p className="mt-2 text-sm text-slate">Nothing scheduled.</p> : (
              <ul className="mt-2 space-y-3">{on(sel).map((e) => (
                <li key={e.id} className="text-sm">
                  <div className="flex items-start justify-between gap-2"><span><span className={`mr-2 rounded px-1.5 py-0.5 text-[10px] font-bold ${TYPE[e.type].chip}`}>{TYPE[e.type].label}</span><b>{e.title}</b></span>
                    {isAdmin && <button aria-label={`Delete ${e.title}`} onClick={() => del.mutate(e.id)} className="text-slate hover:text-clay"><Trash2 size={14} /></button>}</div>
                  <p className="text-xs text-slate">{d10(e.startDate) === d10(e.endDate) ? nice(d10(e.startDate)) : `${nice(d10(e.startDate))} to ${nice(d10(e.endDate))}`}</p>
                  {e.description && <p className="text-slate">{e.description}</p>}
                </li>))}</ul>
            )}
          </div>
          <div className="card">
            <h2 className="font-display text-xl">Coming up</h2>
            {upcoming.isLoading ? <Skeleton className="mt-2 h-20" /> : !upcoming.data?.length ? <EmptyState text="Nothing in the next 60 days." /> : (
              <ul className="mt-2 space-y-2">{upcoming.data.slice(0, 6).map((e) => <li key={e.id}><button onClick={() => { setSel(d10(e.startDate)); const d = new Date(`${d10(e.startDate)}T00:00:00`); d.setDate(1); setMonth(d); }} className="w-full text-left text-sm hover:text-clay"><b>{e.title}</b><span className="block text-xs text-slate">{nice(d10(e.startDate))}</span></button></li>)}</ul>
            )}
          </div>
        </aside>
      </div>
      <AddEvent open={adding} onClose={() => setAdding(false)} defaultDate={sel} />
    </div>
  );
}

function AddEvent({ open, onClose, defaultDate }: { open: boolean; onClose: () => void; defaultDate: string }) {
  const toast = useToast(), qc = useQueryClient();
  const [err, setErr] = useState<Record<string, string>>({});
  const add = useMutation({
    mutationFn: (b: unknown) => api('/calendar', { method: 'POST', json: b }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['calendar'] }); toast('Event added'); onClose(); },
    onError: (e) => { const a = e as ApiError; setErr(Object.fromEntries((a.issues ?? []).map((i) => [i.path, i.message]))); toast(a.message, 'err'); },
  });
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setErr({});
    const f = new FormData(e.currentTarget);
    add.mutate({ title: f.get('title'), type: f.get('type'), startDate: f.get('startDate'), endDate: f.get('endDate') || undefined, description: f.get('description') || undefined });
  };
  return (
    <Modal open={open} onClose={onClose} title="Add calendar event">
      <form onSubmit={submit} className="space-y-3">
        <label className="block text-sm font-medium">Title<input name="title" required className="input mt-1" />{err.title && <span className="text-xs text-clay">{err.title}</span>}</label>
        <label className="block text-sm font-medium">Type<select name="type" className="input mt-1">{Object.entries(TYPE).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm font-medium">Starts<input name="startDate" type="date" required defaultValue={defaultDate} className="input mt-1" /></label>
          <label className="block text-sm font-medium">Ends (optional)<input name="endDate" type="date" className="input mt-1" />{err.endDate && <span className="text-xs text-clay">{err.endDate}</span>}</label>
        </div>
        <label className="block text-sm font-medium">Details (optional)<textarea name="description" rows={2} className="input mt-1" /></label>
        <button disabled={add.isPending} className="btn-primary w-full">Add event</button>
      </form>
    </Modal>
  );
}
