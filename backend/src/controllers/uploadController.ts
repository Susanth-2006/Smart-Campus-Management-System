import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { asyncHandler, HttpError } from '../utils/errors';
import { DOCS, IMAGES, LIMIT, signatureOk } from '../utils/files';
import { signedPath } from '../utils/signedUrl';

export const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const schema = z.object({
  kind: z.enum(['image', 'material']),
  fileName: z.string().trim().min(1).max(200),
  dataUrl: z.string().max(12_000_000),
});

export const upload = asyncHandler(async (req, res) => {
  const body = schema.parse(req.body);
  if (body.kind === 'material' && !['FACULTY', 'ADMIN'].includes(req.user!.role)) throw new HttpError(403, 'Only faculty can upload course materials');

  const m = /^data:([\w.+\-/]+);base64,([A-Za-z0-9+/=]+)$/.exec(body.dataUrl);
  if (!m) throw new HttpError(400, 'Invalid file data');
  const allowed = body.kind === 'image' ? IMAGES : DOCS;
  const ext = allowed[m[1]];
  if (!ext) throw new HttpError(400, body.kind === 'image' ? 'Only JPG, PNG or WebP images are allowed' : 'This file type is not allowed');

  const buf = Buffer.from(m[2], 'base64');
  if (!buf.length) throw new HttpError(400, 'The file is empty');
  if (buf.length > LIMIT[body.kind]) throw new HttpError(413, `File is too large (max ${LIMIT[body.kind] / 1024 / 1024} MB)`);
  if (!signatureOk(ext, buf)) throw new HttpError(400, 'File contents do not match its type');

  const storedName = `${crypto.randomUUID()}.${ext}`;
  await fs.promises.writeFile(path.join(UPLOAD_DIR, storedName), buf);
  const fileName = body.fileName.replace(/[^\w.\- ()]/g, '_');
  res.status(201).json({ storedName, url: `/uploads/${storedName}`, signedUrl: signedPath(storedName), fileName, mimeType: m[1], size: buf.length });
});
