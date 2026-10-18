import rateLimit from 'express-rate-limit';
import multer from 'multer';
import { ZodError } from 'zod';
import { AppError, fail, ERRORS } from '../utils/errors.js';
import { verifyAccessToken, loadUserWithAccess } from '../services/auth.js';
import { config } from '../config/env.js';

const bearer = (req) => {
  const h = req.headers.authorization || '';
  return h.startsWith('Bearer ') ? h.slice(7) : null;
};

async function attachUser(req, token) {
  const payload = verifyAccessToken(token);
  const access = await loadUserWithAccess(payload.sub);
  if (!access) fail('UNAUTHENTICATED');
  if (access.user.status !== 'active') fail('ACCOUNT_SUSPENDED');
  req.user = access.user;
  req.permissions = access.permissions;
}

export const authenticate = async (req, _res, next) => {
  try {
    const token = bearer(req);
    if (!token) fail('UNAUTHENTICATED');
    await attachUser(req, token);
    next();
  } catch (e) { next(e); }
};

export const optionalAuth = async (req, _res, next) => {
  try {
    const token = bearer(req);
    if (token) await attachUser(req, token);
    next();
  } catch { next(); }
};

export const can = (req, perm) => !!req.user?.is_staff && (req.permissions.includes('*') || req.permissions.includes(perm));

/** Role-based authorisation: requires a staff account holding ALL listed permissions. */
export const requirePermission = (...perms) => (req, _res, next) => {
  if (!req.user) return next(new AppError('UNAUTHENTICATED'));
  if (!perms.every((p) => can(req, p))) return next(new AppError('FORBIDDEN'));
  return next();
};
export const requireAnyPermission = (...perms) => (req, _res, next) => {
  if (!req.user) return next(new AppError('UNAUTHENTICATED'));
  return perms.some((p) => can(req, p)) ? next() : next(new AppError('FORBIDDEN'));
};
export const requireStaff = (req, _res, next) => (req.user?.is_staff ? next() : next(new AppError('FORBIDDEN')));

/** Validates body/query/params with Zod and replaces them with the parsed (and stripped) values. */
export const validate = (schema, source = 'body') => (req, _res, next) => {
  try {
    const sentKeys = Object.keys(req[source] || {});
    const parsed = schema.parse(req[source]);
    Object.defineProperty(req, source, { value: parsed, writable: true, configurable: true });
    Object.defineProperty(req, 'sentKeys', { value: new Set(sentKeys), writable: true, configurable: true });
    next();
  } catch (e) { next(e); }
};

/** For PATCH/PUT: the validated body restricted to keys the client really sent (ignores schema defaults). */
export const sent = (req) => Object.fromEntries(Object.entries(req.body).filter(([k]) => req.sentKeys?.has(k)));

/** CSRF defence for cookie-authenticated endpoints: custom header + SameSite cookie + CORS allow-list. */
export const csrfGuard = (req, _res, next) => {
  if (req.headers['x-requested-with'] !== 'workora') return next(new AppError('FORBIDDEN'));
  return next();
};

const limiterFactory = (opts) => (config.rateLimit.disabled
  ? (_req, _res, next) => next()
  : rateLimit({
    standardHeaders: true, legacyHeaders: false,
    handler: (_req, _res, next) => next(new AppError('RATE_LIMITED')),
    ...opts,
  }));
export const apiLimiter = limiterFactory({ windowMs: 60_000, limit: 600 });
export const authLimiter = limiterFactory({ windowMs: 15 * 60_000, limit: 40 });
export const uploadLimiter = limiterFactory({ windowMs: 60_000, limit: 30 });

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.storage.maxReceiptBytes, files: 1 },
});

export const notFound = (_req, _res, next) => next(new AppError('NOT_FOUND', { status: 404 }));

// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, _next) => {
  if (err instanceof ZodError) {
    return res.status(422).json({
      error: {
        code: 'VALIDATION', message: ERRORS.VALIDATION[1],
        fields: Object.fromEntries(err.issues.map((i) => [i.path.join('.') || '_', i.message])),
      },
    });
  }
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
  }
  if (err instanceof multer.MulterError) {
    const code = err.code === 'LIMIT_FILE_SIZE' ? 'RECEIPT_SIZE' : 'RECEIPT_UPLOAD_FAILED';
    return res.status(ERRORS[code][0]).json({ error: { code, message: ERRORS[code][1] } });
  }
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: { code: 'VALIDATION', message: ERRORS.VALIDATION[1] } });
  const pgCode = err?.parent?.code || err?.original?.code;
  if (pgCode === '23P01') return res.status(409).json({ error: { code: 'SPACE_UNAVAILABLE', message: ERRORS.SPACE_UNAVAILABLE[1] } });
  if (pgCode === '23503') return res.status(409).json({ error: { code: 'DELETE_BLOCKED', message: ERRORS.DELETE_BLOCKED[1] } });
  if (pgCode === '23505') return res.status(409).json({ error: { code: 'VALIDATION', message: 'هذه القيمة مستخدمة بالفعل.' } });
  console.error('[error]', req.method, req.originalUrl, err);
  return res.status(500).json({ error: { code: 'INTERNAL', message: err.message || ERRORS.INTERNAL[1] } });
};

export const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
