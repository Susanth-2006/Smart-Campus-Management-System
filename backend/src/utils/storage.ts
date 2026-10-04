import fs from 'node:fs';
import path from 'node:path';
import { prisma } from './prisma';

/**
 * Where uploaded files live.
 *   disk – `backend/uploads` on the server (default for local development)
 *   db   – a PostgreSQL table (default on Vercel, whose filesystem is read-only and not persistent)
 * Force one with STORAGE=disk|db.
 */
export const STORAGE_MODE: 'disk' | 'db' = (process.env.STORAGE ?? (process.env.VERCEL ? 'db' : 'disk')) === 'db' ? 'db' : 'disk';

export const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads');
const onDisk = (name: string) => path.join(UPLOAD_DIR, name);

export const storage = {
  async put(name: string, data: Buffer, mimeType: string): Promise<void> {
    if (STORAGE_MODE === 'db') { await prisma.storedFile.create({ data: { name, mimeType, size: data.length, data: new Uint8Array(data) } }); return; }
    await fs.promises.mkdir(UPLOAD_DIR, { recursive: true });
    await fs.promises.writeFile(onDisk(name), data);
  },
  async get(name: string): Promise<Buffer | null> {
    if (STORAGE_MODE === 'db') { const f = await prisma.storedFile.findUnique({ where: { name }, select: { data: true } }); return f ? Buffer.from(f.data) : null; }
    return fs.promises.readFile(onDisk(name)).catch(() => null);
  },
  async exists(name: string): Promise<boolean> {
    if (STORAGE_MODE === 'db') return !!(await prisma.storedFile.findUnique({ where: { name }, select: { name: true } }));
    return fs.existsSync(onDisk(name));
  },
  async remove(name: string): Promise<void> {
    if (STORAGE_MODE === 'db') { await prisma.storedFile.deleteMany({ where: { name } }); return; }
    await fs.promises.unlink(onDisk(name)).catch(() => {});
  },
};
