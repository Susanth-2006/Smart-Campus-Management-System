import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './utils/env';
import { errorHandler } from './utils/errors';
import routes from './routes';
import { UPLOAD_DIR } from './controllers/uploadController';

const app = express();
app.use(helmet());
app.use(cors({ origin: env.clientOrigin.split(','), credentials: true }));
// Uploads arrive as base64 JSON, so that single route gets a bigger body limit
app.use('/api/uploads', express.json({ limit: '12mb' }));
app.use(express.json({ limit: '1mb' }));

// Uploaded images/documents. Helmet defaults to same-origin; the frontend runs on another origin, so allow reads.
app.use('/uploads', (_req, res, next) => { res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin'); next(); }, express.static(UPLOAD_DIR, { index: false, dotfiles: 'deny' }));

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/api', routes);
app.use((_req, res) => res.status(404).json({ message: 'Not found' }));
app.use(errorHandler);

app.listen(env.port, () => console.log(`Smart Campus API running on http://localhost:${env.port}`));
