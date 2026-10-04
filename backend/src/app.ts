import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './utils/env';
import { originMatcher } from './utils/cors';
import { errorHandler } from './utils/errors';
import { prisma } from './utils/prisma';
import { MIME_BY_EXT, STORED_NAME } from './utils/files';
import { verifySignature } from './utils/signedUrl';
import { storage } from './utils/storage';
import routes from './routes';

/** The Express app, with no `listen()`: src/index.ts serves it locally and api/index.ts hands it to Vercel. */
const app = express();
app.disable('x-powered-by');
if (env.trustProxy) app.set('trust proxy', env.trustProxy);
app.use(helmet());

const allowed = originMatcher(env.clientOrigin);
app.use(cors({ origin: (origin, cb) => cb(null, !origin || allowed(origin)), credentials: true }));

// Uploads arrive as base64 JSON, so that single route gets a bigger body limit
app.use('/api/uploads', express.json({ limit: '12mb' }));
app.use(express.json({ limit: '1mb' }));

// Uploaded files are private: they open only through a short-lived signed link that the API gives to people allowed to see the file.
app.get('/uploads/:name', async (req, res, next) => {
  try {
    const { name } = req.params;
    if (!STORED_NAME.test(name)) return res.status(404).json({ message: 'Not found' });
    if (!verifySignature(name, req.query.exp, req.query.sig)) return res.status(403).json({ message: 'This link is invalid or has expired. Reload the page to get a fresh one.' });
    const data = await storage.get(name);
    if (!data) return res.status(404).json({ message: 'File not found' });
    res.setHeader('Content-Type', MIME_BY_EXT[name.split('.').pop()!] ?? 'application/octet-stream');
    res.setHeader('Content-Length', String(data.length));
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin'); // the frontend runs on another origin
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.send(data);
  } catch (e) { next(e); }
});

app.get('/api/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    // `seeded: false` = connected, but the tables are empty or missing (migrations / seed not run yet)
    const seeded = await prisma.user.count().then((n) => n > 0).catch(() => false);
    res.json({ status: 'ok', db: 'ok', seeded });
  }
  catch { res.status(503).json({ status: 'degraded', db: 'unreachable' }); }
});
app.use('/api', routes);
app.use((_req, res) => res.status(404).json({ message: 'Not found' }));
app.use(errorHandler);

export default app;
