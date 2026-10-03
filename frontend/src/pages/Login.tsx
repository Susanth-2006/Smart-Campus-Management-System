import { FormEvent, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { GraduationCap } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { Role } from '../types';
import { ROLE_LABEL } from '../utils/navConfig';

const DEMOS: { label: string; role: Role; email: string }[] = [
  { label: 'Student Demo', role: 'STUDENT', email: 'student@smartcampus.com' },
  { label: 'Faculty Demo', role: 'FACULTY', email: 'faculty@smartcampus.com' },
  { label: 'Admin Demo', role: 'ADMIN', email: 'admin@smartcampus.com' },
  { label: 'Staff Demo', role: 'STAFF', email: 'staff@smartcampus.com' },
];

export default function Login() {
  const { user, login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('STUDENT');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to="/dashboard" replace />;

  const submit = async (e?: FormEvent, creds = { email, password, role }) => {
    e?.preventDefault();
    setError(''); setBusy(true);
    try { await login(creds.email, creds.password, creds.role); nav('/dashboard', { replace: true }); }
    catch (err) { setError(err instanceof Error ? err.message : 'Unable to sign in. Try again.'); }
    finally { setBusy(false); }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <section className="relative hidden overflow-hidden bg-navy p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-clay/30" />
        <div className="absolute -bottom-32 left-10 h-80 w-80 rounded-full bg-peach/20" />
        <div className="relative flex items-center gap-2"><GraduationCap className="text-peach" /><span className="font-display text-2xl">Smart Campus</span></div>
        <div className="relative max-w-md">
          <h1 className="font-display text-5xl leading-tight">One connected platform for your entire campus life.</h1>
          <p className="mt-4 text-white/70">Timetables, attendance, marks, announcements and campus requests, all in one calm place.</p>
        </div>
        <p className="relative text-sm text-white/50">© Smart Campus Management System</p>
      </section>

      <section className="flex items-center justify-center p-6">
        <div className="card w-full max-w-md p-8">
          <h2 className="font-display text-3xl">Welcome back</h2>
          <p className="mb-6 mt-1 text-sm text-slate">Sign in to continue to your campus.</p>
          <form onSubmit={submit} className="space-y-4" noValidate>
            <div>
              <label htmlFor="role" className="mb-1 block text-sm font-medium">I am a</label>
              <select id="role" value={role} onChange={(e) => setRole(e.target.value as Role)} className="input">
                {(Object.keys(ROLE_LABEL) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="email" className="mb-1 block text-sm font-medium">Email</label>
              <input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} className="input" placeholder="you@smartcampus.com" required />
            </div>
            <div>
              <label htmlFor="password" className="mb-1 block text-sm font-medium">Password</label>
              <input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="input" required />
            </div>
            {error && <p role="alert" className="rounded-xl bg-peach/25 px-4 py-2.5 text-sm text-clay">{error}</p>}
            <button disabled={busy} className="btn-primary w-full">{busy ? 'Signing in…' : 'Sign In'}</button>
            <button type="button" className="w-full text-center text-sm text-clay hover:underline">Forgot Password</button>
          </form>

          <div className="mt-6 border-t border-line pt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate">Development demo accounts</p>
            <div className="grid grid-cols-2 gap-2">
              {DEMOS.map((d) => (
                <button key={d.role} disabled={busy} onClick={() => submit(undefined, { email: d.email, password: 'Password@123', role: d.role })} className="btn-ghost !px-3 !py-2 text-xs">{d.label}</button>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
