import { describe, it, expect } from 'vitest';
// Modul murni mobile (tanpa impor Expo) — dites di sini karena apps/mobile tidak punya test runner.
import {
  fitWithin,
  retryDelayMs,
  isPermanentFailure,
  localDayKey,
  groupByDay,
  groupBySchedule,
  chunk,
  suggestSchedule,
  formatBytes,
  jwtExpiry,
  parseExifDate,
  makeUuidV4,
  formatDuration,
  isVideoTooLong,
  uploadTimeoutMs,
  fileExtensionFor,
  VIDEO_MAX_DURATION_MS,
  type AlbumItem,
} from '../../apps/mobile/src/services/documentation-core';

const item = (id: string, taken_at: string, schedule_id: string | null = null, schedule_title: string | null = null): AlbumItem =>
  ({ id, taken_at, schedule_id, schedule_title });

describe('fitWithin', () => {
  it('mengecilkan sisi terpanjang ke batas, rasio tetap', () => {
    expect(fitWithin(4000, 3000, 1920)).toEqual({ width: 1920, height: 1440 });
    expect(fitWithin(3000, 4000, 1920)).toEqual({ width: 1440, height: 1920 });
  });

  it('tidak memperbesar foto kecil', () => {
    expect(fitWithin(800, 600, 1920)).toEqual({ width: 800, height: 600 });
  });

  it('ukuran tidak diketahui → kotak batas', () => {
    expect(fitWithin(0, 0, 480)).toEqual({ width: 480, height: 480 });
  });
});

describe('coba ulang unggahan', () => {
  it('jeda naik berlipat dan dibatasi 30 menit', () => {
    expect(retryDelayMs(0)).toBe(30_000);
    expect(retryDelayMs(1)).toBe(60_000);
    expect(retryDelayMs(3)).toBe(240_000);
    expect(retryDelayMs(20)).toBe(1_800_000);
  });

  it('galat permanen vs sementara', () => {
    for (const s of [400, 403, 404, 413, 415]) expect(isPermanentFailure(s)).toBe(true);
    for (const s of [401, 408, 429, 500, 502, 503]) expect(isPermanentFailure(s)).toBe(false);
  });
});

describe('album', () => {
  it('localDayKey memakai tanggal lokal HP', () => {
    const d = new Date(2026, 9, 20, 4, 30); // 20 Okt 04.30 waktu lokal
    expect(localDayKey(d.toISOString())).toBe('2026-10-20');
  });

  it('groupByDay: hari terbaru dulu, urutan dalam hari dipertahankan', () => {
    const a = item('a', new Date(2026, 9, 21, 9).toISOString());
    const b = item('b', new Date(2026, 9, 20, 18).toISOString());
    const c = item('c', new Date(2026, 9, 20, 7).toISOString());
    const sections = groupByDay([b, a, c], (k) => `hari ${k}`);
    expect(sections.map((s) => s.key)).toEqual(['2026-10-21', '2026-10-20']);
    expect(sections[1].data.map((x) => x.id)).toEqual(['b', 'c']);
    expect(sections[0].title).toBe('hari 2026-10-21');
  });

  it('groupBySchedule: kegiatan terbaru dulu, tanpa kegiatan di akhir', () => {
    const items = [
      item('1', '2026-10-20T08:00:00Z', 's1', 'Tawaf'),
      item('2', '2026-10-21T08:00:00Z', 's2', "Sa'i"),
      item('3', '2026-10-19T08:00:00Z', null),
      item('4', '2026-10-22T08:00:00Z', 's1', 'Tawaf'),
    ];
    const sections = groupBySchedule(items, 'Lainnya');
    expect(sections.map((s) => s.title)).toEqual(['Tawaf', "Sa'i", 'Lainnya']);
    expect(sections[0].data.map((x) => x.id)).toEqual(['1', '4']);
    expect(sections[2].key).toBe('other');
  });

  it('groupBySchedule tanpa foto tak berkegiatan → tidak ada bagian Lainnya', () => {
    expect(groupBySchedule([item('1', '2026-10-20T08:00:00Z', 's1', 'Tawaf')], 'Lainnya')).toHaveLength(1);
  });

  it('chunk membagi baris grid', () => {
    expect(chunk([1, 2, 3, 4, 5, 6, 7], 3)).toEqual([[1, 2, 3], [4, 5, 6], [7]]);
    expect(chunk([], 3)).toEqual([]);
  });
});

