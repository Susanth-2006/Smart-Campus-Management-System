import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useMarks } from '../services/queries';
import { gpa, MAX } from '../utils/format';
import { EmptyState, ErrorState, Modal, ProgressBar, Skeleton, StatCard } from '../components/ui';
import { MarkRecord } from '../types';

const PARTS = [['internal', 'Internal'], ['assignment', 'Assignment'], ['midExam', 'Mid exam'], ['finalExam', 'Final exam']] as const;

export default function Marks() {
  const { data, isLoading, isError, refetch } = useMarks();
  const [sel, setSel] = useState<MarkRecord | null>(null);
  if (isLoading) return <Skeleton className="h-96" />;
  if (isError) return <ErrorState text="Unable to load marks. Try again." onRetry={() => refetch()} />;
  if (!data?.length) return <EmptyState text="No marks have been published yet." />;
  const avg = Math.round((data.reduce((a, m) => a + m.total, 0) / data.length) * 10) / 10;
  const chart = data.map((m) => ({ name: m.course.code, total: m.total, full: m }));

  return (
    <div className="space-y-6">
      <header><h1 className="font-display text-4xl">Marks & Performance</h1><p className="text-slate">Tap a subject to see how each component contributed.</p></header>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3"><StatCard label="Semester GPA" value={gpa(data)} /><StatCard label="Average score" value={avg} hint="out of 100" /><StatCard label="Subjects" value={data.length} /></div>
      <section className="card">
        <h2 className="mb-3 font-display text-2xl">Subject comparison</h2>
        <div className="h-64"><ResponsiveContainer><BarChart data={chart} margin={{ left: -16 }}>
          <CartesianGrid stroke="#E8DFD9" vertical={false} /><XAxis dataKey="name" stroke="#464858" fontSize={12} /><YAxis domain={[0, 100]} stroke="#464858" fontSize={12} />
          <Tooltip cursor={{ fill: '#D99B7F33' }} contentStyle={{ borderRadius: 12, border: '1px solid #E8DFD9' }} />
          <Bar dataKey="total" fill="#A56F63" radius={[8, 8, 0, 0]} cursor="pointer" onClick={(d: any) => setSel(d.full)} />
        </BarChart></ResponsiveContainer></div>
      </section>
      <section className="card overflow-x-auto">
        <table className="w-full text-sm"><thead><tr className="text-left text-slate"><th className="py-2">Course</th><th>Total</th><th>Grade</th><th>Credits</th></tr></thead>
          <tbody>{data.map((m) => <tr key={m.id} onClick={() => setSel(m)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setSel(m)} className="cursor-pointer border-t border-line hover:bg-peach/15"><td className="py-3 font-medium">{m.course.code} · {m.course.name}</td><td>{m.total}</td><td><b className="text-clay">{m.grade}</b></td><td>{m.course.credits}</td></tr>)}</tbody></table>
      </section>
      <Modal open={!!sel} onClose={() => setSel(null)} title={sel?.course.name ?? ''}>
        {sel && <div className="space-y-3">{PARTS.map(([k, label]) => <div key={k}><div className="mb-1 flex justify-between text-sm"><span>{label}</span><span className="font-semibold">{sel[k] ?? 0} / {MAX[k]}</span></div><ProgressBar value={((sel[k] ?? 0) / MAX[k]) * 100} tone="bg-clay" /></div>)}<p className="pt-2 text-sm text-slate">Total <b className="text-navy">{sel.total}</b> · Grade <b className="text-clay">{sel.grade}</b></p></div>}
      </Modal>
    </div>
  );
}
