import app from './app';
import { env } from './utils/env';
import { prisma } from './utils/prisma';

const server = app.listen(env.port, () => console.log(`Smart Campus API running on http://localhost:${env.port}`));

// Let in-flight requests finish and close the database cleanly (Docker / PM2 / Ctrl+C)
const shutdown = (signal: string) => {
  console.log(`${signal} received, shutting down…`);
  server.close(() => prisma.$disconnect().finally(() => process.exit(0)));
  setTimeout(() => process.exit(1), 10_000).unref();
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
