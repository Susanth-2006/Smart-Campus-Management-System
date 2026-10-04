import 'dotenv/config';

const need = (key: string): string => {
  const v = process.env[key];
  if (!v) throw new Error(`Missing required environment variable: ${key}`);
  return v;
};

const jwtSecret = need('JWT_SECRET');
// Anyone who knows the secret can mint an admin token, so refuse obviously guessable ones in production.
if (jwtSecret.length < 32 || /replace-with|change-?me|^secret$/i.test(jwtSecret)) {
  const msg = 'JWT_SECRET is weak. Use a random value of at least 32 characters (e.g. `openssl rand -base64 48`).';
  if (process.env.NODE_ENV === 'production') throw new Error(msg);
  console.warn(`⚠  ${msg}`);
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  clientOrigin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173,http://127.0.0.1:5173',
  loginRateLimit: Number(process.env.LOGIN_RATE_LIMIT ?? 30),
  uploadRateLimit: Number(process.env.UPLOAD_RATE_LIMIT ?? 60),
};
