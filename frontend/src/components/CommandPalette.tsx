import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { NAV } from '../utils/navConfig';
import { Modal } from './ui';

interface Hit { type: string; label: string; sub?: string; to: string }

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const nav = useNavigate();
  const [q, setQ] = useState(''), [idx, setIdx] = useState(0), [dq, setDq] = useState('');
  useEffect(() => { const t = setTimeout(() => setDq(q), 180); return () => clearTimeout(t); }, [q]);
  useEffect(() => { if (open) { setQ(''); setIdx(0); } }, [open]);
  const remote = useQuery({ queryKey: ['search', dq], queryFn: () => api<Hit[]>(`/search?q=${encodeURIComponent(dq)}`), enabled: open && dq.length >= 2 });

  const pages = useMemo<Hit[]>(() => user ? NAV[user.role].flatMap((i) => i.children ?? (i.to ? [{ label: i.label, to: i.to }] : [])).map((p) => ({ type: 'Page', label: p.label, to: p.to })) : [], [user]);
  const hits = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const local = needle ? pages.filter((p) => p.label.toLowerCase().includes(needle)) : pages.slice(0, 6);
    return [...(remote.data ?? []), ...local].slice(0, 12);
  }, [q, pages, remote.data]);

  const go = (h: Hit) => { onClose(); nav(h.to); };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(i + 1, hits.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
    if (e.key === 'Enter' && hits[idx]) go(hits[idx]);
  };

  return (
    <Modal open={open} onClose={onClose} title="Search">
      <div className="relative">
        <Search size={16} className="absolute left-3 top-3.5 text-slate" />
        <input autoFocus aria-label="Search campus" value={q} onChange={(e) => { setQ(e.target.value); setIdx(0); }} onKeyDown={onKey} placeholder="Courses, people, announcements, pages…" className="input !pl-9" />
      </div>
      <ul role="listbox" className="mt-3 max-h-80 overflow-y-auto">
        {!hits.length && <li className="py-6 text-center text-sm text-slate">No results for “{q}”.</li>}
        {hits.map((h, i) => (
          <li key={h.type + h.to + h.label} role="option" aria-selected={i === idx}>
            <button onMouseEnter={() => setIdx(i)} onClick={() => go(h)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left ${i === idx ? 'bg-peach/25' : ''}`}>
              <span className="w-24 shrink-0 text-xs font-semibold uppercase tracking-wide text-clay">{h.type}</span>
              <span className="flex-1 text-sm"><span className="block font-medium">{h.label}</span>{h.sub && <span className="text-xs text-slate">{h.sub}</span>}</span>
            </button>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
