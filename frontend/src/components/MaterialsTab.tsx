import { FormEvent, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Download, FileText, Trash2 } from 'lucide-react';
import { api } from '../services/api';
import { useApi } from '../services/queries';
import { assetUrl, uploadMaterial } from '../services/upload';
import { MaterialItem } from '../types';
import { fmtSize } from '../utils/format';
import { EmptyState, ErrorState, Skeleton } from './ui';
import { useToast } from './Toast';

export function MaterialsTab({ courseId, canManage }: { courseId: string; canManage: boolean }) {
  const toast = useToast(), qc = useQueryClient();
  const list = useApi<MaterialItem[]>(['materials', courseId], `/courses/${courseId}/materials`);
  const [busy, setBusy] = useState(false);
  const refresh = () => qc.invalidateQueries({ queryKey: ['materials', courseId] });
  const del = useMutation({
    mutationFn: (id: string) => api(`/materials/${id}`, { method: 'DELETE' }),
    onSuccess: () => { refresh(); toast('Material removed'); },
    onError: (e) => toast((e as Error).message, 'err'),
  });

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget, f = new FormData(form);
    const file = f.get('file') as File, title = String(f.get('title') ?? '').trim();
    if (!file || !file.size) return toast('Choose a file to upload', 'err');
    if (title.length < 3) return toast('Give the material a title (3+ characters)', 'err');
    setBusy(true);
    try {
      const up = await uploadMaterial(file);
      await api(`/courses/${courseId}/materials`, { method: 'POST', json: { title, storedName: up.storedName, fileName: up.fileName, mimeType: up.mimeType, size: up.size } });
      form.reset(); refresh(); toast('Material uploaded. Students have been notified.');
    } catch (err) { toast(err instanceof Error ? err.message : 'Upload failed', 'err'); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      {canManage && (
        <form onSubmit={submit} className="grid gap-3 rounded-2xl border border-dashed border-line p-4 sm:grid-cols-3">
          <label className="text-sm font-medium">Title<input name="title" className="input mt-1" placeholder="e.g. Unit 2 notes" /></label>
          <label className="text-sm font-medium">File (PDF, Word, PowerPoint, Excel, text, image · up to 8 MB)<input name="file" type="file" accept=".pdf,.docx,.pptx,.xlsx,.txt,.png,.jpg,.jpeg,.webp" className="input mt-1 !py-1.5" /></label>
          <button disabled={busy} className="btn-primary self-end">{busy ? 'Uploading…' : 'Upload'}</button>
        </form>
      )}
      {list.isLoading ? <Skeleton className="h-24" /> : list.isError ? <ErrorState text="Unable to load materials." onRetry={() => list.refetch()} /> : !list.data?.length ? <EmptyState text="No materials uploaded yet." /> : (
        <ul className="divide-y divide-line">
          {list.data.map((m) => (
            <li key={m.id} className="flex items-center gap-3 py-3">
              <FileText className="shrink-0 text-clay" />
              <span className="min-w-0 flex-1"><span className="block truncate font-medium">{m.title}</span><span className="text-xs text-slate">{m.fileName} · {fmtSize(m.size)} · {m.uploadedBy.name} · {new Date(m.createdAt).toLocaleDateString()}</span></span>
              <a href={assetUrl(m.downloadUrl)} target="_blank" rel="noopener noreferrer" className="btn-ghost !py-1.5" aria-label={`Download ${m.title}`}><Download size={16} />Open</a>
              {canManage && <button aria-label={`Delete ${m.title}`} onClick={() => del.mutate(m.id)} className="rounded-lg p-2 text-slate hover:text-clay"><Trash2 size={16} /></button>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
