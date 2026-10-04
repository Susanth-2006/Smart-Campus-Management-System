import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './utils/env';
import { errorHandler } from './utils/errors';
import { prisma } from './utils/prisma';
import { STORED_NAME } from './utils/files';
import { verifySignature } from './utils/signedUrl';
import routes from './routes';
import { UPLOAD_DIR } from './controllers/uploadController';

const app = express();
app.use(helmet());
app.use(cors({ origin: env.clientOrigin.split(',').map((o) => o.trim()), credentials: true }));
// Uploads arrive as base64 JSON, so that single route gets a bigger body limit
app.use('/api/uploads', express.json({ limit: '12mb' }));
app.use(express.json({ limit: '1mb' }));

// Uploaded files are private: they open only through a short-lived signed link that the API gives to people allowed to see the file.
app.get('/uploads/:name', (req, res) => {
  const { name } = req.params;
  if (!STORED_NAME.test(name)) return res.status(404).json({ message: 'Not found' });
  if (!verifySignature(name, req.query.exp, req.query.sig)) return res.status(403).json({ message: 'This link is invalid or has expired. Reload the page to get a fresh one.' });
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin'); // the frontend runs on another origin
  res.setHeader('Cache-Control', 'private, max-age=300');
  res.sendFile(name, { root: UPLOAD_DIR, dotfiles: 'deny' }, (err) => { if (err && !res.headersSent) res.status(404).json({ message: 'File not found' }); });
});

app.get('/api/health', async (_req, res) => {
  try { await prisma.$queryRaw`SELECT 1`; res.json({ status: 'ok', db: 'ok' }); }
  catch { res.status(503).json({ status: 'degraded', db: 'unreachable' }); }
});
app.use('/api', routes);
app.use((_req, res) => res.status(404).json({ message: 'Not found' }));
app.use(errorHandler);

const server = app.listen(env.port, () => console.log(`Smart Campus API running on http://localhost:${env.port}`));

// Let in-flight requests finish and close the database cleanly (Docker / PM2 / Ctrl+C)
const shutdown = (signal: string) => {
  console.log(`${signal} received, shutting down…`);
  server.close(() => prisma.$disconnect().finally(() => process.exit(0)));
  setTimeout(() => process.exit(1), 10_000).unref();
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
