import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { api } from '../services/api';
import { useApi } from '../services/queries';
import { Announcement } from '../types';
import { ErrorState, Skeleton } from '../components/ui';

export default function AnnouncementDetail() {
  const { id } = useParams();
  const qc = useQueryClient();
  const list = useApi<Announcement[]>(['announcements', 'ALL', '', false], '/announcements?category=ALL&q=&unread=false');
  const a = list.data?.find((x) => x.id === id);
  useEffect(() => { if (a && !a.read) api(`/announcements/${a.id}/read`, { method: 'PATCH' }).then(() => qc.invalidateQueries({ queryKey: ['announcements'] })); }, [a, qc]);
  if (list.isLoading) return <Skeleton className="h-64" />;
  if (!a) return <ErrorState text="This announcement is not available." />;
  return (
    <article className="card mx-auto max-w-3xl">
      <Link to="/campus/announcements" className="mb-3 inline-flex items-center gap-1 text-sm text-clay"><ArrowLeft size={14} />Back to announcements</Link>
      <span className="ml-3 rounded-full bg-peach/30 px-2.5 py-0.5 text-xs font-semibold text-clay">{a.category.toLowerCase()}</span>
      <h1 className="mt-2 font-display text-4xl">{a.title}</h1>
      <p className="mb-4 text-sm text-slate">{new Date(a.createdAt).toLocaleString()} · {a.priority.toLowerCase()} priority</p>
      <p className="whitespace-pre-line leading-relaxed">{a.body}</p>
    </article>
  );
}
