import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, ClipboardList, Hammer, Inbox } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { useComplaints } from '../services/queries';
import { firstName, greeting, STATUS_LABEL } from '../utils/format';
import { EmptyState, ErrorState, Skeleton, StatCard } from '../components/ui';
import { useToast } from '../components/Toast';

export function StaffDashboard() {
  const { user } = useAuth();
  const { data, isLoading } = useComplaints();
  const t = data ?? [];
  const count = (s: string) => t.filter((c) => c.status === s).length;
  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-navy p-6 text-white sm:p-8"><h1 className="font-display text-3xl sm:text-4xl">{greeting()}, {firstName(user!.name)}.</h1><p className="text-white/70">Here's your work queue for today.</p></section>
      {isLoading ? <Skeleton className="h-32" /> : (
        <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Open tasks" value={t.filter((c) => !['RESOLVED', 'CLOSED'].includes(c.status)).length} to="/tasks" icon={<Inbox size={18} />} />
          <StatCard label="Assigned" value={count('ASSIGNED')} to="/tasks?status=ASSIGNED" icon={<ClipboardList size={18} />} />
          <StatCard label="In progress" value={count('IN_PROGRESS')} to="/tasks?status=IN_PROGRESS" icon={<Hammer size={18} />} />
          <StatCard label="Resolved" value={count('RESOLVED') + count('CLOSED')} to="/tasks?status=RESOLVED" icon={<CheckCircle2 size={18} />} />
        </section>)}
      <StaffTasks embedded />
    </div>
  );
}

export function StaffTasks({ embedded = false }: { embedded?: boolean }) {
  const [sp] = useSearchParams();
  const status = sp.get('status');
  const { data, isLoading, isError, refetch } = useComplaints();
  const toast = useToast(), qc = useQueryClient();
  const act = useMutation({
    mutationFn: (v: { id: string; status: string; note: string }) => api(`/complaints/${v.id}/status`, { method: 'PATCH', json: { status: v.status, note: v.note } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['complaints'] }); toast('Task updated'); },
    onError: (e) => toast((e as Error).message, 'err'),
  });
  const rows = (data ?? []).filter((c) => (status ? c.status === status : embedded ? !['RESOLVED', 'CLOSED'].includes(c.status) : true));
  return (
    <section className={embedded ? 'card' : 'space-y-5'}>
      <h2 className="mb-3 font-display text-3xl">{embedded ? 'Assigned tasks' : 'Assigned Tasks'}</h2>
      {isLoading ? <Skeleton className="h-40" /> : isError ? <ErrorState text="Unable to load tasks." onRetry={() => refetch()} /> : !rows.length ? <EmptyState text="No tasks here. Nice work!" /> : (
        <ul className="space-y-3">{rows.map((c: any) => (
          <li key={c.id} className="rounded-2xl border border-line bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <Link to={`/campus/complaints/${c.id}`} className="font-semibold hover:text-clay">#{c.ticketNo} {c.title}</Link>
              <span className="rounded-full bg-peach/30 px-3 py-1 text-xs font-semibold text-clay">{STATUS_LABEL[c.status]}</span>
            </div>
            <p className="text-xs text-slate">{c.location} · {c.priority.toLowerCase()} · reported by {c.student?.user.name ?? 'student'} · {new Date(c.createdAt).toLocaleDateString()}</p>
            <div className="mt-3 flex gap-2">
              {c.status === 'ASSIGNED' && <button className="btn-primary !py-1.5" onClick={() => act.mutate({ id: c.id, status: 'IN_PROGRESS', note: 'Task accepted' })}>Accept</button>}
              {c.status === 'IN_PROGRESS' && <button className="btn-accent !py-1.5" onClick={() => act.mutate({ id: c.id, status: 'RESOLVED', note: 'Issue resolved' })}>Mark resolved</button>}
              <Link to={`/campus/complaints/${c.id}`} className="btn-ghost !py-1.5">Update / add note</Link>
            </div>
          </li>))}</ul>)}
    </section>
  );
}
