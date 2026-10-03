import { FormEvent, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Trash2 } from 'lucide-react';
import { api, ApiError } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { useApi } from '../services/queries';
import { Course } from '../types';
import { EmptyState, ErrorState, Modal, Skeleton } from '../components/ui';
import { useToast } from '../components/Toast';

export default function Courses() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const toast = useToast(), qc = useQueryClient();
  const [q, setQ] = useState(''), [adding, setAdding] = useState(false), [del, setDel] = useState<Course | null>(null);
  const isAdmin = user!.role === 'ADMIN';
  const { data, isLoading, isError, refetch } = useApi<Course[]>(['courses', isAdmin, q], `/courses?${isAdmin ? '' : 'mine=true&'}q=${encodeURIComponent(q)}`);
  const remove = useMutation({
    mutationFn: (id: string) => api(`/courses/${id}`, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['courses'] }); toast('Course deleted'); setDel(null); },
    onError: (e) => toast((e as Error).message, 'err'),
  });

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="font-display text-4xl">{isAdmin ? 'Courses' : 'My Courses'}</h1><p className="text-slate">{isAdmin ? 'Create and manage the course catalogue.' : 'Everything for this semester in one place.'}</p></div>
        <div className="flex gap-2">
          <div className="relative"><Search size={16} className="absolute left-3 top-3 text-slate" /><input aria-label="Search courses" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search courses" className="input !w-56 !pl-9" /></div>
          {isAdmin && <button onClick={() => setAdding(true)} className="btn-primary"><Plus size={16} />Add Course</button>}
        </div>
      </header>

      {isLoading ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-44" />)}</div> :
        isError ? <ErrorState text="Unable to load courses. Try again." onRetry={() => refetch()} /> :
        !data?.length ? <EmptyState text="No courses found." /> : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((c) => (
            <div key={c.id} className="card flex flex-col transition hover:-translate-y-1">
              <div className="flex items-start justify-between"><span className="rounded-full bg-peach/30 px-3 py-1 text-xs font-bold text-clay">{c.code}</span><span className="text-xs text-slate">Sem {c.semester} · Room {c.room}</span></div>
              <h2 className="mt-3 font-display text-2xl">{c.name}</h2>
              <p className="text-sm text-slate">{c.faculty.user.name}</p>
              <p className="mt-1 text-sm text-slate">{c.credits} Credits · {c._count.enrollments} students</p>
              <div className="mt-auto flex gap-2 pt-4">
                <Link to={`${pathname.replace(/\/$/, '')}/${c.id}`} className="btn-primary flex-1">View Course</Link>
                {isAdmin && <button aria-label={`Delete ${c.name}`} onClick={() => setDel(c)} className="btn-ghost !px-3"><Trash2 size={16} /></button>}
              </div>
            </div>
          ))}
        </div>
      )}

      <AddCourse open={adding} onClose={() => setAdding(false)} />
      <Modal open={!!del} onClose={() => setDel(null)} title="Delete course?">
        <p className="text-sm text-slate">This removes <b>{del?.name}</b> along with its timetable, attendance and marks. This cannot be undone.</p>
        <div className="mt-4 flex justify-end gap-2"><button className="btn-ghost" onClick={() => setDel(null)}>Cancel</button><button className="btn-accent" onClick={() => del && remove.mutate(del.id)}>Delete</button></div>
      </Modal>
    </div>
  );
}

function AddCourse({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast(), qc = useQueryClient();
  const depts = useApi<{ id: string; name: string }[]>(['departments'], '/departments');
  const faculty = useApi<{ id: string; user: { name: string } }[]>(['faculty'], '/faculty');
  const [err, setErr] = useState<Record<string, string>>({});
  const create = useMutation({
    mutationFn: (body: unknown) => api('/courses', { method: 'POST', json: body }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['courses'] }); toast('Course added'); onClose(); },
    onError: (e) => { const a = e as ApiError; setErr(Object.fromEntries((a.issues ?? []).map((i) => [i.path, i.message])) || {}); toast(a.message, 'err'); },
  });
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setErr({});
    const f = new FormData(e.currentTarget);
    create.mutate({ code: f.get('code'), name: f.get('name'), credits: Number(f.get('credits')), semester: Number(f.get('semester')), room: f.get('room'), departmentId: f.get('departmentId'), facultyId: f.get('facultyId') });
  };
  const F = ({ name, label, type = 'text' }: { name: string; label: string; type?: string }) => (
    <label className="block text-sm font-medium">{label}<input name={name} type={type} required className="input mt-1" />{err[name] && <span className="text-xs text-clay">{err[name]}</span>}</label>
  );
  return (
    <Modal open={open} onClose={onClose} title="Add course">
      <form onSubmit={submit} className="grid grid-cols-2 gap-3">
        <F name="code" label="Code" /><F name="room" label="Room" />
        <div className="col-span-2"><F name="name" label="Course name" /></div>
        <F name="credits" label="Credits" type="number" /><F name="semester" label="Semester" type="number" />
        <label className="block text-sm font-medium">Department<select name="departmentId" required className="input mt-1">{depts.data?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
        <label className="block text-sm font-medium">Faculty<select name="facultyId" required className="input mt-1">{faculty.data?.map((f) => <option key={f.id} value={f.id}>{f.user.name}</option>)}</select></label>
        <button disabled={create.isPending} className="btn-primary col-span-2">{create.isPending ? 'Saving…' : 'Create course'}</button>
      </form>
    </Modal>
  );
}
