import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, MapPin, Search, Users } from 'lucide-react';
import { useApi } from '../services/queries';
import { Facility } from '../types';
import { EmptyState, ErrorState, Skeleton } from '../components/ui';

export const FACILITY_CATS = ['ALL', 'ACADEMIC', 'LAB', 'LIBRARY', 'SPORTS', 'FOOD', 'HOSTEL', 'ADMIN', 'MEDICAL', 'OTHER'];
export const catLabel = (c: string) => c[0] + c.slice(1).toLowerCase();

export default function Facilities() {
  const [cat, setCat] = useState('ALL'), [q, setQ] = useState('');
  const { data, isLoading, isError, refetch } = useApi<Facility[]>(['facilities', cat, q], `/facilities?${cat !== 'ALL' ? `category=${cat}&` : ''}q=${encodeURIComponent(q)}`);
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="font-display text-4xl">Facilities</h1><p className="text-slate">Where things are, when they are open, and how big they are.</p></div>
        <div className="flex gap-2">
          <div className="relative"><Search size={16} className="absolute left-3 top-3 text-slate" /><input aria-label="Search facilities" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search facilities" className="input !w-56 !pl-9" /></div>
          <Link to="/campus/map" className="btn-ghost"><MapPin size={16} />Campus Map</Link>
        </div>
      </header>
      <div className="flex flex-wrap gap-2">{FACILITY_CATS.map((c) => <button key={c} aria-pressed={cat === c} onClick={() => setCat(c)} className={`rounded-full px-4 py-1.5 text-sm font-semibold ${cat === c ? 'bg-navy text-white' : 'border border-line bg-white text-slate'}`}>{catLabel(c)}</button>)}</div>
      {isLoading ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-40" />)}</div> :
        isError ? <ErrorState text="Unable to load facilities. Try again." onRetry={() => refetch()} /> :
        !data?.length ? <EmptyState text="No facilities match." /> : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((f) => (
            <article key={f.id} className="card flex flex-col transition hover:-translate-y-0.5">
              <span className="w-fit rounded-full bg-peach/30 px-3 py-1 text-xs font-bold text-clay">{catLabel(f.category)}</span>
              <h2 className="mt-2 font-display text-2xl">{f.name}</h2>
              <p className="text-sm text-slate">{f.building}{f.floor ? ` · ${f.floor}` : ''}</p>
              <p className="mt-2 text-sm">{f.description}</p>
              <p className="mt-3 flex items-center gap-2 text-sm text-slate"><Clock size={14} className="text-clay" />{f.hours}</p>
              {f.capacity ? <p className="flex items-center gap-2 text-sm text-slate"><Users size={14} className="text-clay" />Capacity {f.capacity}</p> : null}
              <Link to={`/campus/map?focus=${f.id}`} className="btn-ghost mt-auto !py-1.5 pt-0">Show on map</Link>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
