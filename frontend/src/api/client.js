/**
 * client.js: the only place the React app talks to the Express API.
 *
 * - Sends cookies (the session cookie is httpOnly, so JavaScript never sees it).
 * - Adds the "X-KejaLink: 1" header the backend requires on every change (CSRF guard).
 * - Turns error responses into an ApiError with the message and field errors,
 *   so forms can show them next to the right input.
 */
const API_BASE_URL = (process.env.API_BASE_URL || '').replace(/\/+$/, '');

export class ApiError extends Error {
  constructor(status, message, fields) {
    super(message);
    this.status = status;
    this.fields = fields || {};
  }
}

export const apiUrl = (path) => `${API_BASE_URL}${path}`;
export const assetUrl = (url) => (url && url.startsWith('/uploads/') ? apiUrl(url) : url);

async function request(method, url, body) {
  const isForm = body instanceof FormData;
  let res;
  try {
    res = await fetch(apiUrl(`/api${url}`), {
      method,
      credentials: API_BASE_URL ? 'include' : 'same-origin',
      headers: {
        Accept: 'application/json',
        ...(method !== 'GET' ? { 'X-KejaLink': '1' } : {}),
        ...(body && !isForm ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Check your internet connection and try again.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new ApiError(res.status, data.error || `Request failed (${res.status}).`, data.fields);
    // Session ended (timeout, suspension): tell the app so it can return to login.
    if (res.status === 401) window.dispatchEvent(new CustomEvent('kl:unauthorised'));
    if (data.fields && data.fields.code === 'MUST_CHANGE_PASSWORD') window.dispatchEvent(new CustomEvent('kl:must-change-password'));
    throw err;
  }
  return data;
}

export const api = {
  get: (url, params) => {
    const qs = params ? new URLSearchParams(Object.entries(params).filter(([, v]) => v !== '' && v !== null && v !== undefined)).toString() : '';
    return request('GET', qs ? `${url}?${qs}` : url);
  },
  post: (url, body) => request('POST', url, body || {}),
  put: (url, body) => request('PUT', url, body || {}),
  patch: (url, body) => request('PATCH', url, body || {}),
  delete: (url, body) => request('DELETE', url, body || {}),
};

/** Build a download link for PDF/CSV reports. */
export const downloadUrl = (url, params) => `${apiUrl(`/api${url}`)}?${new URLSearchParams(params).toString()}`;
