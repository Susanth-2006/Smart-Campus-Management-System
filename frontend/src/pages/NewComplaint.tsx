import { ChangeEvent, FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ImagePlus, X } from 'lucide-react';
import { api, ApiError } from '../services/api';
import { uploadImage } from '../services/upload';
import { useToast } from '../components/Toast';
import { Complaint } from '../types';

const CATS = ['INFRASTRUCTURE', 'ELECTRICITY', 'WATER', 'INTERNET', 'CLASSROOM', 'LABORATORY', 'LIBRARY', 'HOSTEL', 'TRANSPORT', 'OTHER'];
const cap = (s: string) => s[0] + s.slice(1).toLowerCase();

export default function NewComplaint() {
  const nav = useNavigate(), toast = useToast(), qc = useQueryClient();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [photo, setPhoto] = useState<File | null>(null), [preview, setPreview] = useState(''), [uploading, setUploading] = useState(false);
  const create = useMutation({
    mutationFn: (b: unknown) => api<Complaint>('/complaints', { method: 'POST', json: b }),
    onSuccess: (c) => { qc.invalidateQueries({ queryKey: ['complaints'] }); toast('Complaint submitted successfully.'); nav(`/campus/complaints/${c.id}`); },
    onError: (e) => { const a = e as ApiError; setErrors(Object.fromEntries((a.issues ?? []).map((i) => [i.path, i.message]))); toast(a.message, 'err'); },
  });

  const pick = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith('image/')) return setErrors((x) => ({ ...x, photo: 'Please choose an image (JPG, PNG or WebP).' }));
    setErrors((x) => ({ ...x, photo: '' })); setPhoto(f); setPreview(URL.createObjectURL(f));
  };
  const drop = () => { if (preview) URL.revokeObjectURL(preview); setPhoto(null); setPreview(''); };

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget), local: Record<string, string> = {};
    if (String(f.get('title')).trim().length < 5) local.title = 'Please enter a clear title (5+ characters).';
    if (String(f.get('description')).trim().length < 10) local.description = 'Add a little more detail (10+ characters).';
    if (String(f.get('location')).trim().length < 2) local.location = 'Where is the problem?';
    setErrors(local);
    if (Object.keys(local).length) return;

    let imageUrl: string | undefined;
    if (photo) {
      setUploading(true);
      try { imageUrl = (await uploadImage(photo)).url; }
      catch (err) { setUploading(false); return setErrors({ photo: err instanceof Error ? err.message : 'Photo upload failed' }); }
      setUploading(false);
    }
    create.mutate({ title: f.get('title'), description: f.get('description'), category: f.get('category'), location: f.get('location'), priority: f.get('priority'), imageUrl });
  };
  const Err = ({ k }: { k: string }) => (errors[k] ? <span role="alert" className="text-xs text-clay">{errors[k]}</span> : null);
  const busy = create.isPending || uploading;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-4xl">Report an issue</h1>
      <p className="mb-5 text-slate">Tell us what's wrong. You'll be able to follow progress step by step.</p>
      <form onSubmit={submit} noValidate className="card space-y-4">
        <label className="block text-sm font-medium">Title<input name="title" className="input mt-1" placeholder="e.g. Projector not working in C-204" /><Err k="title" /></label>
        <label className="block text-sm font-medium">Description<textarea name="description" rows={4} className="input mt-1" /><Err k="description" /></label>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block text-sm font-medium">Category<select name="category" className="input mt-1">{CATS.map((c) => <option key={c} value={c}>{cap(c)}</option>)}</select></label>
          <label className="block text-sm font-medium">Location<input name="location" className="input mt-1" placeholder="Block, room" /><Err k="location" /></label>
          <label className="block text-sm font-medium">Priority<select name="priority" defaultValue="MEDIUM" className="input mt-1">{['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map((p) => <option key={p} value={p}>{cap(p)}</option>)}</select></label>
        </div>
        <div>
          <span className="block text-sm font-medium">Photo (optional)</span>
          {preview ? (
            <div className="relative mt-1 inline-block"><img src={preview} alt="Selected photo preview" className="max-h-48 rounded-xl border border-line" /><button type="button" aria-label="Remove photo" onClick={drop} className="absolute -right-2 -top-2 rounded-full bg-navy p-1 text-white"><X size={14} /></button></div>
          ) : (
            <label className="mt-1 flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-line px-4 py-3 text-sm text-slate hover:bg-peach/15"><ImagePlus size={18} className="text-clay" />Add a photo of the problem<input type="file" accept="image/png,image/jpeg,image/webp" onChange={pick} className="sr-only" /></label>
          )}
          <Err k="photo" /><Err k="imageUrl" />
        </div>
        <button disabled={busy} className="btn-primary w-full">{uploading ? 'Uploading photo…' : create.isPending ? 'Submitting…' : 'Submit complaint'}</button>
      </form>
    </div>
  );
}
