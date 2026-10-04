// Imported FIRST by tests that load backend modules: env.ts refuses to start without a JWT secret.
process.env.JWT_SECRET ??= 'unit-test-secret-unit-test-secret-0123456789';
process.env.DATABASE_URL ??= 'postgresql://unused:unused@localhost:5432/unused';
