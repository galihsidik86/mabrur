import { describe, it, expect } from 'vitest';
// Modul murni mobile (tanpa impor Expo) — dites di sini karena apps/mobile tidak punya test runner.
import {
  buildSchedule,
  currentSlot,
  nextPrayer,
  parseHHMM,
  qiblaBearing,
  headingDelta,
  nextAligned,
  smoothHeading,
  hijriTabular,
  hijriFromTable,
  toHijri,
  placeLabel,
  localDateKey,
  DHUHA_OFFSET_MIN,
} from '../../apps/mobile/src/services/prayer-core';

const TIMES = {
  fajr: '04:50', sunrise: '06:05', dhuhr: '11:55',
  asr: '15:15', maghrib: '17:45', isha: '19:15',
};

describe('parseHHMM', () => {
  it('mengubah HH:MM menjadi menit sejak tengah malam', () => {
    expect(parseHHMM('04:50')).toBe(290);
    expect(parseHHMM('00:00')).toBe(0);
  });

  it('menolak format atau nilai yang tidak sah', () => {
    expect(parseHHMM('--:--')).toBeNull();
    expect(parseHHMM('24:00')).toBeNull();
    expect(parseHHMM('12:60')).toBeNull();
    expect(parseHHMM(undefined)).toBeNull();
  });
});

describe('buildSchedule', () => {
  it('menyusun tujuh waktu berurutan dengan Dhuha = terbit + offset', () => {
    const s = buildSchedule(TIMES)!;
    expect(s.map((x) => x.key)).toEqual(['fajr', 'sunrise', 'dhuha', 'dhuhr', 'asr', 'maghrib', 'isha']);
    const dhuha = s.find((x) => x.key === 'dhuha')!;
    expect(dhuha.minutes).toBe(parseHHMM('06:05')! + DHUHA_OFFSET_MIN);
    expect(dhuha.time).toBe('06:25');
  });

  it('mengembalikan null bila ada waktu yang hilang atau rusak', () => {
    expect(buildSchedule({ ...TIMES, asr: '--:--' })).toBeNull();
    expect(buildSchedule({ fajr: '04:50' })).toBeNull();
    expect(buildSchedule(null)).toBeNull();
  });

  it('menolak jadwal yang tidak berurutan', () => {
    expect(buildSchedule({ ...TIMES, asr: '11:00' })).toBeNull();
  });
});

describe('currentSlot & nextPrayer', () => {
  const s = buildSchedule(TIMES)!;
  const at = (hhmm: string) => parseHHMM(hhmm)!;

  it('menyorot waktu terakhir yang sudah masuk', () => {
    expect(currentSlot(s, at('16:00'))).toBe('asr');
    expect(currentSlot(s, at('15:15'))).toBe('asr');
    expect(currentSlot(s, at('06:10'))).toBe('sunrise');
    expect(currentSlot(s, at('07:00'))).toBe('dhuha');
  });

  it('sebelum Subuh masih terhitung waktu Isya', () => {
    expect(currentSlot(s, at('02:00'))).toBe('isha');
  });

  it('salat berikutnya hanya salat wajib (Terbit/Dhuha dilewati)', () => {
    expect(nextPrayer(s, at('05:00'))).toEqual({ key: 'dhuhr', time: '11:55', minutesUntil: at('11:55') - at('05:00') });
    expect(nextPrayer(s, at('16:00'))).toEqual({ key: 'maghrib', time: '17:45', minutesUntil: 105 });
  });

  it('setelah Isya, berikutnya Subuh esok hari', () => {
    expect(nextPrayer(s, at('20:00'))).toEqual({ key: 'fajr', time: '04:50', minutesUntil: 24 * 60 - at('20:00') + at('04:50') });
  });

  it('pecahan menit dibulatkan ke atas agar hitung mundur tidak pernah 0 sebelum waktunya', () => {
    expect(nextPrayer(s, at('17:44') + 0.5)!.minutesUntil).toBe(1);
  });
});

