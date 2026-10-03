import { FormEvent, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BookOpen, Plus, Search } from 'lucide-react';
import { api, ApiError } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { useApi } from '../services/queries';
import { Book, Loan } from '../types';
import { EmptyState, ErrorState, Modal, Skeleton } from '../components/ui';
import { Tabs } from '../components/Tabs';
import { useToast } from '../components/Toast';

const fmt = (iso: string) => new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
const daysLeft = (iso: string) => Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);

export default function Library() {
  const { user } = useAuth();
  const isAdmin = user!.role === 'ADMIN';
  const tabs = ['Catalogue', isAdmin ? 'All loans' : 'My loans'];
  const [tab, setTab] = useState(tabs[0]);
  return (
    <div className="space-y-5">
      <header><h1 className="font-display text-4xl">Library</h1><p className="text-slate">Search the catalogue, borrow up to 3 books for 14 days, and keep track of due dates.</p></header>
      <Tabs tabs={tabs} value={tab} onChange={setTab} />
      {tab === 'Catalogue' ? <Catalogue /> : <Loans all={isAdmin} />}
    </div>
  );
}

function Catalogue() {
  const { user } = useAuth();
  const toast = useToast(), qc = useQueryClient();
  const canBorrow = user!.role === 'STUDENT' || user!.role === 'FACULTY';
  const [q, setQ] = useState(''), [cat, setCat] = useState(''), [adding, setAdding] = useState(false);
  const cats = useApi<{ category: string; count: number }[]>(['library', 'categories'], '/library/categories');
  const books = useApi<Book[]>(['library', 'books', q, cat], `/library/books?q=${encodeURIComponent(q)}&category=${encodeURIComponent(cat)}`);
  const borrow = useMutation({
    mutationFn: (id: string) => api(`/library/books/${id}/borrow`, { method: 'POST' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['library'] }); toast('Book borrowed. It is due in 14 days.'); },
    onError: (e) => toast((e as Error).message, 'err'),
  });
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative"><Search size={16} className="absolute left-3 top-3 text-slate" /><input aria-label="Search books" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Title, author or ISBN" className="input !w-64 !pl-9" /></div>
        <select aria-label="Filter by subject" value={cat} onChange={(e) => setCat(e.target.value)} className="input !w-auto"><option value="">All subjects</option>{cats.data?.map((c) => <option key={c.category} value={c.category}>{c.category} ({c.count})</option>)}</select>
        {user!.role === 'ADMIN' && <button onClick={() => setAdding(true)} className="btn-primary ml-auto"><Plus size={16} />Add book</button>}
      </div>
      {books.isLoading ? <Skeleton className="h-64" /> : books.isError ? <ErrorState text="Unable to load the catalogue." onRetry={() => books.refetch()} /> : !books.data?.length ? <EmptyState text="No books match your search." /> : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {books.data.map((b) => (
            <article key={b.id} className="card flex flex-col">
              <div className="flex items-start justify-between gap-2"><BookOpen className="text-clay" /><span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${b.available ? 'bg-navy text-white' : 'bg-clay text-white'}`}>{b.available ? `${b.available} of ${b.copies} available` : 'All copies out'}</span></div>
              <h2 className="mt-2 font-semibold leading-snug">{b.title}</h2>
              <p className="text-sm text-slate">{b.author}</p>
              <p className="mt-1 text-xs text-slate">{b.category}{b.isbn ? ` · ISBN ${b.isbn}` : ''}</p>
              {canBorrow && (b.myLoan
                ? <p className="mt-auto pt-3 text-sm font-medium text-clay">You have this book · due {fmt(b.myLoan.dueAt)}</p>
                : <button disabled={!b.available || borrow.isPending} onClick={() => borrow.mutate(b.id)} className="btn-primary mt-auto !py-1.5">Borrow</button>)}
            </article>
          ))}
        </div>
      )}
      <AddBook open={adding} onClose={() => setAdding(false)} categories={cats.data?.map((c) => c.category) ?? []} />
    </div>
  );
}

function Loans({ all }: { all: boolean }) {
  const toast = useToast(), qc = useQueryClient();
  const loans = useApi<Loan[]>(['library', 'loans', all ? 'all' : 'mine'], '/library/loans');
  const ret = useMutation({
    mutationFn: (id: string) => api(`/library/loans/${id}/return`, { method: 'POST' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['library'] }); toast('Book returned. Thank you!'); },
    onError: (e) => toast((e as Error).message, 'err'),
  });
  if (loans.isLoading) return <Skeleton className="h-48" />;
  if (loans.isError) return <ErrorState text="Unable to load loans." onRetry={() => loans.refetch()} />;
  if (!loans.data?.length) return <EmptyState text="No loans yet. Borrow something from the catalogue!" />;
  return (
    <ul className="space-y-3">
      {loans.data.map((l) => {
        const left = daysLeft(l.dueAt), overdue = !l.returnedAt && left < 0;
        return (
          <li key={l.id} className={`card flex flex-wrap items-center justify-between gap-3 ${overdue ? '!border-clay' : ''}`}>
            <span><span className="block font-semibold">{l.book.title}</span><span className="text-sm text-slate">{l.book.author}{all && l.user ? ` · ${l.user.name}` : ''}</span></span>
            <span className="flex items-center gap-3 text-sm">
              {l.returnedAt ? <span className="text-slate">Returned {fmt(l.returnedAt)}</span>
                : <span className={overdue ? 'font-semibold text-clay' : 'text-slate'}>{overdue ? `Overdue by ${-left} day${-left === 1 ? '' : 's'}` : left === 0 ? 'Due today' : `Due ${fmt(l.dueAt)} (${left} day${left === 1 ? '' : 's'} left)`}</span>}
              {!l.returnedAt && <button disabled={ret.isPending} onClick={() => ret.mutate(l.id)} className="btn-ghost !py-1.5">Return</button>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function AddBook({ open, onClose, categories }: { open: boolean; onClose: () => void; categories: string[] }) {
  const toast = useToast(), qc = useQueryClient();
  const [err, setErr] = useState<Record<string, string>>({});
  const add = useMutation({
    mutationFn: (b: unknown) => api('/library/books', { method: 'POST', json: b }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['library'] }); toast('Book added'); onClose(); },
    onError: (e) => { const a = e as ApiError; setErr(Object.fromEntries((a.issues ?? []).map((i) => [i.path, i.message]))); toast(a.message, 'err'); },
  });
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setErr({});
    const f = new FormData(e.currentTarget);
    add.mutate({ title: f.get('title'), author: f.get('author'), category: f.get('category'), isbn: f.get('isbn') || undefined, copies: Number(f.get('copies')) });
  };
  const Field = ({ name, label, type = 'text', req = true }: { name: string; label: string; type?: string; req?: boolean }) => (
    <label className="block text-sm font-medium">{label}<input name={name} type={type} required={req} list={name === 'category' ? 'cats' : undefined} defaultValue={type === 'number' ? 2 : undefined} className="input mt-1" />{err[name] && <span className="text-xs text-clay">{err[name]}</span>}</label>
  );
  return (
    <Modal open={open} onClose={onClose} title="Add a book">
      <form onSubmit={submit} className="space-y-3">
        <Field name="title" label="Title" /><Field name="author" label="Author" /><Field name="category" label="Subject" />
        <datalist id="cats">{categories.map((c) => <option key={c} value={c} />)}</datalist>
        <div className="grid grid-cols-2 gap-3"><Field name="isbn" label="ISBN (optional)" req={false} /><Field name="copies" label="Copies" type="number" /></div>
        <button disabled={add.isPending} className="btn-primary w-full">Add to catalogue</button>
      </form>
    </Modal>
  );
}
