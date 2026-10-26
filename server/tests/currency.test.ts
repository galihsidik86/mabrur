import { describe, it, expect } from 'vitest';
import { parseRatesResponse } from '../src/services/currency-core';
// Modul murni mobile (tanpa impor Expo) — dites di sini karena apps/mobile tidak punya test runner.
import {
  convert,
  parseAmount,
  orderCurrencies,
  searchCurrencies,
  pushRecent,
  currencyName,
  isValidRates,
  sanitizePair,
  sanitizeRecent,
} from '../../apps/mobile/src/services/currency-core';

describe('parseRatesResponse (server)', () => {
  const ok = {
    result: 'success',
    base_code: 'SAR',
    time_last_update_utc: 'Fri, 23 Oct 2026 00:02:31 +0000',
    time_last_update_unix: 1792713751,
    rates: { SAR: 1, IDR: 4250.5, USD: 0.2666, EUR: 0.245 },
  };

  it('mengambil semua kurs valid dan waktu pembaruan', () => {
    const r = parseRatesResponse(ok);
    expect(r.base).toBe('SAR');
    expect(r.rates).toEqual({ SAR: 1, IDR: 4250.5, USD: 0.2666, EUR: 0.245 });
    expect(r.updated).toBe(ok.time_last_update_utc);
  });

  it('waktu pembaruan juga dalam ISO (teks RFC-2822 belum tentu terbaca Hermes di HP)', () => {
    expect(parseRatesResponse(ok).updated_at).toBe(new Date(1792713751 * 1000).toISOString());
    expect(parseRatesResponse({ ...ok, time_last_update_unix: undefined }).updated_at).toBeNull();
  });

  it('membuang entri tidak valid (kode bukan 3 huruf, nilai bukan angka positif)', () => {
    const r = parseRatesResponse({ ...ok, rates: { ...ok.rates, xx: 1, ABCD: 2, NEG: -1, NAN: 'a', ZER: 0 } });
    expect(Object.keys(r.rates).sort()).toEqual(['EUR', 'IDR', 'SAR', 'USD']);
  });

  it('menolak respons gagal / tanpa IDR (field lama sar_to_idr wajib tetap terisi)', () => {
    expect(() => parseRatesResponse({ ...ok, result: 'error' })).toThrow();
    expect(() => parseRatesResponse({ ...ok, rates: { SAR: 1, USD: 0.26 } })).toThrow();
    expect(() => parseRatesResponse(null)).toThrow();
  });
});

describe('convert (mobile)', () => {
  const rates = { SAR: 1, IDR: 4250, USD: 0.25, MYR: 1.25 };

  it('konversi dua arah lewat mata uang basis', () => {
    expect(convert(10, 'SAR', 'IDR', rates)).toBe(42500);
    expect(convert(42500, 'IDR', 'SAR', rates)).toBe(10);
    expect(convert(1, 'USD', 'MYR', rates)).toBe(5);
  });

  it('null bila mata uang tidak ada di daftar kurs', () => {
    expect(convert(1, 'SAR', 'XYZ', rates)).toBeNull();
  });
});

describe('parseAmount (mobile)', () => {
  it('menerima koma atau titik desimal', () => {
    expect(parseAmount('12,5', 'id')).toBe(12.5);
    expect(parseAmount('12.5', 'id')).toBe(12.5);
    expect(parseAmount(' 100 ', 'id')).toBe(100);
  });
  it('pemisah ribuan sesuai bahasa: id "1.000" = seribu, en "1,000" = seribu', () => {
    expect(parseAmount('1.000', 'id')).toBe(1000);
    expect(parseAmount('1.000.000', 'id')).toBe(1000000);
    expect(parseAmount('1.000,50', 'id')).toBe(1000.5);
    expect(parseAmount('1,000', 'en')).toBe(1000);
    expect(parseAmount('1,234.56', 'en')).toBe(1234.56);
    expect(parseAmount('1.000', 'en')).toBe(1);
  });
  it('null untuk input kosong, negatif, notasi aneh, atau tak hingga', () => {
    expect(parseAmount('', 'id')).toBeNull();
    expect(parseAmount('-3', 'id')).toBeNull();
    expect(parseAmount('abc', 'id')).toBeNull();
    expect(parseAmount('1e3', 'id')).toBeNull();
    expect(parseAmount('0x10', 'id')).toBeNull();
    expect(parseAmount('9'.repeat(400), 'id')).toBeNull();
  });
});

