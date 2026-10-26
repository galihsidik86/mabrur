import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { resolveInitialLang, interpolate, type Lang, type TranslateParams } from '../i18n/core';
import { id, type TranslationKey } from '../i18n/locales/id';
import { en } from '../i18n/locales/en';
import { api } from './api';

export type { Lang, TranslationKey };

const LOCALES: Record<Lang, Record<TranslationKey, string>> = { id, en };
// SecureStore (bukan SQLite): tidak terhapus saat logout & sudah tersedia di layar login.
const LANG_KEY = 'app_lang';

export type TFunction = (key: TranslationKey, params?: TranslateParams) => string;

// true setelah bahasa dimuat atau dipilih di proses JS ini.
let initialized = false;

function makeT(lang: Lang): TFunction {
  return (key, params) => interpolate(LOCALES[lang][key] ?? id[key] ?? key, params);
}

function deviceLocale(): string | null {
  try {
    // Hermes menyediakan Intl -> locale bawaan HP, tanpa dependensi native tambahan.
    return Intl.DateTimeFormat().resolvedOptions().locale ?? null;
  } catch {
    return null;
  }
}

interface I18nState {
  lang: Lang;
  /** Identitas berganti saat bahasa berganti -> komponen yang memilih `t` ikut render ulang. */
  t: TFunction;
  setLang: (lang: Lang) => Promise<void>;
}

export const useI18n = create<I18nState>((set) => ({
  lang: 'id',
  t: makeT('id'),
  setLang: async (lang) => {
    initialized = true;
    set({ lang, t: makeT(lang) });
    await SecureStore.setItemAsync(LANG_KEY, lang).catch(() => {});
    // Gagal saat belum login/offline tidak masalah: disinkronkan lagi setelah login (_layout).
    api.setLanguage(lang).catch(() => {});
  },
}));

/**
 * Muat pilihan bahasa (atau bahasa HP) — panggil saat app start dan di task latar belakang.
 * Idempoten per proses JS: bila UI sudah memuat/memilih bahasa, task latar belakang yang
 * berjalan di context yang sama tidak membaca ulang (bisa membaca nilai lama saat penulisan
 * SecureStore belum selesai dan mengembalikan bahasa ke pilihan sebelumnya).
 */
export async function initLanguage(): Promise<Lang> {
  if (initialized) return useI18n.getState().lang;
  const stored = await SecureStore.getItemAsync(LANG_KEY).catch(() => null);
  if (initialized) return useI18n.getState().lang; // setLang terjadi selama await di atas
  const lang = resolveInitialLang(stored, deviceLocale());
  initialized = true;
  useI18n.setState({ lang, t: makeT(lang) });
  return lang;
}

/** Terjemahan di luar komponen React (notifikasi lokal, Alert dari service). */
export function translate(key: TranslationKey, params?: TranslateParams): string {
  return useI18n.getState().t(key, params);
}
