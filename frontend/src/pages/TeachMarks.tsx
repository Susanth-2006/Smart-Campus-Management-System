import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { useApi } from '../services/queries';
import { Course, MarkRecord, Person } from '../types';
import { gradeOf, MAX } from '../utils/format';
import { EmptyState, ErrorState, Skeleton } from '../components/ui';
import { useToast } from '../components/Toast';

const KEYS = ['internal', 'assignment', 'midExam', 'finalExam'] as const;
const LABEL = { internal: 'Internal', assignment: 'Assignment', midExam: 'Mid', finalExam: 'Final' };
type Row = Record<(typeof KEYS)[number], string>;

export default function TeachMarks() {
  const toast = useToast(), qc = useQueryClient();
  const courses = useApi<Course[]>(['courses', false, ''], '/courses?mine=true&q=');
  const [picked, setPicked] = useState('');
  const courseId = picked || courses.data?.[0]?.id || '';
  const roster = useApi<{ items: Person[] }>(['roster', courseId], `/students?courseId=${courseId}&limit=100`, !!courseId);
  const existing = useApi<MarkRecord[]>(['marks', 'course', courseId], `/marks?courseId=${courseId}`, !!courseId);
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [publish, setPublish] = useState(false);

  useEffect(() => {
    const by = new Map((existing.data ?? []).map((m) => [m.studentId, m] as const));
    setRows(Object.fromEntries((roster.data?.items ?? []).map((s) => { const m = by.get(s.id); return [s.id, Object.fromEntries(KEYS.map((k) => [k, m?.[k] != null ? String(m[k]) : ''])) as Row]; })));
    setDirty(new Set()); setPublish(!!existing.data?.length && existing.data.every((m) => m.published));
  }, [roster.data, existing.data]);

  const err = (r: Row, k: (typeof KEYS)[number]) => r[k] !== '' && (isNaN(Number(r[k])) || Number(r[k]) < 0 || Number(r[k]) > MAX[k]);
  const total = (r: Row) => KEYS.reduce((a, k) => a + (Number(r[k]) || 0), 0);
  const invalid = Object.values(rows).some((r) => KEYS.some((k) => err(r, k)));

  const save = useMutation({
    mutationFn: async () => {
      for (const id of dirty.size ? dirty : new Set(Object.keys(rows))) {
        const r = rows[id];
        await api('/marks', { method: 'POST', json: { studentId: id, courseId, published: publish, ...Object.fromEntries(KEYS.map((k) => [k, r[k] === '' ? null : Number(r[k])])) } });
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['marks'] }); qc.invalidateQueries({ queryKey: ['notifications'] }); toast(publish ? 'Marks saved and published.' : 'Marks saved as draft.'); },
    onError: (e) => toast((e as Error).message, 'err'),
  });
  const edit = (id: string, k: (typeof KEYS)[number], v: string) => { setRows((x) => ({ ...x, [id]: { ...x[id], [k]: v } })); setDirty((d) => new Set(d).add(id)); };

  return (
    <div className="space-y-5">
      <header><h1 className="font-display text-4xl">Marks</h1><p className="text-slate">Totals and grades are calculated automatically (out of 100).</p></header>
      <div className="card flex flex-wrap items-end gap-4">
        <label className="flex-1 text-sm font-medium">Course<select value={courseId} onChange={(e) => setPicked(e.target.value)} className="input mt-1">{courses.data?.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.name}</option>)}</select></label>
        <label className="flex items-center gap-2 pb-2.5 text-sm"><input type="checkbox" checked={publish} onChange={(e) => setPublish(e.target.checked)} />Publish to students</label>
        <button disabled={invalid || save.isPending || !Object.keys(rows).length} onClick={() => save.mutate()} className="btn-primary">{save.isPending ? 'Saving…' : 'Save Marks'}</button>
      </div>
      {roster.isLoading || existing.isLoading ? <Skeleton className="h-64" /> : roster.isError ? <ErrorState text="Unable to load students." onRetry={() => roster.refetch()} /> : !roster.data?.items.length ? <EmptyState text="No students enrolled." /> : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm"><thead><tr className="text-left text-slate"><th className="py-2">Student</th>{KEYS.map((k) => <th key={k}>{LABEL[k]} <span className="text-xs">/{MAX[k]}</span></th>)}<th>Total</th><th>Grade</th></tr></thead>
            <tbody>{roster.data.items.map((s) => { const r = rows[s.id]; if (!r) return null; const t = total(r); return (
              <tr key={s.id} className="border-t border-line"><td className="py-2"><span className="block font-medium">{s.user.name}</span><span className="text-xs text-slate">{s.rollNo}</span></td>
                {KEYS.map((k) => <td key={k}><input aria-label={`${LABEL[k]} marks for ${s.user.name}`} aria-invalid={err(r, k)} inputMode="decimal" value={r[k]} onChange={(e) => edit(s.id, k, e.target.value)} className={`w-16 rounded-lg border px-2 py-1.5 ${err(r, k) ? 'border-clay bg-peach/30' : 'border-line'}`} /></td>)}
                <td className="font-semibold">{t}</td><td className="font-bold text-clay">{gradeOf(t)}</td></tr>); })}</tbody></table>
          {invalid && <p role="alert" className="pt-3 text-sm text-clay">Some values are outside the allowed range.</p>}
        </div>
      )}
    </div>
  );
}
