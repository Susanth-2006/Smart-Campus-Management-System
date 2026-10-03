import { api } from './api';

const BASE: string = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api';
/** Turns a server path like /uploads/abc.jpg into a full URL the browser can load. */
export const assetUrl = (path: string) => BASE.replace(/\/api\/?$/, '') + path;

export interface Uploaded { storedName: string; url: string; fileName: string; mimeType: string; size: number }

const MIME_BY_EXT: Record<string, string> = {
  pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', txt: 'text/plain',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

function toDataUrl(blob: Blob, mime: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    // Some browsers report an empty type for Office files, so the MIME type is set explicitly
    r.onload = () => resolve(String(r.result).replace(/^data:[^;]*;base64,/, `data:${mime};base64,`));
    r.onerror = () => reject(new Error('Could not read the file'));
    r.readAsDataURL(blob);
  });
}

async function shrinkImage(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1280 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not process the image'))), 'image/jpeg', 0.82));
}

export async function uploadImage(file: File): Promise<Uploaded> {
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file');
  const blob = await shrinkImage(file);
  return api<Uploaded>('/uploads', { method: 'POST', json: { kind: 'image', fileName: file.name.replace(/\.\w+$/, '') + '.jpg', dataUrl: await toDataUrl(blob, 'image/jpeg') } });
}

export async function uploadMaterial(file: File): Promise<Uploaded> {
  if (file.size > 8 * 1024 * 1024) throw new Error('File is too large (max 8 MB)');
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  const mime = MIME_BY_EXT[ext];
  if (!mime) throw new Error('Allowed files: PDF, Word, PowerPoint, Excel, text or images');
  return api<Uploaded>('/uploads', { method: 'POST', json: { kind: 'material', fileName: file.name, dataUrl: await toDataUrl(file, mime) } });
}
