import { describe, it, expect } from 'vitest';
// Modul murni mobile (tanpa impor Expo) — dites di sini karena apps/mobile tidak punya test runner.
import { resolveInitialLang, interpolate } from '../../apps/mobile/src/i18n/core';
import { id } from '../../apps/mobile/src/i18n/locales/id';
import { en } from '../../apps/mobile/src/i18n/locales/en';

describe('resolveInitialLang', () => {
  it('pilihan tersimpan menang atas bahasa HP', () => {
    expect(resolveInitialLang('en', 'id-ID')).toBe('en');
    expect(resolveInitialLang('id', 'en-US')).toBe('id');
  });

  it('tanpa pilihan tersimpan: ikut bahasa HP', () => {
    expect(resolveInitialLang(null, 'en-GB')).toBe('en');
    expect(resolveInitialLang(null, 'id-ID')).toBe('id');
    expect(resolveInitialLang(null, 'in-ID')).toBe('id'); // kode lama Android untuk Indonesia
  });

  it('bahasa HP lain (mis. Arab, Melayu) atau tak terbaca: Indonesia', () => {
    expect(resolveInitialLang(null, 'ar-SA')).toBe('id');
    expect(resolveInitialLang(null, null)).toBe('id');
  });

  it('nilai tersimpan yang tidak didukung lagi (ar dari versi lama) diabaikan', () => {
    expect(resolveInitialLang('ar', 'en-US')).toBe('en');
  });
});

describe('interpolate', () => {
  it('mengisi {param} dan membiarkan param yang tidak diberikan', () => {
    expect(interpolate('Hai, {name}', { name: 'Siti' })).toBe('Hai, Siti');
    expect(interpolate('{count} anggota', { count: 3 })).toBe('3 anggota');
    expect(interpolate('Hai, {name}')).toBe('Hai, {name}');
  });
});

describe('file bahasa', () => {
  const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();

  it('English punya kunci yang persis sama dengan Indonesia', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(id).sort());
  });

  it('placeholder {…} sama di kedua bahasa dan tidak ada teks kosong', () => {
    for (const key of Object.keys(id) as Array<keyof typeof id>) {
      expect(placeholders(en[key]), key).toEqual(placeholders(id[key]));
      expect(id[key].trim(), key).not.toBe('');
      expect(en[key].trim(), key).not.toBe('');
    }
  });
});
