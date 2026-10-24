import { describe, it, expect } from 'vitest';
// Modul murni mobile (tanpa impor Expo) — dites di sini karena apps/mobile tidak punya test runner.
import {
  isValidRef,
  showsBasmalah,
  juzOf,
  juzStart,
  juzSegments,
  normalizeLatin,
  searchSurahs,
  parseBookmark,
  parseFontStep,
  toArabicDigits,
  buildReaderItems,

  DEFAULT_FONT_STEP,
  FONT_STEPS,
  JUZ_COUNT,
} from '../../apps/mobile/src/services/quran-core';
import { SURAHS, JUZ_STARTS, BASMALAH } from '../../apps/mobile/src/services/quran-meta';

describe('metadata', () => {
  it('114 surah, total 6236 ayat, nomor berurutan', () => {
    expect(SURAHS).toHaveLength(114);
    expect(SURAHS.reduce((n, m) => n + m.ayahs, 0)).toBe(6236);
    SURAHS.forEach((m, i) => expect(m.number).toBe(i + 1));
  });

  it('30 awal juz, berurutan naik', () => {
    expect(JUZ_STARTS).toHaveLength(JUZ_COUNT);
    for (let i = 1; i < JUZ_STARTS.length; i++) {
      const [ps, pa] = JUZ_STARTS[i - 1];
      const [s, a] = JUZ_STARTS[i];
      expect(s > ps || (s === ps && a > pa)).toBe(true);
    }
  });
});

describe('isValidRef', () => {
  it('menerima ayat yang ada', () => {
    expect(isValidRef(1, 7)).toBe(true);
    expect(isValidRef(2, 286)).toBe(true);
    expect(isValidRef(114, 6)).toBe(true);
  });

  it('menolak di luar jangkauan atau bukan bilangan bulat', () => {
    expect(isValidRef(1, 8)).toBe(false);
    expect(isValidRef(0, 1)).toBe(false);
    expect(isValidRef(115, 1)).toBe(false);
    expect(isValidRef(2, 0)).toBe(false);
    expect(isValidRef(2.5, 1)).toBe(false);
    expect(isValidRef(Number.NaN, 1)).toBe(false);
  });
});

describe('showsBasmalah', () => {
  it('tidak untuk Al-Fatihah dan At-Taubah', () => {
    expect(showsBasmalah(1)).toBe(false);
    expect(showsBasmalah(9)).toBe(false);
    expect(showsBasmalah(2)).toBe(true);
    expect(showsBasmalah(114)).toBe(true);
  });
});

describe('juz', () => {
  it('juzOf di batas juz', () => {
    expect(juzOf(1, 1)).toBe(1);
    expect(juzOf(2, 141)).toBe(1);
    expect(juzOf(2, 142)).toBe(2);
    expect(juzOf(2, 255)).toBe(3);
    expect(juzOf(18, 74)).toBe(15);
    expect(juzOf(18, 75)).toBe(16);
    expect(juzOf(78, 1)).toBe(30);
    expect(juzOf(114, 6)).toBe(30);
  });

  it('juzStart dijepit ke 1..30', () => {
    expect(juzStart(1)).toEqual({ surah: 1, ayah: 1 });
    expect(juzStart(30)).toEqual({ surah: 78, ayah: 1 });
    expect(juzStart(0)).toEqual({ surah: 1, ayah: 1 });
    expect(juzStart(99)).toEqual({ surah: 78, ayah: 1 });
  });

  it('juzSegments membagi juz lintas surah', () => {
    expect(juzSegments(1)).toEqual([
      { surah: 1, from: 1, to: 7 },
      { surah: 2, from: 1, to: 141 },
    ]);
    expect(juzSegments(2)).toEqual([{ surah: 2, from: 142, to: 252 }]);
    // Juz 14 dimulai tepat di awal surah 15 dan berakhir di akhir surah 16.
    expect(juzSegments(14)).toEqual([
      { surah: 15, from: 1, to: 99 },
      { surah: 16, from: 1, to: 128 },
    ]);
    const last = juzSegments(30);
    expect(last[0]).toEqual({ surah: 78, from: 1, to: 40 });
    expect(last[last.length - 1]).toEqual({ surah: 114, from: 1, to: 6 });
    expect(last).toHaveLength(37);
  });

  it('seluruh juz menutup 6236 ayat tanpa celah', () => {
    let total = 0;
    for (let j = 1; j <= JUZ_COUNT; j++) {
      for (const seg of juzSegments(j)) total += seg.to - seg.from + 1;
    }
    expect(total).toBe(6236);
  });
});