describe('validasi data tersimpan (mobile)', () => {
  const rates = { SAR: 1, IDR: 4250, USD: 0.25 };

  it('isValidRates: hanya objek rates berisi angka positif', () => {
    expect(isValidRates({ base: 'SAR', rates, updated: '', is_fallback: false })).toBe(true);
    expect(isValidRates({ sar_to_idr: 4250, updated: 'x' })).toBe(false); // respons server versi lama
    expect(isValidRates({ rates: {} })).toBe(false);
    expect(isValidRates(null)).toBe(false);
  });

  it('sanitizePair: pasangan rusak atau kode yang tidak ada di kurs -> SAR/IDR', () => {
    expect(sanitizePair({ from: 'USD', to: 'SAR' }, rates)).toEqual({ from: 'USD', to: 'SAR' });
    expect(sanitizePair(null, rates)).toEqual({ from: 'SAR', to: 'IDR' });
    expect(sanitizePair({ from: 'XYZ', to: 'IDR' }, rates)).toEqual({ from: 'SAR', to: 'IDR' });
    expect(sanitizePair({ from: 7 }, rates)).toEqual({ from: 'SAR', to: 'IDR' });
  });

  it('sanitizeRecent: hanya array kode 3 huruf', () => {
    expect(sanitizeRecent(['USD', 3, 'xx', 'MYR'])).toEqual(['USD', 'MYR']);
    expect(sanitizeRecent({ a: 1 })).toEqual([]);
  });
});

describe('daftar mata uang (mobile)', () => {
  const codes = ['USD', 'EUR', 'SAR', 'IDR', 'MYR', 'AED', 'JPY'];

  it('urutan: terakhir dipakai, lalu SAR/IDR/USD, lalu sisanya A-Z', () => {
    expect(orderCurrencies(codes, ['MYR'])).toEqual(['MYR', 'SAR', 'IDR', 'USD', 'AED', 'EUR', 'JPY']);
  });

  it('pencarian menurut kode atau nama (bahasa aktif), tanpa peka huruf besar', () => {
    expect(searchCurrencies(codes, 'myr', 'id')).toEqual(['MYR']);
    expect(searchCurrencies(codes, 'riyal', 'id')).toEqual(['SAR']);
    expect(searchCurrencies(codes, 'ringgit', 'en')).toEqual(['MYR']);
    expect(searchCurrencies(codes, 'dollar', 'en')).toEqual(['USD']);
    expect(searchCurrencies(codes, '', 'id')).toEqual(codes);
  });

  it('nama mengikuti bahasa; kode tak dikenal tetap tampil sebagai kode', () => {
    expect(currencyName('SAR', 'id')).toBe('Riyal Saudi');
    expect(currencyName('SAR', 'en')).toBe('Saudi Riyal');
    expect(currencyName('ZZZ', 'id')).toBe('ZZZ');
  });

  it('pushRecent: paling baru di depan, tanpa duplikat, dibatasi, tidak memutasi input', () => {
    const before = ['IDR', 'USD'];
    expect(pushRecent(before, 'USD')).toEqual(['USD', 'IDR']);
    expect(pushRecent(['A', 'B', 'C', 'D', 'E'], 'F')).toEqual(['F', 'A', 'B', 'C', 'D']);
    expect(before).toEqual(['IDR', 'USD']);
  });
});
