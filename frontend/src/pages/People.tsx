import { useMemo, useState } from 'react';
import { ArrowUpDown, Search } from 'lucide-react';
import { useApi } from '../services/queries';
import { Person } from '../types';
import { EmptyState, ErrorState, Skeleton } from '../components/ui';

export function StudentsList() {
  const [q, setQ] = useState(''), [sort, setSort] = useState<'name' | 'rollNo'>('name'), [asc, setAsc] = useState(true);
  const { data, isLoading, isError, refetch } = useApi<{ items: Person[]; total: number }>(['students', q], `/students?limit=100&q=${encodeURIComponent(q)}`);
  const rows = useMemo(() => [...(data?.items ?? [])].sort((a, b) => (sort === 'name' ? a.user.name.localeCompare(b.user.name) : (a.rollNo ?? '').localeCompare(b.rollNo ?? '')) * (asc ? 1 : -1)), [data, sort, asc]);
  const th = (k: 'name' | 'rollNo', label: string) => <th className="py-2"><button onClick={() => { setAsc(sort === k ? !asc : true); setSort(k); }} className="inline-flex items-center gap-1 font-semibold">{label}<ArrowUpDown size={12} /></button></th>;
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="font-display text-4xl">Students</h1><p className="text-slate">{data?.total ?? 0} students</p></div>
        <div className="relative"><Search size={16} className="absolute left-3 top-3 text-slate" /><input aria-label="Search students" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name or roll no." className="input !w-60 !pl-9" /></div></header>
      {isLoading ? <Skeleton className="h-64" /> : isError ? <ErrorState text="Unable to load students." onRetry={() => refetch()} /> : !rows.length ? <EmptyState text="No students found." /> : (
        <div className="card overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-slate">{th('rollNo', 'Roll no.')}{th('name', 'Name')}<th>Department</th><th>Section</th><th>Email</th></tr></thead>
          <tbody>{rows.map((s) => <tr key={s.id} className="border-t border-line hover:bg-peach/15"><td className="py-2.5 font-medium">{s.rollNo}</td><td>{s.user.name}</td><td>{s.department.name}</td><td>{s.section}</td><td className="text-slate">{s.user.email}</td></tr>)}</tbody></table></div>
      )}
    </div>
  );
}

export function FacultyList() {
  const { data, isLoading, isError, refetch } = useApi<(Person & { designation: string; _count: { courses: number } })[]>(['faculty'], '/faculty');
  return (
    <div className="space-y-5">
      <header><h1 className="font-display text-4xl">Faculty</h1><p className="text-slate">Teaching staff across departments.</p></header>
      {isLoading ? <Skeleton className="h-64" /> : isError ? <ErrorState text="Unable to load faculty." onRetry={() => refetch()} /> : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{data!.map((f) => (
          <div key={f.id} className="card"><p className="font-semibold">{f.user.name}</p><p className="text-sm text-slate">{f.designation} · {f.department.name}</p><p className="mt-1 text-sm text-clay">{f._count.courses} courses</p><a href={`mailto:${f.user.email}`} className="text-xs text-slate underline">{f.user.email}</a></div>))}</div>
      )}
    </div>
  );
}
