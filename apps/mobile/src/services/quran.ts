// Akses data Al-Qur'an offline: assets/quran/quran-v1.db (dibundel di APK, read-only).
// Saat pertama dibuka, berkas aset disalin ke folder SQLite aplikasi; berikutnya langsung dibuka.
// Bila isi data berubah, naikkan nama berkas (quran-v2.db) lewat scripts/build-quran.py.
import * as SQLite from 'expo-sqlite';
import { getMeta, setMeta } from './db';
import { QURAN_DB_NAME, SURAHS } from './quran-meta';
import { parseBookmark, parseFontStep, type AyahRef } from './quran-core';

export type Ayah = {
  surah: number;
  ayah: number;
  juz: number;
  textAr: string;
  translation: string;
  footnotes: string;
};

type AyahRow = {
  surah: number;
  ayah: number;
  juz: number;
  text_ar: string;
  translation_id: string;
  footnotes_id: string;
};

const BOOKMARK_KEY = 'quran_last_read';
const FONT_KEY = 'quran_font_step';
const SELECT = 'SELECT surah, ayah, juz, text_ar, translation_id, footnotes_id FROM ayah';

// Nama berkas di require() harus sama dengan QURAN_DB_NAME — dicek oleh scripts/build-quran.py.
const QURAN_ASSET = require('../../assets/quran/quran-v1.db');
const TOTAL_AYAT = SURAHS.reduce((n, m) => n + m.ayahs, 0);

let opening: Promise<SQLite.SQLiteDatabase> | null = null;

async function importAndOpen(forceOverwrite: boolean): Promise<SQLite.SQLiteDatabase> {
  await SQLite.importDatabaseFromAssetAsync(QURAN_DB_NAME, { assetId: QURAN_ASSET, forceOverwrite });
  return SQLite.openDatabaseAsync(QURAN_DB_NAME);
}

async function isIntact(db: SQLite.SQLiteDatabase): Promise<boolean> {
  try {
    const row = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM ayah');
    return row?.n === TOTAL_AYAT;
  } catch {
    return false;
  }
}

// Salinan pertama bisa terpotong (aplikasi ditutup / memori penuh saat menyalin) → salin ulang sekali.
async function openVerified(): Promise<SQLite.SQLiteDatabase> {
  const db = await importAndOpen(false);
  if (await isIntact(db)) return db;
  await db.closeAsync().catch(() => { /* tetap hapus & salin ulang */ });
  await SQLite.deleteDatabaseAsync(QURAN_DB_NAME).catch(() => { /* forceOverwrite menimpa */ });
  const fresh = await importAndOpen(true);
  if (await isIntact(fresh)) return fresh;
  await fresh.closeAsync().catch(() => { /* abaikan */ });
  throw new Error('data Al-Qur\'an rusak setelah disalin ulang');
}

function openQuran(): Promise<SQLite.SQLiteDatabase> {
  if (!opening) {
    opening = openVerified();
    // Gagal (mis. penyimpanan penuh) → izinkan coba lagi pada pemanggilan berikutnya.
    opening.catch(() => { opening = null; });
  }
  return opening;
}

// Kueri gagal → buang koneksi agar "Coba lagi" benar-benar membuka & memeriksa ulang.
async function queryAyat(sql: string, arg: number): Promise<Ayah[]> {
  try {
    const db = await openQuran();
    const rows = await db.getAllAsync<AyahRow>(sql, [arg]);
    return rows.map(toAyah);
  } catch (e) {
    opening = null;
    throw e;
  }
}

// Dipanggil dari layar daftar agar penyalinan pertama tidak terasa di layar baca.
export function prepareQuran(): void {
  openQuran().catch(() => { /* layar baca menampilkan galat & tombol coba lagi */ });
}

function toAyah(r: AyahRow): Ayah {
  return {
    surah: r.surah,
    ayah: r.ayah,
    juz: r.juz,
    textAr: r.text_ar,
    translation: r.translation_id,
    footnotes: r.footnotes_id,
  };
}

export function getSurahAyat(surah: number): Promise<Ayah[]> {
  return queryAyat(`${SELECT} WHERE surah = ? ORDER BY ayah`, surah);
}

export function getJuzAyat(juz: number): Promise<Ayah[]> {
  return queryAyat(`${SELECT} WHERE juz = ? ORDER BY surah, ayah`, juz);
}

export async function getBookmark(): Promise<AyahRef | null> {
  return parseBookmark(await getMeta(BOOKMARK_KEY));
}

export async function saveBookmark(ref: AyahRef): Promise<void> {
  await setMeta(BOOKMARK_KEY, JSON.stringify({ surah: ref.surah, ayah: ref.ayah }));
}

export async function getFontStep(): Promise<number> {
  return parseFontStep(await getMeta(FONT_KEY));
}

export async function saveFontStep(step: number): Promise<void> {
  await setMeta(FONT_KEY, String(step));
}
