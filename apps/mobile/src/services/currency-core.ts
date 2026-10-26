// Logika murni konverter kurs (tanpa impor Expo — bisa dites dari vitest).
import type { Lang } from '../i18n/core';

/** Selalu disematkan di atas daftar (setelah yang terakhir dipakai). */
export const PINNED_CURRENCIES = ['SAR', 'IDR', 'USD'] as const;
const MAX_RECENT = 5;

/** rates: 1 unit basis = rates[KODE] unit KODE (basis bebas, mis. SAR dari server). */
export function convert(amount: number, from: string, to: string, rates: Record<string, number>): number | null {
  const rFrom = rates[from];
  const rTo = rates[to];
  if (!rFrom || !rTo) return null;
  return (amount / rFrom) * rTo;
}

const CURRENCY_CODE = /^[A-Z]{3}$/;
const DEFAULT_PAIR = { from: 'SAR', to: 'IDR' } as const;

/**
 * Teks jumlah -> angka, mengenali pemisah ribuan per bahasa (id "1.000" = seribu,
 * en "1,000" = seribu). Aturan: bila ada titik & koma, yang terakhir = desimal;
 * satu jenis pemisah yang muncul berulang = ribuan; satu pemisah diikuti tepat 3 digit
 * = ribuan bila itu pemisah ribuan bahasa aktif; selain itu desimal.
 * Kosong, negatif, notasi ilmiah/hex, atau tak hingga -> null.
 */
