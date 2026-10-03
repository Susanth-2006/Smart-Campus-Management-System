import { FormEvent, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api, ApiError } from '../services/api';
import { useToast } from '../components/Toast';

export default function Settings() {
  const toast = useToast();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const change = useMutation({
    mutationFn: (b: unknown) => api('/auth/password', { method: 'PATCH', json: b }),
    onSuccess: () => { toast('Password updated'); (document.getElementById('pw-form') as any)?.reset(); },
    onError: (e) => { const a = e as ApiError; setErrors(a.issues?.length ? Object.fromEntries(a.issues.map((i) => [i.path, i.message])) : { currentPassword: a.message }); },
  });
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setErrors({});
    const f = new FormData(e.currentTarget), next = String(f.get('newPassword'));
    if (next !== String(f.get('confirm'))) return setErrors({ confirm: 'Passwords do not match' });
    change.mutate({ currentPassword: f.get('currentPassword'), newPassword: next });
  };
  const Field = ({ name, label, auto }: { name: string; label: string; auto: string }) => (
    <label className="block text-sm font-medium">{label}<input name={name} type="password" autoComplete={auto} required className="input mt-1" />{errors[name] && <span role="alert" className="text-xs text-clay">{errors[name]}</span>}</label>
  );
  return (
    <div className="mx-auto max-w-lg space-y-4">
      <header><h1 className="font-display text-4xl">Settings</h1><p className="text-slate">Keep your account secure.</p></header>
      <form id="pw-form" onSubmit={submit} className="card space-y-4">
        <h2 className="font-semibold">Change password</h2>
        <Field name="currentPassword" label="Current password" auto="current-password" />
        <Field name="newPassword" label="New password (8+ characters, a letter and a number)" auto="new-password" />
        <Field name="confirm" label="Confirm new password" auto="new-password" />
        <button disabled={change.isPending} className="btn-primary w-full">{change.isPending ? 'Saving…' : 'Update password'}</button>
      </form>
    </div>
  );
}
