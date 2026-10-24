import { describe, it, expect } from 'vitest';
// Modul murni mobile (tanpa impor Expo) — dites di sini karena apps/mobile tidak punya test runner.
import {
  shouldSendLocation,
  MIN_MOVE_TO_SEND_M,
  HEARTBEAT_MS,
} from '../../apps/mobile/src/services/location-sync-core';
import { escapeHtml } from '../../apps/mobile/src/services/html-escape';
import {
  lastSeenLabel,
  trackingLabel,
  type TrackingLabelT,
} from '../../apps/mobile/src/services/tracking-label';
import { interpolate } from '../../apps/mobile/src/i18n/core';
import { monitorId, monitorEn } from '../../apps/mobile/src/i18n/locales/parts/monitor';

// Fungsi terjemahan murni (setara makeT di services/i18n.ts, tanpa expo-secure-store).
const tId: TrackingLabelT = (key, params) => interpolate(monitorId[key], params);
const tEn: TrackingLabelT = (key, params) => interpolate(monitorEn[key], params);

describe('lastSeenLabel', () => {
  const now = new Date(2026, 9, 24, 15, 0).getTime(); // waktu lokal
  it('relatif untuk waktu dekat', () => {
    expect(lastSeenLabel(new Date(now - 20_000).toISOString(), now, tId)).toBe('baru saja');
    expect(lastSeenLabel(new Date(now - 7 * 60000).toISOString(), now, tId)).toBe('7 mnt lalu');
  });
  it('jam untuk hari yang sama, tanggal untuk hari lain', () => {
    expect(lastSeenLabel(new Date(2026, 9, 24, 9, 5).toISOString(), now, tId)).toBe('pukul 09.05');
    expect(lastSeenLabel(new Date(2026, 9, 22, 21, 30).toISOString(), now, tId)).toBe('22/10 21.30');
  });
  it('English', () => {
    expect(lastSeenLabel(new Date(now - 20_000).toISOString(), now, tEn)).toBe('just now');
    expect(lastSeenLabel(new Date(now - 7 * 60000).toISOString(), now, tEn)).toBe('7 min ago');
    expect(lastSeenLabel(new Date(2026, 9, 24, 9, 5).toISOString(), now, tEn)).toBe('at 09:05');
    expect(lastSeenLabel(new Date(2026, 9, 22, 21, 30).toISOString(), now, tEn)).toBe('22/10 21:30');
  });
});

describe('trackingLabel', () => {
  const now = new Date(2026, 9, 24, 15, 0).getTime();
  const at = new Date(now - 3 * 60000).toISOString();
  const earlier = new Date(2026, 9, 24, 9, 5).toISOString();
  it('teks status per kondisi pelacakan', () => {
    expect(trackingLabel('tracked', at, now, tId)).toBe('Terpantau · 3 mnt lalu');
    expect(trackingLabel('stale', earlier, now, tId)).toBe('Terakhir terlihat pukul 09.05');
    expect(trackingLabel('none', null, now, tId)).toBe('Belum ada lokasi');
  });
  it('English', () => {
    expect(trackingLabel('tracked', at, now, tEn)).toBe('Tracked · 3 min ago');
    expect(trackingLabel('stale', earlier, now, tEn)).toBe('Last seen at 09:05');
    expect(trackingLabel('none', null, now, tEn)).toBe('No location yet');
  });
});

describe('shouldSendLocation', () => {
  it('selalu kirim bila belum pernah terkirim di sesi ini', () => {
    expect(shouldSendLocation(null)).toBe(true);
  });

  it('kirim bila sudah berpindah cukup jauh (bergerak = lebih sering)', () => {
    expect(shouldSendLocation({ movedMeters: MIN_MOVE_TO_SEND_M, msSinceLastSend: 1000 })).toBe(true);
  });

  it('tahan bila diam dan belum waktunya heartbeat (hemat baterai & kuota)', () => {
    expect(shouldSendLocation({ movedMeters: 3, msSinceLastSend: HEARTBEAT_MS - 1000 })).toBe(false);
  });

  it('heartbeat: tetap kirim saat diam agar tidak dianggap hilang', () => {
    expect(shouldSendLocation({ movedMeters: 0, msSinceLastSend: HEARTBEAT_MS })).toBe(true);
  });
});

describe('escapeHtml', () => {
  it('menetralkan tag dan kutip pada nama yang dikirim pengguna', () => {
    expect(escapeHtml(`<img src=x onerror="alert(1)">'&`))
      .toBe('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;&#39;&amp;');
  });
  it('nama biasa tidak berubah', () => {
    expect(escapeHtml('Siti Aminah')).toBe('Siti Aminah');
  });
});
