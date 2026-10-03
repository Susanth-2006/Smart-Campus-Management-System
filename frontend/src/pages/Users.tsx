import { useState } from 'react';
import { Search } from 'lucide-react';
import { useApi } from '../services/queries';
import { Role } from '../types';
import { ROLE_LABEL } from '../utils/navConfig';
import { EmptyState, ErrorState, Skeleton } from '../components/ui';

interface U { id: string; name: string; email: string; role: Role; createdAt: string }

export default function Users() {
  const [q, setQ] = useState(''), [role, setRole] = useState('');
  const { data, isLoading, isError, refetch } = useApi<U[]>(['users', q, role], `/users?q=${encodeURIComponent(q)}&role=${role}`);
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="font-display text-4xl">Users</h1><p className="text-slate">Everyone with access to Smart Campus.</p></div>
        <div className="flex gap-2">
          <select aria-label="Filter by role" value={role} onChange={(e) => setRole(e.target.value)} className="input !w-auto"><option value="">All roles</option>{(Object.keys(ROLE_LABEL) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select>
          <div className="relative"><Search size={16} className="absolute left-3 top-3 text-slate" /><input aria-label="Search users" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name or email" className="input !w-56 !pl-9" /></div>
        </div></header>
      {isLoading ? <Skeleton className="h-64" /> : isError ? <ErrorState text="Unable to load users." onRetry={() => refetch()} /> : !data?.length ? <EmptyState text="No users match." /> : (
        <div className="card overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-slate"><th className="py-2">Name</th><th>Email</th><th>Role</th><th>Joined</th></tr></thead>
          <tbody>{data.map((u) => <tr key={u.id} className="border-t border-line"><td className="py-2.5 font-medium">{u.name}</td><td className="text-slate">{u.email}</td><td><span className="rounded-full bg-peach/30 px-2.5 py-0.5 text-xs font-semibold text-clay">{ROLE_LABEL[u.role]}</span></td><td className="text-slate">{new Date(u.createdAt).toLocaleDateString()}</td></tr>)}</tbody></table></div>
      )}
    </div>
  );
}
