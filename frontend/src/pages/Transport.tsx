import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Bus, Phone, Users } from 'lucide-react';
import { api } from '../services/api';
import { useApi } from '../services/queries';
import { RouteStop, TransportPass, TransportRoute } from '../types';
import { fmtTime } from '../utils/format';
import { EmptyState, ErrorState, Modal, Skeleton } from '../components/ui';
import { useToast } from '../components/Toast';

function nextBus(stop: RouteStop) {
  const [h, m] = stop.pickupTime.split(':').map(Number);
  const now = new Date(), diff = h * 60 + m - (now.getHours() * 60 + now.getMinutes());
  return diff >= 0 ? `Your bus reaches ${stop.name} at ${fmtTime(stop.pickupTime)} (in ${diff} min).` : `Today's bus has passed ${stop.name}. Next pickup tomorrow at ${fmtTime(stop.pickupTime)}.`;
}

export default function Transport() {
  const toast = useToast(), qc = useQueryClient();
  const routes = useApi<TransportRoute[]>(['transport', 'routes'], '/transport/routes');
  const mine = useApi<TransportPass | null>(['transport', 'mine'], '/transport/my-route');
  const [choose, setChoose] = useState<TransportRoute | null>(null);
  const set = useMutation({
    mutationFn: (v: { routeId: string; stopId: string }) => api('/transport/my-route', { method: 'PUT', json: v }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['transport'] }); toast('Your route has been saved'); setChoose(null); },
    onError: (e) => toast((e as Error).message, 'err'),
  });
  const clear = useMutation({
    mutationFn: () => api('/transport/my-route', { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['transport'] }); toast('Route removed'); },
    onError: (e) => toast((e as Error).message, 'err'),
  });

  return (
    <div className="space-y-5">
      <header><h1 className="font-display text-4xl">Transport</h1><p className="text-slate">College bus routes, stops and pickup times.</p></header>

      {mine.data && (
        <section className="rounded-3xl bg-navy p-5 text-white">
          <p className="text-sm font-semibold uppercase tracking-widest text-peach">My route</p>
          <h2 className="font-display text-2xl">{mine.data.route.number} · {mine.data.route.name}</h2>
          <p className="mt-1 text-white/80">{nextBus(mine.data.stop)}</p>
          <p className="text-sm text-white/60">Bus {mine.data.route.vehicleNo} · Driver {mine.data.route.driverName} ({mine.data.route.driverPhone})</p>
          <button disabled={clear.isPending} onClick={() => clear.mutate()} className="btn mt-3 border border-white/30 !py-1.5 text-white hover:bg-white/10">Remove my route</button>
        </section>
      )}

      {routes.isLoading ? <Skeleton className="h-64" /> : routes.isError ? <ErrorState text="Unable to load routes." onRetry={() => routes.refetch()} /> : !routes.data?.length ? <EmptyState text="No routes available." /> : (
        <div className="grid gap-4 lg:grid-cols-2">
          {routes.data.map((r) => {
            const mineHere = mine.data?.route.id === r.id, full = r._count.passes >= r.capacity && !mineHere;
            return (
              <article key={r.id} className={`card ${mineHere ? '!border-clay' : ''}`}>
                <div className="flex items-start justify-between gap-2">
                  <div><p className="flex items-center gap-2 text-xs font-bold text-clay"><Bus size={14} />Route {r.number}</p><h2 className="font-display text-2xl">{r.name}</h2></div>
                  <span className="flex items-center gap-1 text-xs text-slate"><Users size={14} />{r._count.passes}/{r.capacity}</span>
                </div>
                <ol className="my-4 space-y-2 border-l-2 border-line pl-4">
                  {r.stops.map((s) => (
                    <li key={s.id} className="relative flex justify-between text-sm">
                      <span className={`absolute -left-[1.4rem] top-1.5 h-2.5 w-2.5 rounded-full ${mine.data?.stop.id === s.id ? 'bg-clay' : 'bg-peach'}`} />
                      <span className={mine.data?.stop.id === s.id ? 'font-semibold' : ''}>{s.name}</span><span className="text-slate">{fmtTime(s.pickupTime)}</span>
                    </li>
                  ))}
                </ol>
                <p className="mb-3 flex items-center gap-2 text-xs text-slate"><Phone size={12} />{r.driverName} · {r.driverPhone} · {r.vehicleNo}</p>
                <button disabled={full} onClick={() => setChoose(r)} className={mineHere ? 'btn-ghost w-full' : 'btn-primary w-full'}>{full ? 'Route is full' : mineHere ? 'Change my stop' : 'Use this route'}</button>
              </article>
            );
          })}
        </div>
      )}

      <Modal open={!!choose} onClose={() => setChoose(null)} title={choose ? `Choose your stop · ${choose.number}` : ''}>
        <ul className="space-y-1">
          {choose?.stops.map((s) => (
            <li key={s.id}><button disabled={set.isPending} onClick={() => set.mutate({ routeId: choose.id, stopId: s.id })} className="flex w-full justify-between rounded-xl px-3 py-2.5 text-left text-sm hover:bg-peach/25"><span className="font-medium">{s.name}</span><span className="text-slate">{fmtTime(s.pickupTime)}</span></button></li>
          ))}
        </ul>
      </Modal>
    </div>
  );
}
