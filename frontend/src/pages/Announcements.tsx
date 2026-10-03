import { FormEvent, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search } from 'lucide-react';
import { api, ApiError } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { useApi } from '../services/queries';
import { Announcement } from '../types';
import { EmptyState, ErrorState, Modal, Skeleton } from '../components/ui';
import { useToast } from '../components/Toast';

const CATS = ['ALL', 'ACADEMIC', 'EVENTS', 'CAMPUS', 'EMERGENCY'];

export default function Announcements() {
  const { user } = useAuth();
  const [sp] = useSearchParams();
  const initial = (sp.get('category') ?? 'ALL').toUpperCase();
  const [cat, setCat] = useState(CATS.includes(initial) ? initial : 'ALL'), [q, setQ] = useState(''), [unread, setUnread] = useState(false), [open, setOpen] = useState(false);
  const { data, isLoading, isError, refetch } = useApi<Announcement[]>(['announcements', cat, q, unread], `/announcements?category=${cat}&q=${encodeURIComponent(q)}&unread=${unread}`);
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="font-display text-4xl">Announcements</h1><p className="text-slate">News and notices for you.</p></div>
        {user!.role === 'ADMIN' && <button onClick={() => setOpen(true)} className="btn-primary"><Plus size={16} />Publish</button>}
      </header>
      <div className="flex flex-wrap items-center gap-2">
        {CATS.map((c) => <button key={c} aria-pressed={cat === c} onClick={() => setCat(c)} className={`rounded-full px-4 py-1.5 text-sm font-semibold ${cat === c ? 'bg-navy text-white' : 'border border-line bg-white text-slate'}`}>{c[0] + c.slice(1).toLowerCase()}</button>)}
        <label className="ml-auto flex items-center gap-2 text-sm"><input type="checkbox" checked={unread} onChange={(e) => setUnread(e.target.checked)} />Unread only</label>
        <div className="relative"><Search size={16} className="absolute left-3 top-3 text-slate" /><input aria-label="Search announcements" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className="input !w-52 !pl-9" /></div>
      </div>
      {isLoading ? <Skeleton className="h-48" /> : isError ? <ErrorState text="Unable to load announcements." onRetry={() => refetch()} /> : !data?.length ? <EmptyState text="No announcements match." /> : (
        <ul className="grid gap-4 md:grid-cols-2">{data.map((a) => (
          <li key={a.id}><Link to={`/campus/announcements/${a.id}`} className={`card block h-full transition hover:-translate-y-0.5 ${a.priority === 'URGENT' ? '!border-clay' : ''}`}>
            <div className="flex items-center justify-between text-xs"><span className="rounded-full bg-peach/30 px-2.5 py-0.5 font-semibold text-clay">{a.category.toLowerCase()}</span>{!a.read && <span className="font-bold text-clay">● New</span>}</div>
            <h2 className={`mt-2 text-lg ${a.read ? 'font-medium' : 'font-bold'}`}>{a.title}</h2>
            <p className="mt-1 line-clamp-2 text-sm text-slate">{a.body}</p>
            <p className="mt-3 text-xs text-slate">{new Date(a.createdAt).toLocaleDateString()} · For {a.audience.map((r) => r.toLowerCase()).join(', ')} · {a.priority.toLowerCase()}</p>
          </Link></li>))}</ul>
      )}
      <Publish open={open} onClose={() => setOpen(false)} />
    </div>
  );
}

function Publish({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast(), qc = useQueryClient();
  const [aud, setAud] = useState<string[]>(['STUDENT', 'FACULTY']);
  const m = useMutation({
    mutationFn: (b: unknown) => api('/announcements', { method: 'POST', json: b }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['announcements'] }); toast('Announcement published'); onClose(); },
    onError: (e) => toast((e as ApiError).issues?.[0]?.message ?? (e as Error).message, 'err'),
  });
  const submit = (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); const f = new FormData(e.currentTarget); m.mutate({ title: f.get('title'), body: f.get('body'), category: f.get('category'), priority: f.get('priority'), audience: aud }); };
  return (
    <Modal open={open} onClose={onClose} title="Publish announcement">
      <form onSubmit={submit} className="space-y-3">
        <input name="title" required placeholder="Title" aria-label="Title" className="input" />
        <textarea name="body" required rows={4} placeholder="Message" aria-label="Message" className="input" />
        <div className="grid grid-cols-2 gap-3">
          <select name="category" aria-label="Category" className="input">{CATS.slice(1).map((c) => <option key={c}>{c}</option>)}</select>
          <select name="priority" aria-label="Priority" defaultValue="MEDIUM" className="input">{['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map((c) => <option key={c}>{c}</option>)}</select>
        </div>
        <fieldset className="flex flex-wrap gap-3 text-sm"><legend className="mb-1 font-medium">Audience</legend>
          {['STUDENT', 'FACULTY', 'STAFF', 'ADMIN'].map((r) => <label key={r} className="flex items-center gap-1.5"><input type="checkbox" checked={aud.includes(r)} onChange={() => setAud((a) => (a.includes(r) ? a.filter((x) => x !== r) : [...a, r]))} />{r[0] + r.slice(1).toLowerCase()}</label>)}
        </fieldset>
        <button disabled={m.isPending} className="btn-primary w-full">Publish</button>
      </form>
    </Modal>
  );
}
