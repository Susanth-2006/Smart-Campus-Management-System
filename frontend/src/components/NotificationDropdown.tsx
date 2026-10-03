import { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell } from 'lucide-react';
import { api } from '../services/api';
import { AppNotification } from '../types';
import { useClickOutside } from '../hooks/useClickOutside';

export function NotificationDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(ref, close);
  const nav = useNavigate();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['notifications'], queryFn: () => api<{ items: AppNotification[]; unreadCount: number }>('/notifications'), refetchInterval: 30_000 });
  const read = useMutation({ mutationFn: (id: string) => api(`/notifications/${id}/read`, { method: 'PATCH' }), onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }) });
  const readAll = useMutation({ mutationFn: () => api('/notifications/read-all', { method: 'PATCH' }), onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }) });
  const unread = data?.unreadCount ?? 0;

  return (
    <div ref={ref} className="relative">
      <button aria-label={`Notifications, ${unread} unread`} onClick={() => setOpen((o) => !o)} className="relative rounded-lg p-2 text-white/90 hover:bg-white/10">
        <Bell size={20} />
        {unread > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-peach px-1 text-[10px] font-bold text-navy">
            <span className="absolute inset-0 animate-ping rounded-full bg-peach/60" />
            <span className="relative">{unread}</span>
          </span>
        )}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
            className="absolute right-0 top-full z-50 mt-2 w-[22rem] max-w-[92vw] rounded-2xl border border-line bg-white shadow-soft">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <h2 className="text-sm font-semibold">Notifications</h2>
              {unread > 0 && <button onClick={() => readAll.mutate()} className="text-xs font-medium text-clay hover:underline">Mark all read</button>}
            </div>
            <ul className="max-h-96 overflow-y-auto">
              {!data?.items.length && <li className="px-4 py-8 text-center text-sm text-slate">You're all caught up.</li>}
              {data?.items.map((n) => (
                <li key={n.id}>
                  <button
                    onClick={() => { if (!n.read) read.mutate(n.id); close(); if (n.link) nav(n.link); }}
                    className={`flex w-full gap-3 px-4 py-3 text-left hover:bg-peach/15 ${n.read ? '' : 'bg-peach/10'}`}
                  >
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read ? 'bg-line' : 'bg-clay'}`} />
                    <span>
                      <span className="block text-sm font-medium text-navy">{n.message}</span>
                      <span className="text-xs text-slate">{new Date(n.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
