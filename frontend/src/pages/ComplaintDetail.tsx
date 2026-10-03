import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { useApi } from '../services/queries';
import { ComplaintFull } from '../types';
import { assetUrl } from '../services/upload';
import { FLOW, STATUS_LABEL } from '../utils/format';
import { ComplaintTimeline } from '../components/ComplaintTimeline';
import { ErrorState, Skeleton } from '../components/ui';
import { useToast } from '../components/Toast';

export default function ComplaintDetail() {
  const { id } = useParams();
  const { user } = useAuth(), toast = useToast(), qc = useQueryClient();
  const q = useApi<ComplaintFull>(['complaint', id], `/complaints/${id}`);
  const staff = useApi<{ id: string; staffType: string; user: { name: string } }[]>(['staff'], '/staff', user!.role === 'ADMIN');
  const [note, setNote] = useState(''), [next, setNext] = useState(''), [staffId, setStaffId] = useState('');
  const update = useMutation({
    mutationFn: (b: { status: string; note?: string; staffId?: string }) => api(`/complaints/${id}/status`, { method: 'PATCH', json: { ...b, note: b.note || undefined } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['complaint', id] }); qc.invalidateQueries({ queryKey: ['complaints'] }); qc.invalidateQueries({ queryKey: ['notifications'] }); setNote(''); toast('Complaint updated'); },
    onError: (e) => toast((e as Error).message, 'err'),
  });
  if (q.isLoading) return <Skeleton className="h-96" />;
  if (q.isError || !q.data) return <ErrorState text="Unable to load this complaint." onRetry={() => q.refetch()} />;
  const c = q.data, role = user!.role, idx = FLOW.indexOf(c.status);
  const later = FLOW.slice(idx + 1);

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <section className="card lg:col-span-3">
        <h2 className="mb-4 font-display text-2xl">What happened to this complaint?</h2>
        <ComplaintTimeline complaint={c} />
      </section>
      <aside className="space-y-4 lg:col-span-2">
        <div className="card">
          <p className="text-xs text-slate">#{c.ticketNo} · {c.category.toLowerCase()} · {c.priority.toLowerCase()} priority</p>
          <h1 className="font-display text-2xl">{c.title}</h1>
          <p className="mt-2 text-sm text-slate">{c.description}</p>
          <p className="mt-3 text-sm"><b>Location:</b> {c.location}</p>
          {c.imageUrl && <a href={assetUrl(c.imageUrl)} target="_blank" rel="noopener noreferrer"><img src={assetUrl(c.imageUrl)} alt="Photo attached to this complaint" className="mt-3 max-h-56 rounded-xl border border-line" /></a>}
          {c.student && <p className="text-sm"><b>Reported by:</b> {c.student.user.name} ({c.student.rollNo})</p>}
          {c.task && <p className="text-sm"><b>Assigned to:</b> {c.task.staff.user.name} ({c.task.staff.staffType})</p>}
          <span className="mt-3 inline-block rounded-full bg-peach/30 px-3 py-1 text-xs font-semibold text-clay">{STATUS_LABEL[c.status]}</span>
        </div>

        {role === 'STUDENT' && c.status === 'RESOLVED' && (
          <div className="card"><p className="mb-2 text-sm">Is the issue fixed?</p><button className="btn-primary w-full" onClick={() => update.mutate({ status: 'CLOSED', note: 'Closed by student' })}>Confirm & close</button></div>
        )}
        {role === 'ADMIN' && later.length > 0 && (
          <div className="card space-y-3">
            <h2 className="font-semibold">Update status</h2>
            <select aria-label="New status" value={next} onChange={(e) => setNext(e.target.value)} className="input"><option value="">Choose next status</option>{later.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}</select>
            {next === 'ASSIGNED' && <select aria-label="Assign to" value={staffId} onChange={(e) => setStaffId(e.target.value)} className="input"><option value="">Assign to…</option>{staff.data?.map((s) => <option key={s.id} value={s.id}>{s.user.name} · {s.staffType}</option>)}</select>}
            <textarea aria-label="Note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note" rows={2} className="input" />
            <button disabled={!next || (next === 'ASSIGNED' && !staffId) || update.isPending} onClick={() => update.mutate({ status: next, note, staffId: next === 'ASSIGNED' ? staffId : undefined })} className="btn-primary w-full">Save update</button>
          </div>
        )}
        {role === 'STAFF' && ['ASSIGNED', 'IN_PROGRESS'].includes(c.status) && (
          <div className="card space-y-3">
            <h2 className="font-semibold">Your task</h2>
            <textarea aria-label="Note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note" rows={2} className="input" />
            {c.status === 'ASSIGNED' && <button onClick={() => update.mutate({ status: 'IN_PROGRESS', note: note || 'Task accepted' })} className="btn-primary w-full">Accept & start</button>}
            {c.status === 'IN_PROGRESS' && <>
              <button disabled={!note} onClick={() => update.mutate({ status: 'IN_PROGRESS', note })} className="btn-ghost w-full">Add note</button>
              <button onClick={() => update.mutate({ status: 'RESOLVED', note: note || 'Issue resolved' })} className="btn-accent w-full">Mark resolved</button></>}
          </div>
        )}
      </aside>
    </div>
  );
}
