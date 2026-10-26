import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Stub knex: db('group_members').join().where().whereNotNull().select() -> rows
let rows: Array<{ user_id: string; push_token: string }> = [];
let failQuery = false;
// Log semua panggilan builder per query: [tabel, [metode, ...args][]]
const queries: Array<{ table: string; calls: unknown[][] }> = [];
vi.mock('../src/db', () => ({
  db: (table: string) => {
    const q = { table, calls: [] as unknown[][] };
    queries.push(q);
    const chain: any = {};
    for (const m of ['join', 'where', 'whereNot', 'whereNotNull']) {
      chain[m] = (...args: unknown[]) => { q.calls.push([m, ...args]); return chain; };
    }
    chain.update = async (v: unknown) => { q.calls.push(['update', v]); return 1; };
    chain.select = async () => {
      if (failQuery) throw new Error('db down');
      return rows;
    };
    return chain;
  },
}));

import { notifyGroupMessage, chatSnippet, savePushToken } from '../src/services/push.service';

describe('savePushToken', () => {
  beforeEach(() => { queries.length = 0; });

  it('melepas token yang sama dari akun lain dulu (HP dipakai bergantian), lalu menyimpannya', async () => {
    await savePushToken('userB', 'ExponentPushToken[T]');

    expect(queries).toHaveLength(2);
    expect(queries[0].calls).toEqual([
      ['where', { push_token: 'ExponentPushToken[T]' }],
      ['whereNot', 'id', 'userB'],
      ['update', { push_token: null }],
    ]);
    expect(queries[1].calls).toEqual([
      ['where', 'id', 'userB'],
      ['update', { push_token: 'ExponentPushToken[T]' }],
    ]);
  });
});

describe('chatSnippet', () => {
  it('mengembalikan teks pendek apa adanya', () => {
    expect(chatSnippet('Assalamualaikum')).toBe('Assalamualaikum');
  });

  it('memotong teks panjang dengan elipsis dan merapikan spasi/baris baru', () => {
    const s = chatSnippet('a'.repeat(200));
    expect(s.length).toBe(100);
    expect(s.endsWith('…')).toBe(true);
    expect(chatSnippet('halo\n\n  pak   ustadz')).toBe('halo pak ustadz');
  });
});

describe('notifyGroupMessage', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    failQuery = false;
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it('mengirim push ke anggota rombongan kecuali pengirim, kanal chat, data membuka chat', async () => {
    rows = [
      { user_id: 'sender', push_token: 'ExponentPushToken[S]' },
      { user_id: 'muth', push_token: 'ExponentPushToken[M]' },
      { user_id: 'j2', push_token: 'ExponentPushToken[J2]' },
    ];

    await notifyGroupMessage('g1', 'sender', 'Ahmad', 'Pak, saya di gerbang 79');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sent.map((m: any) => m.to).sort()).toEqual(['ExponentPushToken[J2]', 'ExponentPushToken[M]']);
    expect(sent[0]).toMatchObject({
      title: 'Ahmad',
      body: 'Pak, saya di gerbang 79',
      channelId: 'chat',
      data: { type: 'chat', groupId: 'g1' },
    });
  });

  it('tidak mengirim token ganda (satu HP dipakai dua akun)', async () => {
    rows = [
      { user_id: 'a', push_token: 'ExponentPushToken[X]' },
      { user_id: 'b', push_token: 'ExponentPushToken[X]' },
    ];
    await notifyGroupMessage('g1', 'sender', 'Ahmad', 'tes');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toHaveLength(1);
  });

  it('tidak memanggil fetch jika tidak ada penerima selain pengirim', async () => {
    rows = [{ user_id: 'sender', push_token: 'ExponentPushToken[S]' }];
    await notifyGroupMessage('g1', 'sender', 'Ahmad', 'tes');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('tidak melempar error jika query gagal (kirim pesan tetap sukses)', async () => {
    failQuery = true;
    await expect(notifyGroupMessage('g1', 'sender', 'Ahmad', 'tes')).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalled();
  });
});
