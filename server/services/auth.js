import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Op } from 'sequelize';
import { models } from '../models/index.js';
import { config } from '../config/env.js';
import { fail } from '../utils/errors.js';

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
export const hashPassword = (pw) => bcrypt.hash(pw, 11);
const verifyPassword = (pw, hash) => bcrypt.compare(pw, hash);

export function signAccessToken(user) {
  return jwt.sign({ sub: user.id }, config.jwt.accessSecret, { expiresIn: config.jwt.accessTtl });
}

export function verifyAccessToken(token) {
  try {
    return jwt.verify(token, config.jwt.accessSecret);
  } catch (e) {
    return fail(e.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'UNAUTHENTICATED');
  }
}

export async function loadUserWithAccess(id) {
  const user = await models.User.findByPk(id, {
    include: [{ model: models.Role, as: 'roles', include: [{ model: models.Permission, as: 'permissions' }] }],
  });
  if (!user) return null;
  const perms = new Set();
  for (const r of user.roles) {
    for (const p of r.permissions) perms.add(p.key);
    if (r.key === 'owner') perms.add('*');
  }
  return { user, permissions: [...perms] };
}

async function issueRefresh(user, userAgent) {
  const raw = crypto.randomBytes(48).toString('hex');
  await models.RefreshToken.create({
    user_id: user.id,
    token_hash: sha(raw),
    expires_at: new Date(Date.now() + config.jwt.refreshTtlDays * 86_400_000),
    user_agent: userAgent?.slice(0, 290),
  });
  return raw;
}

export async function register({ name, email, phone, password, locale }, userAgent) {
  const exists = await models.User.findOne({ where: { email: email.toLowerCase() } });
  if (exists) fail('EMAIL_TAKEN');
  const user = await models.User.create({
    name, email: email.toLowerCase(), phone, locale: locale || 'ar', password_hash: await hashPassword(password),
  });
  return { user, accessToken: signAccessToken(user), refreshToken: await issueRefresh(user, userAgent) };
}

export async function login({ email, password }, userAgent) {
  const user = await models.User.findOne({ where: { email: email.toLowerCase() } });
  // Same error for unknown email and wrong password (no account enumeration).
  const ok = user && (await verifyPassword(password, user.password_hash));
  if (!ok) fail('INVALID_CREDENTIALS');
  if (user.status !== 'active') fail('ACCOUNT_SUSPENDED');
  await user.update({ last_login_at: new Date() });
  return { user, accessToken: signAccessToken(user), refreshToken: await issueRefresh(user, userAgent) };
}

/** Rotating refresh: the presented token is revoked and a new one issued. Reuse of a revoked token revokes all sessions. */
export async function refresh(rawToken, userAgent) {
  if (!rawToken) fail('UNAUTHENTICATED');
  const row = await models.RefreshToken.findOne({ where: { token_hash: sha(rawToken) } });
  if (!row) fail('UNAUTHENTICATED');
  if (row.revoked_at) {
    await models.RefreshToken.update({ revoked_at: new Date() }, { where: { user_id: row.user_id, revoked_at: { [Op.is]: null } } });
    fail('UNAUTHENTICATED');
  }
  if (row.expires_at < new Date()) fail('TOKEN_EXPIRED');
  const user = await models.User.findByPk(row.user_id);
  if (!user || user.status !== 'active') fail('UNAUTHENTICATED');
  await row.update({ revoked_at: new Date() });
  return { user, accessToken: signAccessToken(user), refreshToken: await issueRefresh(user, userAgent) };
}

export async function logout(rawToken) {
  if (!rawToken) return;
  await models.RefreshToken.update({ revoked_at: new Date() }, { where: { token_hash: sha(rawToken), revoked_at: { [Op.is]: null } } });
}

export const REFRESH_COOKIE = 'workora_rt';
export const refreshCookieOptions = () => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: config.isProd,
  path: '/',
  maxAge: config.jwt.refreshTtlDays * 86_400_000,
});

export async function changePassword(user, current, next) {
  if (!(await verifyPassword(current, user.password_hash))) fail('INVALID_CREDENTIALS');
  await user.update({ password_hash: await hashPassword(next) });
  await models.RefreshToken.update({ revoked_at: new Date() }, { where: { user_id: user.id, revoked_at: { [Op.is]: null } } });
}
