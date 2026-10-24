// Logika murni pemilihan bahasa (tanpa impor Expo — bisa dites dari vitest).

export type Lang = 'id' | 'en';
export const SUPPORTED_LANGS: readonly Lang[] = ['id', 'en'];
const DEFAULT_LANG: Lang = 'id';

function isLang(value: string | null): value is Lang {
  return value != null && (SUPPORTED_LANGS as readonly string[]).includes(value);
}

/**
 * Bahasa awal: pilihan yang tersimpan > bahasa HP (jika didukung) > Indonesia.
 * Nilai tersimpan yang sudah tidak didukung (mis. 'ar' dari versi lama) diabaikan.
 */
export function resolveInitialLang(stored: string | null, deviceLocale: string | null): Lang {
  if (isLang(stored)) return stored;
  const base = deviceLocale?.toLowerCase().split(/[-_]/)[0] ?? null;
  if (base === 'in') return 'id'; // kode ISO lama untuk Indonesia (masih dipakai sebagian Android)
  return isLang(base) ? base : DEFAULT_LANG;
}

export type TranslateParams = Record<string, string | number>;

/** Isi {param} pada teks; param yang tidak diberikan dibiarkan apa adanya. */
export function interpolate(template: string, params?: TranslateParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match);
}
