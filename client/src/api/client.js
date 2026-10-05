/**
 * Single point of contact between the React app and the HustleHub+ API.
 *
 * - Every request goes to the same origin (/api, proxied by Vite), never to
 *   a hard-coded external URL.
 * - The JWT is attached as a Bearer header here and nowhere else.
 * - Errors come back as ApiError with a user-safe message. Server-side 5xx
 *   details are never shown; a generic message is used instead.
 * - A 401 on an authenticated request means the session expired or was
 *   revoked, so the registered handler logs the user out.
 */

let authToken = null;
let unauthorizedHandler = () => {};

export function setAuthToken(token) {
  authToken = token;
}

export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = handler;
}

export class ApiError extends Error {
  constructor(message, status, fieldErrors = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.fieldErrors = fieldErrors; // [{ field, message }] from server-side validation.
  }

  /** Field errors as { fieldName: message } for easy display next to inputs. */
  get fieldMap() {
    return Object.fromEntries(this.fieldErrors.map((e) => [e.field, e.message]));
  }
}

export async function apiRequest(path, { method = 'GET', body } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  let response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      credentials: 'omit', // Auth is the Bearer header only - no cookies, so no CSRF exposure.
    });
  } catch {
    throw new ApiError('Unable to reach the server. Please check your connection and try again.', 0);
  }

  let data = null;
  try {
    data = await response.json();
  } catch {
    // Empty or non-JSON body - handled below.
  }

  if (!response.ok) {
    if (response.status === 401 && authToken) unauthorizedHandler();
    const message =
      response.status >= 500
        ? 'Something went wrong on our side. Please try again later.'
        : (data && data.message) || 'The request could not be completed.';
    throw new ApiError(message, response.status, (data && data.errors) || []);
  }
  return data;
}

const query = (params = {}) => {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== '' && v !== null);
  return entries.length ? `?${new URLSearchParams(entries).toString()}` : '';
};

export const api = {
  // Auth
  login: (email, password) => apiRequest('/auth/login', { method: 'POST', body: { email, password } }),
  register: (data) => apiRequest('/auth/register', { method: 'POST', body: data }),
  me: () => apiRequest('/users/me'),

  // Gigs
  listGigs: (params) => apiRequest(`/gigs${query(params)}`),
  categories: () => apiRequest('/gigs/categories'),
  getGig: (id) => apiRequest(`/gigs/${encodeURIComponent(id)}`),
  myGigs: () => apiRequest('/gigs/mine'),
  createGig: (data) => apiRequest('/gigs', { method: 'POST', body: data }),
  updateGig: (id, data) => apiRequest(`/gigs/${encodeURIComponent(id)}`, { method: 'PATCH', body: data }),
  deleteGig: (id) => apiRequest(`/gigs/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  // Bookings
  createBooking: (gigId, notes) => apiRequest('/bookings', { method: 'POST', body: notes ? { gigId, notes } : { gigId } }),
  listBookings: () => apiRequest('/bookings'),
  completeBooking: (id) => apiRequest(`/bookings/${encodeURIComponent(id)}/complete`, { method: 'PATCH' }),
  cancelBooking: (id) => apiRequest(`/bookings/${encodeURIComponent(id)}/cancel`, { method: 'PATCH' }),

  // Money
  listTransactions: () => apiRequest('/transactions'),
  incomeSummary: () => apiRequest('/income/summary'),

  // Admin
  adminStats: () => apiRequest('/admin/stats'),
  adminUsers: () => apiRequest('/admin/users'),
  adminGigs: () => apiRequest('/admin/gigs'),
};
