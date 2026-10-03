import { Link, useLocation } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

const LABELS: Record<string, string> = { dashboard: 'Dashboard', academics: 'Academics', campus: 'Campus', services: 'Services', teaching: 'Teaching', management: 'Management', reports: 'Reports', system: 'System', tasks: 'Tasks' };
const GROUPS = new Set(['academics', 'campus', 'services', 'teaching', 'management', 'reports', 'system']);
const pretty = (s: string) => LABELS[s] ?? (/^[0-9a-f-]{20,}$/i.test(s) ? 'Details' : s.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()));

export function Breadcrumbs() {
  const parts = useLocation().pathname.split('/').filter(Boolean);
  if (parts.length <= 1) return null;
  const crumbs = [{ label: 'Dashboard', to: '/dashboard' }, ...parts.map((p, i) => ({ label: pretty(p), to: '/' + parts.slice(0, i + 1).join('/') }))];
  return (
    <nav aria-label="Breadcrumb" className="mx-auto max-w-7xl px-4 pt-5 sm:px-6">
      <ol className="flex flex-wrap items-center gap-1 text-sm text-slate">
        {crumbs.map((c, i) => (
          <li key={c.to} className="flex items-center gap-1">
            {i > 0 && <ChevronRight size={14} />}
            {i === crumbs.length - 1 ? <span aria-current="page" className="font-semibold text-navy">{c.label}</span> : i > 0 && GROUPS.has(c.to.split('/').pop()!) && c.to.split('/').length === 2 ? <span>{c.label}</span> : <Link to={c.to} className="hover:text-clay hover:underline">{c.label}</Link>}
          </li>
        ))}
      </ol>
    </nav>
  );
}
