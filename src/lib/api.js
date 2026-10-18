const BASE_URL = '/api';
const TOKEN_KEY = 'workora_token';
const TIMEOUT_MS = 20000;

const safeStorage = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* storage blocked */ } },
  remove: (k) => { try { localStorage.removeItem(k); } catch { /* storage blocked */ } },
};

export class ApiError extends Error {
  constructor(message, { code = 'UNKNOWN', status = 0, details, fields } = {}) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
    this.fields = fields;
  }
}

class ApiClient {
  constructor() {
    this.token = safeStorage.get(TOKEN_KEY);
    this.refreshing = null;
    this.onSessionExpired = null; // set by the auth store
  }

  setToken(token) {
    this.token = token || null;
    if (token) safeStorage.set(TOKEN_KEY, token);
    else safeStorage.remove(TOKEN_KEY);
  }

  /** One in-flight refresh shared by every request that hits a 401 at the same time. */
  refreshSession() {
    if (!this.refreshing) {
      this.refreshing = fetch(`${BASE_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'X-Requested-With': 'workora' },
      })
        .then(async (res) => {
          if (!res.ok) throw new Error('refresh failed');
          const data = await res.json();
          this.setToken(data.access_token);
          return data;
        })
        .finally(() => { this.refreshing = null; });
    }
    return this.refreshing;
  }

  async rawFetch(endpoint, options = {}) {
    const url = endpoint.startsWith('http') ? endpoint : `${BASE_URL}${endpoint}`;
    const headers = { 'X-Requested-With': 'workora', ...options.headers };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    if (options.body && !(options.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeout || TIMEOUT_MS);
    try {
      return await fetch(url, {
        credentials: 'include',
        ...options,
        headers,
        signal: options.signal || controller.signal,
      });
    } catch (err) {
      if (err.name === 'AbortError') throw new ApiError('انتهت مهلة الاتصال بالخادم. حاول مرة أخرى.', { code: 'TIMEOUT' });
      throw new ApiError('تعذر الاتصال بالخادم. تأكد من اتصالك بالإنترنت.', { code: 'NETWORK' });
    } finally {
      clearTimeout(timer);
    }
  }

  async withRefresh(endpoint, options) {
    let res = await this.rawFetch(endpoint, options);
    const isAuthCall = /\/auth\/(login|register|refresh)/.test(endpoint);
    if (res.status === 401 && !isAuthCall && this.token) {
      try {
        await this.refreshSession();
        res = await this.rawFetch(endpoint, options);
      } catch {
        this.setToken(null);
        this.onSessionExpired?.();
      }
    }
    return res;
  }

  async request(endpoint, options = {}) {
    const res = await this.withRefresh(endpoint, options);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new ApiError(data.error?.message || 'حدث خطأ غير متوقع', {
        code: data.error?.code || 'UNKNOWN',
        status: res.status,
        details: data.error?.details,
        fields: data.error?.fields,
      });
    }
    return data;
  }

  /** Authenticated binary download (receipts are private, so <img src> alone cannot reach them). */
  async blob(endpoint) {
    const res = await this.withRefresh(endpoint, { method: 'GET' });
    if (!res.ok) throw new ApiError('تعذر تحميل الملف.', { status: res.status });
    return { blob: await res.blob(), type: res.headers.get('content-type') || '' };
  }

  get(endpoint, params, options) {
    let url = endpoint;
    if (params) {
      const query = new URLSearchParams();
      for (const [key, val] of Object.entries(params)) {
        if (val !== undefined && val !== null && val !== '') query.append(key, val);
      }
      const qs = query.toString();
      if (qs) url += (url.includes('?') ? '&' : '?') + qs;
    }
    return this.request(url, { method: 'GET', ...options });
  }

  send(method, endpoint, body, options) {
    return this.request(endpoint, {
      method,
      body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
      ...options,
    });
  }

  post(endpoint, body, options) { return this.send('POST', endpoint, body ?? {}, options); }
  put(endpoint, body, options) { return this.send('PUT', endpoint, body, options); }
  patch(endpoint, body, options) { return this.send('PATCH', endpoint, body, options); }
  delete(endpoint, options) { return this.send('DELETE', endpoint, undefined, options); }

  upload(endpoint, file, fieldName = 'file') {
    const body = new FormData();
    body.append(fieldName, file);
    return this.request(endpoint, { method: 'POST', body, timeout: 60000 });
  }
}

export const api = new ApiClient();

/** Flatten server validation errors ({ fields: { 'a.b': 'msg' } }) for forms. */
export const fieldErrors = (err) => (err instanceof ApiError && err.fields ? err.fields : {});
