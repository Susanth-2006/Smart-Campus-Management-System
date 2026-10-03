import { Check } from 'lucide-react';
import { ComplaintFull } from '../types';
import { FLOW, STATUS_LABEL } from '../utils/format';

export function ComplaintTimeline({ complaint }: { complaint: ComplaintFull }) {
  const events = complaint.events ?? [];
  const reached = FLOW.indexOf(complaint.status);
  return (
    <ol className="relative space-y-1">
      {FLOW.map((stage, i) => {
        const evs = events.filter((e) => e.status === stage);
        const done = i <= reached, current = i === reached;
        return (
          <li key={stage} className="flex gap-4">
            <div className="flex flex-col items-center">
              <span className={`flex h-8 w-8 items-center justify-center rounded-full border-2 ${done ? 'border-clay bg-clay text-white' : 'border-line bg-white text-slate'} ${current ? 'ring-4 ring-peach/40' : ''}`}>{done ? <Check size={16} /> : i + 1}</span>
              {i < FLOW.length - 1 && <span className={`my-1 w-0.5 flex-1 ${i < reached ? 'bg-clay' : 'bg-line'}`} />}
            </div>
            <div className="pb-6">
              <p className={`font-semibold ${done ? 'text-navy' : 'text-slate'}`}>{STATUS_LABEL[stage]}</p>
              {evs.map((e) => (
                <div key={e.id} className="mt-1 text-sm text-slate">
                  <p>{new Date(e.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}{e.actor && ` · ${e.actor.name}`}</p>
                  {e.note && <p className="mt-0.5 rounded-lg bg-peach/20 px-3 py-1.5 text-navy">{e.note}</p>}
                </div>
              ))}
              {!evs.length && !done && <p className="text-sm text-slate">Pending</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
