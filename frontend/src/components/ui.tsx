import { ReactNode, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, Inbox, X } from 'lucide-react';

export const Skeleton = ({ className = 'h-24' }: { className?: string }) => <div aria-hidden className={`animate-pulse rounded-2xl bg-line/70 ${className}`} />;

export function EmptyState({ text }: { text: string }) {
  return <div className="flex flex-col items-center gap-2 py-10 text-slate"><Inbox size={28} className="text-peach" /><p className="text-sm">{text}</p></div>;
}

export function ErrorState({ text, onRetry }: { text: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 py-10 text-slate">
      <AlertCircle size={28} className="text-clay" /><p className="text-sm">{text}</p>
      {onRetry && <button onClick={onRetry} className="btn-ghost !py-1.5">Try again</button>}
    </div>
  );
}

export function StatCard({ label, value, hint, to, icon }: { label: string; value: ReactNode; hint?: string; to?: string; icon?: ReactNode }) {
  const body = (
    <motion.div whileHover={{ y: -3 }} className="card h-full">
      <div className="flex items-center justify-between text-slate"><span className="text-sm font-medium">{label}</span>{icon}</div>
      <p className="mt-2 font-display text-4xl">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate">{hint}</p>}
    </motion.div>
  );
  return to ? <Link to={to} className="block rounded-2xl">{body}</Link> : body;
}

export function ProgressBar({ value, tone = 'bg-navy' }: { value: number; tone?: string }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <motion.div className={`h-full rounded-full ${tone}`} initial={{ width: 0 }} animate={{ width: `${Math.min(100, value)}%` }} transition={{ duration: 0.6, ease: 'easeOut' }} />
    </div>
  );
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[70] flex items-end justify-center bg-navy/50 p-4 sm:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()} initial={{ y: 24, scale: 0.97 }} animate={{ y: 0, scale: 1 }} exit={{ y: 16, opacity: 0 }}
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-soft">
            <div className="mb-3 flex items-start justify-between gap-4"><h2 className="font-display text-2xl">{title}</h2><button aria-label="Close" onClick={onClose} className="rounded-lg p-1 hover:bg-peach/20"><X size={20} /></button></div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
