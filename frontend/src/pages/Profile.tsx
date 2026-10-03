import { useApi } from '../services/queries';
import { ErrorState, Skeleton } from '../components/ui';
import { ROLE_LABEL } from '../utils/navConfig';

export default function Profile() {
  const { data: u, isLoading, isError } = useApi<any>(['me'], '/auth/me');
  if (isLoading) return <Skeleton className="h-64" />;
  if (isError || !u) return <ErrorState text="Unable to load your profile." />;
  const dept = u.student?.department ?? u.faculty?.department;
  const Row = ({ k, v }: { k: string; v?: string | number | null }) => v ? <div className="flex justify-between border-b border-line py-2.5 text-sm"><dt className="text-slate">{k}</dt><dd className="font-medium">{v}</dd></div> : null;
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex items-center gap-4"><span className="flex h-20 w-20 items-center justify-center rounded-full bg-peach font-display text-4xl text-navy">{u.name.replace(/^Dr\.\s*/, '')[0]}</span><div><h1 className="font-display text-3xl">{u.name}</h1><p className="text-slate">{ROLE_LABEL[u.role as keyof typeof ROLE_LABEL]}</p></div></div>
      <section className="card"><h2 className="mb-1 font-semibold">Personal & contact</h2><dl><Row k="Email" v={u.email} /><Row k="Phone" v={u.phone} /></dl></section>
      <section className="card"><h2 className="mb-1 font-semibold">Academic information</h2><dl><Row k="Department" v={dept?.name} /><Row k="Roll number" v={u.student?.rollNo} /><Row k="Semester" v={u.student?.semester} /><Row k="Section" v={u.student?.section} /><Row k="Designation" v={u.faculty?.designation} /><Row k="Staff type" v={u.staff?.staffType} /></dl></section>
    </div>
  );
}
