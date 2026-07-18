import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'crypto';

/**
 * Test integrasi Safar — butuh PostgreSQL dev (DATABASE_URL) + migrasi terbaru.
 * Mengikuti pola repo: test yang butuh infrastruktur di-skip bila tidak tersedia.
 * Data uji memakai prefix phone 0899000xxx dan dibersihkan di afterAll.
 */

let dbUp = false;
let db: typeof import('../src/db').db;
let sync: typeof import('../src/services/integration.service').syncFromSafar;
let status: typeof import('../src/services/integration.service').getGroupStatusForSafar;

const GROUP_REF = randomUUID();
const SITI_REF = randomUUID();
const FADHIL_REF = randomUUID();
const KLOTER = 'TST-SAFAR-1';

function payload(overrides: Partial<Parameters<typeof sync>[0]> = {}) {
  return {
    group: { externalRef: GROUP_REF, name: 'Plus Turki — Grup B (uji)', kloterCode: KLOTER, year: 2026 },
    members: [
      { externalRef: SITI_REF, phone: '08990001001', name: 'Hj. Siti Rohmah (uji)', role: 'jamaah' as const, passportNo: 'C5120388', initialPassword: '123456' },
      { externalRef: FADHIL_REF, phone: '08990001002', name: 'Ust. Fadhil (uji)', role: 'muthawwif' as const, initialPassword: '234567' },
    ],
    schedules: [
      { title: 'Keberangkatan CGK (uji)', locationName: 'Bandara Soekarno-Hatta', startTime: '2026-08-20T09:00:00+07:00', sortOrder: 1 },
    ],
    ...overrides,
  };
}

async function cleanup() {
  const users = await db('users').whereILike('phone', '0899000%');
  const ids = users.map((u: { id: string }) => u.id);
  if (ids.length) {
    await db('group_members').whereIn('user_id', ids).del();
    await db('refresh_tokens').whereIn('user_id', ids).del();
    await db('users').whereIn('id', ids).del();
  }
  await db('groups').whereIn('kloter_code', [KLOTER, 'TST-SAFAR-2']).del(); // schedules/members CASCADE
}

beforeAll(async () => {
  try {
    ({ db } = await import('../src/db'));
    await db.raw('SELECT 1');
    const hasCol = await db.schema.hasColumn('users', 'external_ref');
    if (!hasCol) return; // migrasi belum jalan → skip
    ({ syncFromSafar: sync, getGroupStatusForSafar: status } = await import('../src/services/integration.service'));
    await cleanup();
    dbUp = true;
  } catch {
    dbUp = false; // DB tidak tersedia → seluruh suite di-skip
  }
});

afterAll(async () => {
  if (dbUp) await cleanup();
  if (db) await db.destroy().catch(() => undefined);
});

