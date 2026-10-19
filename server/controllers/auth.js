import * as auth from '../services/auth.js';
import { REFRESH_COOKIE, refreshCookieOptions } from '../services/auth.js';
import { loadUserWithAccess } from '../services/auth.js';
import { serializeUser } from '../utils/serializers.js';
import { fail } from '../utils/errors.js';

const respond = async (res, { user, accessToken, refreshToken }, status = 200) => {
  res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions());
  const access = await loadUserWithAccess(user.id);
  res.status(status).json({ access_token: accessToken, user: serializeUser(access.user, { permissions: access.permissions }) });
};

export const register = async (req, res) => respond(res, await auth.register(req.body, req.headers['user-agent']), 201);
export const login = async (req, res) => respond(res, await auth.login(req.body, req.headers['user-agent']));
export const refresh = async (req, res) => {
  try {
    await respond(res, await auth.refresh(req.cookies?.[REFRESH_COOKIE], req.headers['user-agent']));
  } catch (e) {
    res.clearCookie(REFRESH_COOKIE, { path: '/' });
    throw e;
  }
};
export const logout = async (req, res) => {
  await auth.logout(req.cookies?.[REFRESH_COOKIE]);
  res.clearCookie(REFRESH_COOKIE, { path: '/' });
  res.json({ ok: true });
};
export const me = async (req, res) => {
  const access = await loadUserWithAccess(req.user.id);
  res.json({ user: serializeUser(access.user, { permissions: access.permissions }) });
};
export const updateMe = async (req, res) => {
  await req.user.update(req.body);
  const access = await loadUserWithAccess(req.user.id);
  res.json({ user: serializeUser(access.user, { permissions: access.permissions }) });
};
export const changePassword = async (req, res) => {
  if (!req.body.new_password) fail('VALIDATION');
  await auth.changePassword(req.user, req.body.current_password, req.body.new_password);
  res.json({ ok: true });
};
