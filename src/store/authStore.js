import { create } from 'zustand';
import { api } from '../lib/api';

const STAFF_ROLES = ['owner', 'super_admin', 'admin', 'booking_manager', 'payment_reviewer', 'space_manager', 'support_agent', 'accountant', 'viewer'];

const readUser = () => {
  try {
    const raw = localStorage.getItem('workora_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};
const writeUser = (user) => {
  try {
    if (user) localStorage.setItem('workora_user', JSON.stringify(user));
    else localStorage.removeItem('workora_user');
  } catch { /* storage blocked */ }
};

const checkIsStaff = (user) => {
  if (!user) return false;
  if (user.is_staff) return true;
  return Boolean(user.roles?.some((r) => STAFF_ROLES.includes(r.key || r)));
};

const initialUser = readUser();
const initialToken = api.token;

export const useAuthStore = create((set, get) => ({
  user: initialUser,
  token: initialToken,
  permissions: initialUser?.permissions || [],
  // While a stored session is being verified, route guards must wait instead of bouncing to /login.
  isLoading: Boolean(initialToken),
  isAuthenticated: Boolean(initialUser && initialToken),
  isStaff: checkIsStaff(initialUser),

  setAuth: (user, token) => {
    if (token !== undefined) api.setToken(token);
    writeUser(user);
    set({
      user,
      token: api.token,
      permissions: user?.permissions || [],
      isAuthenticated: Boolean(user && api.token),
      isStaff: checkIsStaff(user),
      isLoading: false,
    });
  },

  clear: () => {
    api.setToken(null);
    writeUser(null);
    set({ user: null, token: null, permissions: [], isAuthenticated: false, isStaff: false, isLoading: false });
  },

  /** Verify the stored session on boot (also refreshes permissions after role changes). */
  checkAuth: async () => {
    if (!api.token) {
      // Visitors with no trace of a session shouldn't hit the server at all.
      if (!get().user) {
        set({ isLoading: false });
        return;
      }
      // We remember a user but lost the access token — a refresh cookie may still be alive.
      try {
        await api.refreshSession();
      } catch {
        get().clear();
        return;
      }
    }
    try {
      const data = await api.get('/auth/me');
      get().setAuth(data.user, api.token);
    } catch (err) {
      if (err.status === 401 || err.status === 403) get().clear();
      else set({ isLoading: false });
    }
  },

  login: async (credentials) => {
    const res = await api.post('/auth/login', credentials);
    get().setAuth(res.user, res.access_token);
    return res;
  },

  register: async (payload) => {
    const res = await api.post('/auth/register', payload);
    get().setAuth(res.user, res.access_token);
    return res;
  },

  logout: async () => {
    try { await api.post('/auth/logout'); } catch { /* already gone */ }
    get().clear();
  },

  updateUser: (patch) => {
    const user = { ...get().user, ...patch };
    writeUser(user);
    set({ user });
  },

  can: (perm) => {
    const { isStaff, permissions } = get();
    if (!isStaff) return false;
    if (!perm) return true;
    return permissions.includes('*') || permissions.includes(perm);
  },
}));

api.onSessionExpired = () => useAuthStore.getState().clear();
