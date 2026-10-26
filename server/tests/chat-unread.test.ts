import { describe, it, expect } from 'vitest';
// Modul murni mobile (tanpa impor Expo) — dites di sini karena apps/mobile tidak punya test runner.
import { countUnread, latestCreatedAt } from '../../apps/mobile/src/services/chat-unread-core';

const msg = (user_id: string, created_at: string) => ({ user_id, created_at });

describe('countUnread', () => {
  const msgs = [
    msg('me', '2026-10-24T08:00:00.000Z'),
    msg('a', '2026-10-24T08:01:00.000Z'),
    msg('b', '2026-10-24T08:02:00.000Z'),
    msg('me', '2026-10-24T08:03:00.000Z'),
  ];

  it('menghitung pesan orang lain setelah waktu terakhir dibaca', () => {
    expect(countUnread(msgs, 'me', '2026-10-24T08:01:00.000Z')).toBe(1);
  });

  it('pesan sendiri tidak pernah dihitung', () => {
    expect(countUnread(msgs, 'me', '2026-10-24T07:00:00.000Z')).toBe(2);
  });

  it('belum pernah membuka chat: semua pesan orang lain dihitung', () => {
    expect(countUnread(msgs, 'me', null)).toBe(2);
  });
});

describe('latestCreatedAt', () => {
  it('mengembalikan created_at terbaru, null bila kosong', () => {
    expect(latestCreatedAt([msg('a', '2026-10-24T08:02:00.000Z'), msg('b', '2026-10-24T08:01:00.000Z')]))
      .toBe('2026-10-24T08:02:00.000Z');
    expect(latestCreatedAt([])).toBeNull();
  });
});