describe('suggestSchedule', () => {
  const now = new Date('2026-10-20T10:00:00Z');
  const s = (id: string, start: string, end?: string) => ({ id, start_time: start, end_time: end ?? null });

  it('kegiatan yang sedang berlangsung menang', () => {
    expect(suggestSchedule([s('a', '2026-10-20T09:30:00Z'), s('b', '2026-10-20T08:00:00Z', '2026-10-20T11:00:00Z')], now)).toBe('b');
  });

  it('tanpa yang berlangsung: yang dimulai paling dekat sebelum sekarang', () => {
    expect(suggestSchedule([s('a', '2026-10-20T06:00:00Z'), s('b', '2026-10-20T09:00:00Z')], now)).toBe('b');
  });

  it('kegiatan mendatang atau lebih dari 12 jam lalu diabaikan', () => {
    expect(suggestSchedule([s('a', '2026-10-20T12:00:00Z'), s('b', '2026-10-19T08:00:00Z')], now)).toBeNull();
  });
});

describe('formatBytes', () => {
  it('satuan & desimal koma', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1536)).toBe('1,5 KB');
    expect(formatBytes(350 * 1024 * 1024)).toBe('350 MB');
    expect(formatBytes(2 * 1024 ** 3)).toBe('2,0 GB');
    expect(formatBytes(1.25 * 1024 ** 3, '.')).toBe('1.3 GB');
  });
});

describe('makeUuidV4', () => {
  const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

  it('format UUID v4 yang diterima validasi server (zod uuid)', () => {
    for (let i = 0; i < 50; i++) expect(makeUuidV4()).toMatch(UUID_V4);
    expect(makeUuidV4(() => 0.999999)).toMatch(UUID_V4);
    expect(makeUuidV4(() => 0)).toBe('00000000-0000-4000-8000-000000000000');
  });

  it('praktis unik', () => {
    expect(new Set(Array.from({ length: 1000 }, () => makeUuidV4())).size).toBe(1000);
  });
});

describe('parseExifDate', () => {
  it('jam lokal kamera → ISO', () => {
    expect(parseExifDate('2026:10:20 04:30:15')).toBe(new Date(2026, 9, 20, 4, 30, 15).toISOString());
  });

  it('kosong, rusak, atau tanggal mustahil → null', () => {
    expect(parseExifDate(undefined)).toBeNull();
    expect(parseExifDate('')).toBeNull();
    expect(parseExifDate('0000:00:00 00:00:00')).toBeNull();
    expect(parseExifDate('2026:02:31 10:00:00')).toBeNull();
    expect(parseExifDate(12345)).toBeNull();
  });
});

describe('jwtExpiry', () => {
  const b64url = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');

  it('membaca exp dari payload', () => {
    expect(jwtExpiry(`${b64url({ alg: 'HS256' })}.${b64url({ sub: 'x', exp: 1793000000 })}.sig`)).toBe(1793000000);
  });

  it('token rusak atau tanpa exp → null', () => {
    expect(jwtExpiry('bukan-token')).toBeNull();
    expect(jwtExpiry('a.!!!.c')).toBeNull();
    expect(jwtExpiry(`a.${b64url({ sub: 'x' })}.c`)).toBeNull();
  });
});

describe('formatDuration', () => {
  it('menit:detik dengan detik dua digit', () => {
    expect(formatDuration(45230)).toBe('0:45');
    expect(formatDuration(60000)).toBe('1:00');
    expect(formatDuration(5000)).toBe('0:05');
    expect(formatDuration(59600)).toBe('1:00');
  });

  it('durasi tidak diketahui → string kosong', () => {
    expect(formatDuration(null)).toBe('');
    expect(formatDuration(0)).toBe('');
  });
});

describe('isVideoTooLong', () => {
  it('maks 60 detik dengan sedikit kelonggaran pembulatan kamera', () => {
    expect(isVideoTooLong(VIDEO_MAX_DURATION_MS)).toBe(false);
    expect(isVideoTooLong(VIDEO_MAX_DURATION_MS + 400)).toBe(false);
    expect(isVideoTooLong(VIDEO_MAX_DURATION_MS + 2000)).toBe(true);
  });

  it('durasi tidak diketahui tidak ditolak di HP (server tetap membatasi ukuran)', () => {
    expect(isVideoTooLong(null)).toBe(false);
  });
});

describe('uploadTimeoutMs', () => {
  it('foto kecil memakai batas minimal 3 menit', () => {
    expect(uploadTimeoutMs(500 * 1024)).toBe(3 * 60_000);
  });

  it('video besar diberi waktu lebih untuk sinyal lemah, tetapi dibatasi di bawah batas server', () => {
    const t = uploadTimeoutMs(12 * 1024 * 1024);
    expect(t).toBeGreaterThan(3 * 60_000);
    expect(uploadTimeoutMs(40 * 1024 * 1024)).toBeLessThan(15 * 60_000);
  });
});

describe('fileExtensionFor', () => {
  it('ekstensi berkas unduhan dari MIME', () => {
    expect(fileExtensionFor('image/png')).toBe('png');
    expect(fileExtensionFor('image/webp')).toBe('webp');
    expect(fileExtensionFor('video/mp4')).toBe('mp4');
    expect(fileExtensionFor('video/quicktime')).toBe('mov');
    expect(fileExtensionFor('image/jpeg')).toBe('jpg');
  });
});
