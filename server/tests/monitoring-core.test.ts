import { describe, it, expect } from 'vitest';
import {
  trackingStatus,
  buildMemberStatuses,
  pickReminderTargets,
  TRACKED_MAX_MINUTES,
  FAR_FROM_GROUP_M,
  REMINDER_COOLDOWN_MS,
  LOCATION_RETENTION_HOURS,
  reserveReminders,
  type MemberRow,
} from '../src/services/monitoring-core';

const NOW = Date.parse('2026-10-24T10:00:00.000Z');
const minsAgo = (m: number) => new Date(NOW - m * 60000).toISOString();

// ~1 m lintang = 1/111320 derajat
const KAABAH = { lat: 21.4225, lng: 39.8262 };
const north = (m: number) => ({ lat: KAABAH.lat + m / 111320, lng: KAABAH.lng });

function row(over: Partial<MemberRow> & { id: string }): MemberRow {
  return {
    name: over.id, phone: '0800', role_in_group: 'jamaah',
    lat: null, lng: null, loc_updated: null, is_ihram: false, niat_type: null,
    ...over,
  };
}

describe('trackingStatus', () => {
  it('tracked bila update terakhir masih dalam batas', () => {
    expect(trackingStatus(minsAgo(1), NOW)).toBe('tracked');
    expect(trackingStatus(minsAgo(TRACKED_MAX_MINUTES), NOW)).toBe('tracked');
  });
  it('stale bila update terakhir lewat batas', () => {
    expect(trackingStatus(minsAgo(TRACKED_MAX_MINUTES + 1), NOW)).toBe('stale');
  });
  it('none bila belum pernah ada lokasi', () => {
    expect(trackingStatus(null, NOW)).toBe('none');
  });
});

describe('buildMemberStatuses', () => {
  const leader = row({ id: 'muth', role_in_group: 'muthawwif', ...KAABAH, loc_updated: minsAgo(1) });

  it('menghitung statistik pelacakan hanya untuk jamaah (muthawwif tidak dihitung)', () => {
    const result = buildMemberStatuses([
      leader,
      row({ id: 'a', ...north(50), loc_updated: minsAgo(2) }),
      row({ id: 'b', ...north(50), loc_updated: minsAgo(120) }),
      row({ id: 'c' }),
      row({ id: 'd' }),
    ], [], NOW);

    expect(result.stats).toMatchObject({ jamaah_total: 4, tracked: 1, stale: 1, no_location: 2 });
    // field lama tetap ada (dipakai integrasi Safar)
    expect(result.stats).toMatchObject({ total: 5 });
    expect(result.members.find((m) => m.id === 'c')!.tracking).toBe('none');
    expect(result.members.find((m) => m.id === 'b')!.tracking).toBe('stale');
  });

  it('menandai jamaah yang jauh dari muthawwif melebihi ambang', () => {
    const result = buildMemberStatuses([
      leader,
      row({ id: 'near', ...north(100), loc_updated: minsAgo(1) }),
      row({ id: 'far', ...north(FAR_FROM_GROUP_M + 200), loc_updated: minsAgo(1) }),
    ], [], NOW);

    const near = result.members.find((m) => m.id === 'near')!;
    const far = result.members.find((m) => m.id === 'far')!;
    expect(near.far_from_group).toBe(false);
    expect(near.distance_to_leader).toBeGreaterThan(95);
    expect(near.distance_to_leader).toBeLessThan(105);
    expect(far.far_from_group).toBe(true);
    expect(far.status).toBe('attention');
    expect(result.stats.far_from_group).toBe(1);
  });

  it('koordinat lama melewati masa simpan disembunyikan, waktu terakhir terlihat tetap ada', () => {
    const oldAt = minsAgo(LOCATION_RETENTION_HOURS * 60 + 1);
    const result = buildMemberStatuses([
      row({ id: 'lama', ...north(10), loc_updated: oldAt }),
      row({ id: 'basi', ...north(10), loc_updated: minsAgo(120) }),
    ], [], NOW);
    const lama = result.members.find((m) => m.id === 'lama')!;
    const basi = result.members.find((m) => m.id === 'basi')!;
    expect(lama.location).toBeNull();
    expect(lama.last_seen_at).toBe(oldAt);
    expect(lama.tracking).toBe('stale');
    expect(basi.location).not.toBeNull(); // lokasi terakhir masih ditampilkan saat offline
  });

  it('tidak menilai jarak bila lokasi muthawwif atau jamaah sudah basi', () => {
    const staleLeader = { ...leader, loc_updated: minsAgo(120) };
    const result = buildMemberStatuses([
      staleLeader,
      row({ id: 'x', ...north(5000), loc_updated: minsAgo(1) }),
    ], [], NOW);
    const x = result.members.find((m) => m.id === 'x')!;
    expect(x.distance_to_leader).toBeNull();
    expect(x.far_from_group).toBe(false);
  });
});

describe('pickReminderTargets', () => {
  const members = buildMemberStatuses([
    row({ id: 'muth', role_in_group: 'muthawwif' }),
    row({ id: 'ok', ...north(10), loc_updated: minsAgo(1) }),
    row({ id: 'stale', ...north(10), loc_updated: minsAgo(120) }),
    row({ id: 'none' }),
  ], [], NOW).members;

  it('tanpa daftar: semua jamaah yang tidak terpantau (bukan muthawwif)', () => {
    const r = pickReminderTargets(members, undefined, new Map(), NOW);
    expect(r.targets.sort()).toEqual(['none', 'stale']);
  });

  it('dengan daftar: hanya jamaah rombongan ini yang diminta (id asing diabaikan)', () => {
    const r = pickReminderTargets(members, ['ok', 'muth', 'orang-lain'], new Map(), NOW);
    expect(r.targets).toEqual(['ok']);
  });

  it('reservasi langsung: permintaan paralel kedua tidak mengirim ulang, entri kedaluwarsa dibuang', () => {
    const log = new Map<string, number>([['lama', NOW - REMINDER_COOLDOWN_MS - 1]]);
    const first = pickReminderTargets(members, undefined, log, NOW);
    reserveReminders(log, first.targets, NOW);
    const second = pickReminderTargets(members, undefined, log, NOW);
    expect(first.targets.length).toBe(2);
    expect(second.targets).toEqual([]);
    expect(log.has('lama')).toBe(false);
  });

  it('melewati jamaah yang baru saja diingatkan (jeda anti-spam)', () => {
    const lastSent = new Map([['none', NOW - 60000], ['stale', NOW - REMINDER_COOLDOWN_MS - 1]]);
    const r = pickReminderTargets(members, undefined, lastSent, NOW);
    expect(r.targets).toEqual(['stale']);
    expect(r.skipped_cooldown).toBe(1);
  });
});
