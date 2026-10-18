import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const env = process.env;

const isProd = env.NODE_ENV === 'production';

if (isProd) {
  for (const key of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'DATABASE_URL', 'CLIENT_ORIGIN']) {
    if (!env[key]) throw new Error(`Missing required environment variable: ${key}`);
  }
}

export const config = {
  env: env.NODE_ENV || 'development',
  isProd,
  root,
  port: Number(env.PORT || 4000),
  // When no DATABASE_URL is provided, the dev launcher boots an embedded PostgreSQL.
  databaseUrl: env.DATABASE_URL || `postgres://workora:workora@127.0.0.1:${env.EMBEDDED_PG_PORT || 54329}/workora`,
  useEmbeddedDb: !env.DATABASE_URL,
  embeddedPort: Number(env.EMBEDDED_PG_PORT || 54329),
  clientOrigin: env.CLIENT_ORIGIN || 'http://localhost:5173',
  jwt: {
    accessSecret: env.JWT_ACCESS_SECRET || 'dev-only-access-secret-change-me',
    refreshSecret: env.JWT_REFRESH_SECRET || 'dev-only-refresh-secret-change-me',
    accessTtl: env.JWT_ACCESS_TTL || '15m',
    refreshTtlDays: Number(env.JWT_REFRESH_TTL_DAYS || 30),
  },
  storage: {
    driver: env.STORAGE_DRIVER || 'local', // local | s3
    // Receipts live in a PRIVATE directory that is never served statically.
    privateDir: env.PRIVATE_STORAGE_DIR || path.join(root, 'storage', 'private'),
    // Public media (space images, avatars, review photos). Served at /media.
    publicDir: env.PUBLIC_STORAGE_DIR || path.join(root, 'storage', 'public'),
    s3: {
      bucket: env.S3_BUCKET,
      region: env.S3_REGION || 'auto',
      endpoint: env.S3_ENDPOINT,
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
      forcePathStyle: env.S3_FORCE_PATH_STYLE === 'true',
    },
    maxReceiptBytes: Number(env.MAX_RECEIPT_BYTES || 8 * 1024 * 1024),
    maxImageBytes: Number(env.MAX_IMAGE_BYTES || 5 * 1024 * 1024),
  },
  email: {
    driver: env.EMAIL_DRIVER || 'log', // log | smtp
    from: env.EMAIL_FROM || 'WORKORA <no-reply@workora.example>',
    smtp: {
      host: env.SMTP_HOST,
      port: Number(env.SMTP_PORT || 587),
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
      secure: env.SMTP_SECURE === 'true',
    },
  },
  jobs: { enabled: env.JOBS_ENABLED !== 'false', intervalMs: Number(env.JOBS_INTERVAL_MS || 30_000) },
  rateLimit: { disabled: env.RATE_LIMIT_DISABLED === 'true' },
};
