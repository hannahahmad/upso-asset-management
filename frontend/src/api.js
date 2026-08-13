const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:4000/api';

export function getToken() {
  return localStorage.getItem('upso1_token');
}

export function getStoredUser() {
  const raw = localStorage.getItem('upso1_user');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
}

export function saveAuth(token, user) {
  localStorage.setItem('upso1_token', token);
  localStorage.setItem('upso1_user', JSON.stringify(user));
}

export function clearAuth() {
  localStorage.removeItem('upso1_token');
  localStorage.removeItem('upso1_user');
}

export async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const message = body?.error || response.statusText || 'Request failed';
    throw new Error(message);
  }

  return response.json();
}
