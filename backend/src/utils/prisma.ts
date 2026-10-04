import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

// One shared client. On serverless platforms every warm instance keeps its own small connection pool,
// so keep it small and point DATABASE_URL at a pooled endpoint (Neon: the host with "-pooler").
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL, max: Number(process.env.DB_POOL_MAX ?? (process.env.VERCEL ? 3 : 10)) }) });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
