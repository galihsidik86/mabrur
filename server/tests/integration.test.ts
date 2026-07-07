import { describe, it, expect, beforeAll } from 'vitest';

// Set env for tests
process.env.ENCRYPTION_KEY = 'a'.repeat(64);
process.env.DATABASE_URL = 'postgres://mabrur:mabrur_secret@localhost:5432/mabrur';
process.env.JWT_SECRET = 'x'.repeat(32);
process.env.JWT_REFRESH_SECRET = 'y'.repeat(32);

const BASE = 'http://localhost:3000';

async function post(path: string, body: any, token?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
  return { status: res.status, data: await res.json() };
}

async function get(path: string, token: string) {
  const res = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  return { status: res.status, data: await res.json() };
}

async function del(path: string, token: string) {
  const res = await fetch(`${BASE}${path}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
  return { status: res.status };
}

describe('Integration: Auth Flow', () => {
  let token = '';
  let refreshToken = '';

  it('login dengan kredensial benar', async () => {
    const res = await post('/auth/login', { phone: '08000000001', password: 'admin123' });
    expect(res.status).toBe(200);
    expect(res.data.data.access_token).toBeTruthy();
    expect(res.data.data.user.role).toBe('admin');
    token = res.data.data.access_token;
    refreshToken = res.data.data.refresh_token;
  });

  it('login dengan password salah', async () => {
    const res = await post('/auth/login', { phone: '08000000001', password: 'salah' });
    expect(res.status).toBe(401);
    expect(res.data.error.code).toBe('AUTH_FAILED');
  });

  it('akses tanpa token ditolak', async () => {
    const res = await fetch(`${BASE}/users`);
    expect(res.status).toBe(401);
  });

  it('refresh token berhasil', async () => {
    const res = await post('/auth/refresh', { refresh_token: refreshToken });
    expect(res.status).toBe(200);
    expect(res.data.data.access_token).toBeTruthy();
    token = res.data.data.access_token;
    refreshToken = res.data.data.refresh_token;
  });

  it('GET /auth/me mengembalikan profil', async () => {
    const res = await get('/auth/me', token);
    expect(res.status).toBe(200);
    expect(res.data.data.name).toBe('Administrator');
  });
});

describe('Integration: SOS Flow', () => {
  let jamaahToken = '';
  let muthToken = '';
  let sosId = '';

  beforeAll(async () => {
    const j = await post('/auth/login', { phone: '08123456789', password: 'jamaah123' });
    jamaahToken = j.data.data.access_token;
    const m = await post('/auth/login', { phone: '08111222333', password: 'muth123456' });
    muthToken = m.data.data.access_token;
  });

  it('jamaah kirim SOS', async () => {
    const res = await post('/sos', { category: 'medis', lat: 21.42, lng: 39.82 }, jamaahToken);
    if (res.status === 409) {
      // Already has active SOS, cancel first
      const active = await get('/sos/active', jamaahToken);
      if (active.data.data?.id) {
        await del(`/sos/${active.data.data.id}`, jamaahToken);
      }
      const retry = await post('/sos', { category: 'medis', lat: 21.42, lng: 39.82 }, jamaahToken);
      expect(retry.status).toBe(201);
      sosId = retry.data.data.id;
    } else {
      expect(res.status).toBe(201);
      sosId = res.data.data.id;
    }
  });

  it('duplikat SOS ditolak', async () => {
    const res = await post('/sos', { category: 'tersesat' }, jamaahToken);
    expect(res.status).toBe(409);
  });

  it('muthawwif lihat SOS grup', async () => {
    const groups = await get('/groups', muthToken);
    const gid = groups.data.data?.[0]?.id || groups.data[0]?.id;
    const res = await get(`/groups/${gid}/sos`, muthToken);
    expect(res.status).toBe(200);
  });

  it('jamaah batalkan SOS', async () => {
    const res = await del(`/sos/${sosId}`, jamaahToken);
    expect(res.status).toBe(200);
  });
});

describe('Integration: Geofence', () => {
  let token = '';

  beforeAll(async () => {
    const res = await post('/auth/login', { phone: '08123456789', password: 'jamaah123' });
    token = res.data.data.access_token;
  });

  it('GET miqat zones', async () => {
    const res = await get('/miqat-zones', token);
    expect(res.status).toBe(200);
    const zones = res.data.data;
    expect(zones.length).toBeGreaterThanOrEqual(5);
  });

  it('nearest miqat dari Madinah area', async () => {
    const res = await get('/miqat-zones/nearest?lat=24.47&lng=39.61', token);
    expect(res.status).toBe(200);
    expect(res.data.data.zone.name).toContain('Bir Ali');
  });

  it('toggle ihram', async () => {
    const res = await post('/ihram/toggle', { is_ihram: true, niat_type: 'umrah' }, token);
    expect(res.status).toBe(200);
    expect(res.data.data.is_ihram).toBe(true);
  });
});

describe('Integration: Content', () => {
  let token = '';

  beforeAll(async () => {
    const res = await post('/auth/login', { phone: '08123456789', password: 'jamaah123' });
    token = res.data.data.access_token;
  });

  it('GET ibadah guides', async () => {
    const res = await get('/ibadah-guides?type=umrah', token);
    expect(res.status).toBe(200);
    expect(res.data.data.length).toBe(5);
  });

  it('GET duas', async () => {
    const res = await get('/duas', token);
    expect(res.status).toBe(200);
    expect(res.data.data.length).toBe(6);
  });

  it('GET ziarah', async () => {
    const res = await get('/ziarah', token);
    expect(res.status).toBe(200);
    expect(res.data.data.length).toBeGreaterThanOrEqual(8);
  });
});