describe('qiblaBearing', () => {
  it('arah kiblat dari Jakarta sekitar 295°', () => {
    expect(qiblaBearing(-6.2, 106.8)).toBeCloseTo(295.1, 0);
  });

  it('arah kiblat dari Madinah hampir ke selatan', () => {
    const b = qiblaBearing(24.4672, 39.6111);
    expect(b).toBeGreaterThan(170);
    expect(b).toBeLessThan(180);
  });

  it('hasil selalu di rentang [0, 360)', () => {
    for (const [lat, lng] of [[51.5, -0.12], [-33.9, 151.2], [40.7, -74]]) {
      const b = qiblaBearing(lat, lng);
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThan(360);
    }
  });
});

describe('headingDelta & nextAligned', () => {
  it('selisih bertanda: positif = putar ke kanan', () => {
    expect(headingDelta(295, 280)).toBe(15);
    expect(headingDelta(295, 310)).toBe(-15);
  });

  it('menangani lintasan 0°/360°', () => {
    expect(headingDelta(5, 355)).toBe(10);
    expect(headingDelta(355, 5)).toBe(-10);
    expect(headingDelta(180, 0)).toBe(180);
  });

  it('histeresis: masuk "Tepat" pada ≤5°, baru keluar setelah >8°', () => {
    expect(nextAligned(false, 6)).toBe(false);
    expect(nextAligned(false, -5)).toBe(true);
    expect(nextAligned(true, 7)).toBe(true);
    expect(nextAligned(true, -9)).toBe(false);
  });
});

describe('Hijriah', () => {
  it('toHijri memakai kalender Umm al-Qura (2 Okt 2026 = 21 Rabiulakhir 1448)', () => {
    expect(toHijri(new Date(2026, 9, 2, 12))).toEqual({ day: 21, month: 4, year: 1448 });
  });

  it('tabel cadangan identik dengan Umm al-Qura ICU untuk setiap hari 1445–1460 H', () => {
    const start = new Date(2023, 6, 19, 12);
    let mismatches = 0;
    for (let i = 0; i < 5600; i++) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i, 12);
      const expected = toHijri(d);
      if (expected.year > 1460) break;
      if (JSON.stringify(hijriFromTable(d)) !== JSON.stringify(expected)) mismatches++;
    }
    expect(mismatches).toBe(0);
  });

  it('tabel mengembalikan null di luar rentangnya', () => {
    expect(hijriFromTable(new Date(2023, 6, 18, 12))).toBeNull();
    expect(hijriFromTable(new Date(2045, 0, 1, 12))).toBeNull();
  });

  it('hijriTabular (cadangan terakhir) menghasilkan tanggal yang masuk akal', () => {
    const h = hijriTabular(new Date(2026, 9, 2, 12));
    expect(h.year).toBe(1448);
    expect(h.month).toBe(4);
    expect(Math.abs(h.day - 21)).toBeLessThanOrEqual(2);
  });
});

describe('placeLabel', () => {
  it('kota + negara', () => {
    expect(placeLabel({ city: 'Makkah', region: 'Makkah Province', country: 'Saudi Arabia' })).toBe('Makkah, Saudi Arabia');
  });

  it('jatuh ke subregion/region bila kota kosong, tanpa duplikasi', () => {
    expect(placeLabel({ city: null, subregion: 'Bogor', country: 'Indonesia' })).toBe('Bogor, Indonesia');
    expect(placeLabel({ city: 'Singapore', country: 'Singapore' })).toBe('Singapore');
  });

  it('null bila tidak ada data', () => {
    expect(placeLabel({})).toBeNull();
    expect(placeLabel(null)).toBeNull();
  });
});

describe('localDateKey', () => {
  it('YYYY-MM-DD menurut tanggal lokal perangkat', () => {
    expect(localDateKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });
});

describe('smoothHeading', () => {
  it('sampel pertama dipakai apa adanya (dinormalkan)', () => {
    expect(smoothHeading(null, 370)).toBe(10);
  });

  it('bergerak sebagian ke arah sampel baru', () => {
    expect(smoothHeading(100, 120, 0.25)).toBe(105);
  });

  it('mengambil jalur terpendek melintasi 0°/360°', () => {
    expect(smoothHeading(350, 10, 0.5)).toBe(0);
    expect(smoothHeading(10, 350, 0.5)).toBe(0);
  });
});
