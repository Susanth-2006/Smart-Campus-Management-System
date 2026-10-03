import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useComplaints } from '../services/queries';
import { FLOW, STATUS_LABEL } from '../utils/format';
import { EmptyState, ErrorState, Skeleton } from '../components/ui';

export default function Complaints() {
  const { user } = useAuth();
  const { data, isLoading, isError, refetch } = useComplaints();
  const [status, setStatus] = useState('');
  const rows = (data ?? []).filter((c) => !status || c.status === status);
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="font-display text-4xl">Complaints</h1><p className="text-slate">{user!.role === 'STUDENT' ? 'Report an issue and follow it until it is fixed.' : 'All reported campus issues.'}</p></div>
        {user!.role === 'STUDENT' && <Link to="/campus/complaints/new" className="btn-primary"><Plus size={16} />New Complaint</Link>}
      </header>
      <div className="flex flex-wrap gap-2">
        {['', ...FLOW].map((s) => <button key={s} aria-pressed={status === s} onClick={() => setStatus(s)} className={`rounded-full px-4 py-1.5 text-sm font-semibold ${status === s ? 'bg-navy text-white' : 'bg-white text-slate border border-line'}`}>{s ? STATUS_LABEL[s] : 'All'}</button>)}
      </div>
      {isLoading ? <Skeleton className="h-48" /> : isError ? <ErrorState text="Unable to load complaints. Try again." onRetry={() => refetch()} /> : !rows.length ? <EmptyState text="No complaints yet." /> : (
        <ul className="space-y-3">
          {rows.map((c) => (
            <li key={c.id}><Link to={`/campus/complaints/${c.id}`} className="card flex flex-wrap items-center justify-between gap-3 transition hover:-translate-y-0.5">
              <span><span className="text-xs text-slate">#{c.ticketNo} · {c.category.toLowerCase()} · {c.location}</span><span className="block font-semibold">{c.title}</span></span>
              <span className="flex items-center gap-2"><span className="text-xs text-slate">{c.priority.toLowerCase()}</span><span className="rounded-full bg-peach/30 px-3 py-1 text-xs font-semibold text-clay">{STATUS_LABEL[c.status]}</span></span>
            </Link></li>
          ))}
        </ul>
      )}
    </div>
  );
}
