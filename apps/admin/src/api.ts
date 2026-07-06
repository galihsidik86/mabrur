const BASE = 'http://localhost:3000';

function getToken(): string | null {
  return localStorage.getItem('access_token');
}

async function tryRefresh(): Promise<string | null> {
  const rt = localStorage.getItem('refresh_token');
  if (!rt) return null;
  try {
    const res = await fetch(`${BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: rt }),
    });
    if (!res.ok) return null;
    const { data } = await res.json();
    localStorage.setItem('access_token', data.access_token);
    localStorage.setItem('refresh_token', data.refresh_token);
    return data.access_token;
  } catch {
    return null;
  }
}

export async function api<T = any>(
  path: string,
  opts: RequestInit = {},
): Promise<T> {
  let token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((opts.headers as Record<string, string>) || {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let res = await fetch(`${BASE}${path}`, { ...opts, headers });

  if (res.status === 401 && token) {
    const newToken = await tryRefresh();
    if (newToken) {
      headers['Authorization'] = `Bearer ${newToken}`;
      res = await fetch(`${BASE}${path}`, { ...opts, headers });
    } else {
      localStorage.clear();
      window.location.href = '/login';
      throw new Error('Sesi berakhir');
    }
  }

  if (res.status === 204) return undefined as T;

  const json = await res.json();
  if (!res.ok) throw new Error(json.error?.message || 'Request gagal');
  if (json.meta) return json as T; // list response: { data: [...], meta: {...} }
  return (json.data ?? json) as T;
}

export async function login(phone: string, password: string) {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, password }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error?.message || 'Login gagal');
  const { access_token, refresh_token, user } = json.data;
  localStorage.setItem('access_token', access_token);
  localStorage.setItem('refresh_token', refresh_token);
  localStorage.setItem('user', JSON.stringify(user));
  return user;
}

export function logout() {
  localStorage.clear();
  window.location.href = '/login';
}

export function getUser() {
  const raw = localStorage.getItem('user');
  return raw ? JSON.parse(raw) : null;
}
