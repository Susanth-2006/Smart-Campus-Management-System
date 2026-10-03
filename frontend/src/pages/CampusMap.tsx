import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Clock, MapPin } from 'lucide-react';
import { useApi } from '../services/queries';
import { Facility } from '../types';
import { catLabel, FACILITY_CATS } from './Facilities';
import { ErrorState, Skeleton } from '../components/ui';

const PIN: Record<string, string> = { ACADEMIC: 'text-navy', LAB: 'text-navy', LIBRARY: 'text-navy', SPORTS: 'text-clay', FOOD: 'text-clay', HOSTEL: 'text-slate', ADMIN: 'text-slate', MEDICAL: 'text-clay', OTHER: 'text-peach' };

export default function CampusMap() {
  const [sp] = useSearchParams();
  const { data, isLoading, isError, refetch } = useApi<Facility[]>(['facilities', 'ALL', ''], '/facilities?q=');
  const [picked, setPicked] = useState<string | null>(null), [cat, setCat] = useState('ALL');
  if (isLoading) return <Skeleton className="h-96" />;
  if (isError || !data) return <ErrorState text="Unable to load the map." onRetry={() => refetch()} />;
  const active = data.find((f) => f.id === (picked ?? sp.get('focus')));
  const shown = (f: Facility) => cat === 'ALL' || f.category === cat;

  return (
    <div className="space-y-5">
      <header><h1 className="font-display text-4xl">Campus Map</h1><p className="text-slate">Tap a pin or pick a place from the list.</p></header>
      <div className="flex flex-wrap gap-2">{FACILITY_CATS.map((c) => <button key={c} aria-pressed={cat === c} onClick={() => setCat(c)} className={`rounded-full px-3 py-1 text-xs font-semibold ${cat === c ? 'bg-navy text-white' : 'border border-line bg-white text-slate'}`}>{catLabel(c)}</button>)}</div>
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="relative aspect-[16/11] overflow-hidden rounded-3xl border border-line bg-[#F3E9E2] lg:col-span-2">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden className="absolute inset-0 h-full w-full">
            <rect x="6" y="6" width="88" height="42" rx="3" fill="#0F3040" opacity=".07" />
            <rect x="4" y="54" width="30" height="38" rx="3" fill="#D99B7F" opacity=".22" />
            <rect x="62" y="54" width="34" height="38" rx="3" fill="#D99B7F" opacity=".22" />
            <path d="M0 50 H100 M50 0 V100 M30 50 V6 M70 50 V6" stroke="#fff" strokeWidth="1.6" fill="none" />
          </svg>
          {data.map((f) => (
            <button key={f.id} aria-label={f.name} title={f.name} onClick={() => setPicked(f.id)}
              style={{ left: `${f.mapX}%`, top: `${f.mapY}%` }}
              className={`absolute -translate-x-1/2 -translate-y-full transition ${shown(f) ? '' : 'opacity-20'} ${active?.id === f.id ? 'z-10 scale-125' : 'hover:scale-110'} ${PIN[f.category] ?? 'text-navy'}`}>
              <MapPin size={active?.id === f.id ? 32 : 26} fill="currentColor" className="drop-shadow" stroke="#fff" />
            </button>
          ))}
          {active && <span className="absolute bottom-3 left-3 rounded-xl bg-white/90 px-3 py-1.5 text-sm font-semibold shadow-soft">{active.name}</span>}
        </div>

        <aside className="space-y-4">
          <div className="card min-h-40">
            {active ? (
              <>
                <span className="rounded-full bg-peach/30 px-3 py-1 text-xs font-bold text-clay">{catLabel(active.category)}</span>
                <h2 className="mt-2 font-display text-2xl">{active.name}</h2>
                <p className="text-sm text-slate">{active.building}{active.floor ? ` · ${active.floor}` : ''}</p>
                <p className="mt-2 text-sm">{active.description}</p>
                <p className="mt-2 flex items-center gap-2 text-sm text-slate"><Clock size={14} className="text-clay" />{active.hours}</p>
              </>
            ) : <p className="text-sm text-slate">Select a place on the map to see its details.</p>}
          </div>
          <ul className="card max-h-72 divide-y divide-line overflow-y-auto !p-2">
            {data.filter(shown).map((f) => (
              <li key={f.id}><button onClick={() => setPicked(f.id)} className={`w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-peach/20 ${active?.id === f.id ? 'bg-peach/25 font-semibold' : ''}`}>{f.name}<span className="block text-xs text-slate">{f.building}</span></button></li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}