describe('normalizeLatin', () => {
  it('membuang diakritik, tanda baca, huruf besar', () => {
    expect(normalizeLatin('Al-Fātiḥah')).toBe('alfatihah');
    expect(normalizeLatin("Ali 'Imran")).toBe('aliimran');
  });
});

describe('searchSurahs', () => {
  const names = (q: string) => searchSurahs(q).map((m) => m.number);

  it('kosong = semua surah', () => {
    expect(searchSurahs('  ')).toHaveLength(114);
  });

  it('nomor persis', () => {
    expect(names('36')).toEqual([36]);
    expect(names('200')).toEqual([]);
  });

  it('nama dengan/tanpa kata sandang & tanda hubung', () => {
    expect(names('baqarah')[0]).toBe(2);
    expect(names('al baqarah')[0]).toBe(2);
    expect(names('An-Nas')[0]).toBe(114);
    expect(names('nas')[0]).toBe(114);
  });

  it('ejaan berbeda tetap ketemu lewat kerangka konsonan', () => {
    expect(names('kahfi')).toContain(18);
    expect(names('yasin')).toContain(36);
  });

  it('arti surah (id & en) dan nama Arab', () => {
    expect(names('sapi')).toContain(2);
    expect(names('the cow')).toContain(2);
    expect(names('الفاتحة')).toEqual([1]);
  });

  it('kueri tak bermakna tidak cocok apa pun', () => {
    expect(names('zzzzqx')).toEqual([]);
  });
});

describe('parseBookmark', () => {
  it('JSON valid', () => {
    expect(parseBookmark('{"surah":2,"ayah":255}')).toEqual({ surah: 2, ayah: 255 });
  });

  it('rusak, kosong, atau di luar jangkauan → null', () => {
    expect(parseBookmark(null)).toBeNull();
    expect(parseBookmark('')).toBeNull();
    expect(parseBookmark('bukan json')).toBeNull();
    expect(parseBookmark('null')).toBeNull();
    expect(parseBookmark('{"surah":"2","ayah":1}')).toBeNull();
    expect(parseBookmark('{"surah":1,"ayah":8}')).toBeNull();
  });
});

describe('parseFontStep', () => {
  it('indeks valid dipakai, selain itu bawaan', () => {
    expect(parseFontStep('3')).toBe(3);
    expect(parseFontStep('0')).toBe(0);
    expect(parseFontStep(null)).toBe(DEFAULT_FONT_STEP);
    expect(parseFontStep('')).toBe(DEFAULT_FONT_STEP);
    expect(parseFontStep(String(FONT_STEPS.length))).toBe(DEFAULT_FONT_STEP);
    expect(parseFontStep('1.5')).toBe(DEFAULT_FONT_STEP);
  });
});

describe('buildReaderItems', () => {
  it('kepala surah dengan basmalah sebelum ayat 1', () => {
    const items = buildReaderItems([{ surah: 2, ayah: 1 }, { surah: 2, ayah: 2 }]);
    expect(items.map((i) => i.key)).toEqual(['h2', '2:1', '2:2']);
    expect(items[0]).toMatchObject({ kind: 'header', basmalah: true });
  });

  it('Al-Fatihah & At-Taubah tanpa basmalah tambahan', () => {
    expect(buildReaderItems([{ surah: 1, ayah: 1 }])[0]).toMatchObject({ basmalah: false });
    expect(buildReaderItems([{ surah: 9, ayah: 1 }])[0]).toMatchObject({ basmalah: false });
  });

  it('juz yang mulai di tengah surah: kepala tanpa basmalah, lalu kepala baru tiap ganti surah', () => {
    const items = buildReaderItems([{ surah: 2, ayah: 141 }, { surah: 3, ayah: 1 }]);
    expect(items.map((i) => i.key)).toEqual(['h2', '2:141', 'h3', '3:1']);
    expect(items[0]).toMatchObject({ basmalah: false });
    expect(items[2]).toMatchObject({ basmalah: true });
  });

  it('BASMALAH tidak kosong dan berhuruf Arab', () => {
    expect(BASMALAH).toMatch(/^[؀-ۿ\s]+$/);
  });
});

describe('toArabicDigits', () => {
  it('mengubah ke angka Arab-Indik', () => {
    expect(toArabicDigits(255)).toBe('٢٥٥');
    expect(toArabicDigits(7)).toBe('٧');
  });
});
