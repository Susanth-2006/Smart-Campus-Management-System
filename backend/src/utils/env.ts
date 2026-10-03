import 'dotenv/config';

const need = (key: string): string => {
  const v = process.env[key];
  if (!v) throw new Error(`Missing required environment variable: ${key}`);
  return v;
};

export const env = {
  port: Number(process.env.PORT ?? 4000),
  jwtSecret: need('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  clientOrigin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173,http://127.0.0.1:5173',
};