describe('sinkronisasi Safar → Mabrur', () => {
  it('membuat group + users + members + schedules', async (ctx) => {
    if (!dbUp) return ctx.skip();
    const result = await sync(payload());
    expect(result.group).toBe('created');
    expect(result.members).toHaveLength(2);
    expect(result.members.every((m) => m.status === 'created')).toBe(true);
    expect(result.schedules).toBe(1);

    const siti = await db('users').where('external_ref', SITI_REF).first();
    expect(siti.phone).toBe('08990001001');
    expect(siti.role).toBe('jamaah');
    expect(siti.passport_no).toContain(':'); // terenkripsi iv:tag:cipher — bukan plaintext
    expect(siti.passport_no).not.toContain('C5120388');

    const fadhil = await db('users').where('external_ref', FADHIL_REF).first();
    expect(fadhil.role).toBe('muthawwif');

    const members = await db('group_members')
      .join('groups', 'groups.id', 'group_members.group_id')
      .where('groups.kloter_code', KLOTER)
      .where('group_members.is_active', true);
    expect(members).toHaveLength(2);
  });

  it('idempoten: sinkron ulang tanpa duplikat, password tidak di-reset', async (ctx) => {
    if (!dbUp) return ctx.skip();
    const before = await db('users').where('external_ref', SITI_REF).first();
    const result = await sync(payload());
    expect(result.group).toBe('updated');
    expect(result.members.every((m) => m.status === 'updated')).toBe(true);

    const usersCount = await db('users').whereILike('phone', '0899000%');
    expect(usersCount).toHaveLength(2);
    const after = await db('users').where('external_ref', SITI_REF).first();
    expect(after.password_hash).toBe(before.password_hash); // tidak di-reset
    const schedules = await db('schedules')
      .join('groups', 'groups.id', 'schedules.group_id')
      .where('groups.kloter_code', KLOTER);
    expect(schedules).toHaveLength(1); // replace, bukan tambah
  });

  it('anggota dicabut dari payload → keanggotaan dinonaktifkan (user tetap ada)', async (ctx) => {
    if (!dbUp) return ctx.skip();
    const p = payload();
    p.members = [p.members[0]]; // hanya Siti
    await sync(p);

    const group = await db('groups').where('kloter_code', KLOTER).first();
    const fadhil = await db('users').where('external_ref', FADHIL_REF).first();
    expect(fadhil).toBeTruthy(); // user tidak dihapus
    const membership = await db('group_members')
      .where({ group_id: group.id, user_id: fadhil.id })
      .first();
    expect(membership.is_active).toBe(false);

    // sinkron penuh lagi → reaktivasi
    await sync(payload());
    const re = await db('group_members').where({ group_id: group.id, user_id: fadhil.id }).first();
    expect(re.is_active).toBe(true);
  });

  it('konflik phone: nomor dipakai akun tertaut lain → baris conflict, batch jalan terus', async (ctx) => {
    if (!dbUp) return ctx.skip();
    const p = payload();
    p.members = [
      p.members[0],
      { externalRef: randomUUID(), phone: '08990001001', name: 'Penyusup (uji)', role: 'jamaah', initialPassword: '345678' },
    ];
    const result = await sync(p);
    expect(result.members.filter((m) => m.status === 'conflict')).toHaveLength(1);
    expect(result.members.find((m) => m.externalRef === SITI_REF)!.status).toBe('updated');
    // pastikan tidak ada user baru dgn nomor yang sama
    const dupes = await db('users').where('phone', '08990001001');
    expect(dupes).toHaveLength(1);
  });

  it('anggota baru tanpa initialPassword → conflict jelas', async (ctx) => {
    if (!dbUp) return ctx.skip();
    const p = payload();
    p.members = [{ externalRef: randomUUID(), phone: '08990001099', name: 'Tanpa Sandi (uji)', role: 'jamaah' }];
    const result = await sync(p);
    expect(result.members[0].status).toBe('conflict');
    expect(result.members[0].message).toContain('initialPassword');
  });

  it('status lapangan by external_ref: group + members + sos', async (ctx) => {
    if (!dbUp) return ctx.skip();
    const s = await status(GROUP_REF);
    expect(s.group.kloterCode).toBe(KLOTER);
    expect(Array.isArray(s.sos)).toBe(true);
    expect(s).toHaveProperty('members');
  });

  it('muthawwif yang sama di dua rombongan (phone sama, ref beda) → diadopsi, jadi anggota keduanya', async (ctx) => {
    if (!dbUp) return ctx.skip();
    await sync(payload()); // pulihkan keanggotaan group-1 (test sebelumnya mencabut anggota)
    const GROUP2_REF = randomUUID();
    const FADHIL_REF_GRUP2 = randomUUID(); // baris group_staff berbeda utk orang yang sama
    const result = await sync({
      group: { externalRef: GROUP2_REF, name: 'Plus Turki — Grup A (uji)', kloterCode: 'TST-SAFAR-2', year: 2026 },
      members: [
        { externalRef: FADHIL_REF_GRUP2, phone: '08990001002', name: 'Ust. Fadhil (uji)', role: 'muthawwif', initialPassword: '234567' },
      ],
    });
    const fadhil = result.members[0];
    expect(fadhil.status).toBe('updated'); // diadopsi, BUKAN conflict
    expect(fadhil.mabrurUserId).toBeTruthy();

    // Satu akun, anggota aktif di kedua rombongan
    const users = await db('users').where('phone', '08990001002');
    expect(users).toHaveLength(1);
    const memberships = await db('group_members as gm')
      .join('groups as g', 'g.id', 'gm.group_id')
      .whereIn('g.kloter_code', [KLOTER, 'TST-SAFAR-2'])
      .where('gm.user_id', users[0].id)
      .where('gm.is_active', true);
    expect(memberships).toHaveLength(2);

    // Jamaah dgn phone bentrok tetap conflict (dua orang berbeda)
    const bad = await sync({
      group: { externalRef: GROUP2_REF, name: 'Plus Turki — Grup A (uji)', kloterCode: 'TST-SAFAR-2', year: 2026 },
      members: [
        { externalRef: FADHIL_REF_GRUP2, phone: '08990001002', name: 'Ust. Fadhil (uji)', role: 'muthawwif' },
        { externalRef: randomUUID(), phone: '08990001001', name: 'Orang Lain (uji)', role: 'jamaah', initialPassword: '345678' },
      ],
    });
    expect(bad.members.find((m) => m.phone === '08990001001')!.status).toBe('conflict');

    // bersih-bersih group uji kedua
    const g2 = await db('groups').where('kloter_code', 'TST-SAFAR-2').first();
    if (g2) await db('groups').where('id', g2.id).del();
  });

  it('akun hasil sinkron wajib ganti password; ganti sendiri via /profile menghapus flag', async (ctx) => {
    if (!dbUp) return ctx.skip();
    const siti = await db('users').where('external_ref', SITI_REF).first();
    expect(siti.must_change_password).toBe(true); // di-set saat dibuat via sinkron

    // Jalankan app di port acak (pola repo: uji HTTP via fetch, tanpa supertest)
    const app = (await import('../src/app')).default;
    const http = await import('http');
    const server = http.createServer(app);
    await new Promise<void>((r) => server.listen(0, () => r()));
    const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
    const post = (path: string, body: unknown, tok?: string) =>
      fetch(`${base}${path}`, {
        method: path === '/profile' ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: `Bearer ${tok}` } : {}) },
        body: JSON.stringify(body),
      });

    try {
      // Login membawa flag
      const login = await (await post('/auth/login', { phone: siti.phone, password: '123456' })).json();
      expect(login.data.user.must_change_password).toBe(true);

      // Ganti password sendiri → flag hilang
      const change = await post('/profile', { password: 'passwordbaru9' }, login.data.access_token);
      expect(change.status).toBe(200);
      const after = await db('users').where('id', siti.id).first();
      expect(after.must_change_password).toBe(false);

      // Login dgn password baru → flag false di respons
      const relogin = await (await post('/auth/login', { phone: siti.phone, password: 'passwordbaru9' })).json();
      expect(relogin.data.user.must_change_password).toBe(false);
    } finally {
      await new Promise((r) => server.close(r));
    }

    // Kembalikan password uji agar test lain (idempoten) tidak terpengaruh
    const bcrypt = (await import('bcryptjs')).default;
    await db('users').where('id', siti.id).update({ password_hash: await bcrypt.hash('123456', 12) });
  });
});