export function parseAmount(text: string, lang: Lang): number | null {
  const raw = text.replace(/\s/g, '');
  if (!/^[0-9.,]*[0-9][0-9.,]*$/.test(raw)) return null;

  const dots = raw.split('.').length - 1;
  const commas = raw.split(',').length - 1;
  let normalized = raw;
  if (dots > 0 && commas > 0) {
    const decimal = raw.lastIndexOf('.') > raw.lastIndexOf(',') ? '.' : ',';
    const group = decimal === '.' ? ',' : '.';
    normalized = raw.split(group).join('').replace(decimal, '.');
  } else if (dots + commas > 0) {
    const sep = dots > 0 ? '.' : ',';
    const digitsAfter = raw.length - raw.indexOf(sep) - 1;
    const langGroup = lang === 'id' ? '.' : ',';
    const isGrouping = dots + commas > 1 || (sep === langGroup && digitsAfter === 3);
    normalized = isGrouping ? raw.split(sep).join('') : raw.replace(sep, '.');
  }

  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

/** Objek kurs dari server/cache layak dipakai: punya rates berisi angka positif. */
export function isValidRates(value: unknown): value is { rates: Record<string, number> } {
  const rates = (value as { rates?: unknown } | null)?.rates;
  if (!rates || typeof rates !== 'object') return false;
  return Object.values(rates as Record<string, unknown>).some((r) => typeof r === 'number' && Number.isFinite(r) && r > 0);
}

/** Pasangan tersimpan yang rusak / kodenya tak ada di kurs -> SAR->IDR (atau dua kode pertama). */
export function sanitizePair(raw: unknown, rates: Record<string, number>): { from: string; to: string } {
  const p = raw as { from?: unknown; to?: unknown } | null;
  if (p && typeof p.from === 'string' && typeof p.to === 'string' && p.from !== p.to && rates[p.from] && rates[p.to]) {
    return { from: p.from, to: p.to };
  }
  if (rates[DEFAULT_PAIR.from] && rates[DEFAULT_PAIR.to]) return { ...DEFAULT_PAIR };
  const [first = DEFAULT_PAIR.from, second = DEFAULT_PAIR.to] = Object.keys(rates);
  return { from: first, to: second };
}

/** Daftar terakhir dipakai dari penyimpanan: hanya kode 3 huruf. */
export function sanitizeRecent(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((c): c is string => typeof c === 'string' && CURRENCY_CODE.test(c)).slice(0, MAX_RECENT);
}

// Nama mata uang yang paling relevan bagi jamaah & pengguna luar negeri. Kode lain
// memakai Intl.DisplayNames bila tersedia di perangkat, atau tampil sebagai kode.
const NAMES: Record<string, { id: string; en: string }> = {
  SAR: { id: 'Riyal Saudi', en: 'Saudi Riyal' },
  IDR: { id: 'Rupiah Indonesia', en: 'Indonesian Rupiah' },
  USD: { id: 'Dolar Amerika Serikat', en: 'US Dollar' },
  EUR: { id: 'Euro', en: 'Euro' },
  MYR: { id: 'Ringgit Malaysia', en: 'Malaysian Ringgit' },
  SGD: { id: 'Dolar Singapura', en: 'Singapore Dollar' },
  BND: { id: 'Dolar Brunei', en: 'Brunei Dollar' },
  GBP: { id: 'Pound Sterling Inggris', en: 'British Pound' },
  AUD: { id: 'Dolar Australia', en: 'Australian Dollar' },
  JPY: { id: 'Yen Jepang', en: 'Japanese Yen' },
  CNY: { id: 'Yuan Tiongkok', en: 'Chinese Yuan' },
  AED: { id: 'Dirham Uni Emirat Arab', en: 'UAE Dirham' },
  QAR: { id: 'Riyal Qatar', en: 'Qatari Riyal' },
  KWD: { id: 'Dinar Kuwait', en: 'Kuwaiti Dinar' },
  BHD: { id: 'Dinar Bahrain', en: 'Bahraini Dinar' },
  OMR: { id: 'Rial Oman', en: 'Omani Rial' },
  JOD: { id: 'Dinar Yordania', en: 'Jordanian Dinar' },
  EGP: { id: 'Pound Mesir', en: 'Egyptian Pound' },
  TRY: { id: 'Lira Turki', en: 'Turkish Lira' },
  PKR: { id: 'Rupee Pakistan', en: 'Pakistani Rupee' },
  INR: { id: 'Rupee India', en: 'Indian Rupee' },
  BDT: { id: 'Taka Bangladesh', en: 'Bangladeshi Taka' },
  THB: { id: 'Baht Thailand', en: 'Thai Baht' },
  PHP: { id: 'Peso Filipina', en: 'Philippine Peso' },
  NGN: { id: 'Naira Nigeria', en: 'Nigerian Naira' },
  ZAR: { id: 'Rand Afrika Selatan', en: 'South African Rand' },
  CAD: { id: 'Dolar Kanada', en: 'Canadian Dollar' },
  CHF: { id: 'Franc Swiss', en: 'Swiss Franc' },
  KRW: { id: 'Won Korea Selatan', en: 'South Korean Won' },
  HKD: { id: 'Dolar Hong Kong', en: 'Hong Kong Dollar' },
  NZD: { id: 'Dolar Selandia Baru', en: 'New Zealand Dollar' },
};

let displayNames: Partial<Record<Lang, { of: (code: string) => string | undefined } | null>> = {};

function intlName(code: string, lang: Lang): string | null {
  if (displayNames[lang] === undefined) {
    try {
      // Tidak semua build Hermes menyediakan Intl.DisplayNames -> fallback ke kode.
      const DN = (Intl as unknown as { DisplayNames?: new (l: string[], o: object) => { of: (c: string) => string | undefined } }).DisplayNames;
      displayNames = { ...displayNames, [lang]: DN ? new DN([lang], { type: 'currency' }) : null };
    } catch {
      displayNames = { ...displayNames, [lang]: null };
    }
  }
  const name = displayNames[lang]?.of(code);
  return name && name !== code ? name : null;
}

export function currencyName(code: string, lang: Lang): string {
  return NAMES[code]?.[lang] ?? intlName(code, lang) ?? code;
}

/** Urutan tampil: terakhir dipakai -> disematkan (SAR/IDR/USD) -> sisanya A-Z. */
export function orderCurrencies(codes: string[], recent: string[]): string[] {
  const available = new Set(codes);
  const head = [...recent, ...PINNED_CURRENCIES].filter((c, i, arr) => available.has(c) && arr.indexOf(c) === i);
  const rest = codes.filter((c) => !head.includes(c)).sort();
  return [...head, ...rest];
}

/** Cari menurut kode atau nama dalam bahasa aktif; query kosong = semua. */
export function searchCurrencies(codes: string[], query: string, lang: Lang): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return codes;
  return codes.filter((c) => c.toLowerCase().includes(q) || currencyName(c, lang).toLowerCase().includes(q));
}

/** Tambah ke daftar terakhir dipakai (paling baru di depan) tanpa memutasi input. */
export function pushRecent(recent: string[], code: string): string[] {
  return [code, ...recent.filter((c) => c !== code)].slice(0, MAX_RECENT);
}
