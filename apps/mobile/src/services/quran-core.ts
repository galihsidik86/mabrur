// Logika murni Al-Qur'an (tanpa impor Expo) — dites dari server/tests/quran-core.test.ts.
// Data metadata ada di quran-meta.ts (dihasilkan scripts/build-quran.py).
import { JUZ_STARTS, SURAHS } from './quran-meta';

export type SurahMeta = {
  number: number;
  nameAr: string;
  nameLatin: string;
  meaningId: string;
  meaningEn: string;
  place: 'makkiyah' | 'madaniyah';
  ayahs: number;
};

export type AyahRef = { surah: number; ayah: number };

// Baris layar baca: kepala surah (nama + basmalah) disisipkan setiap kali surah berganti.
export type ReaderItem<T extends AyahRef> =
  | { kind: 'header'; key: string; surah: number; basmalah: boolean }
  | { kind: 'ayah'; key: string; ayah: T };

export const JUZ_COUNT = 30;
// Langkah ukuran huruf (pengali dari ukuran dasar). Indeks 1 = normal.
export const FONT_STEPS = [0.85, 1, 1.15, 1.3, 1.5, 1.75] as const;
export const DEFAULT_FONT_STEP = 1;
// Kueri tanpa vokal lebih pendek dari ini terlalu banyak cocok — dilewati.
const MIN_CONSONANT_QUERY = 3;

export function isValidRef(surah: number, ayah: number): boolean {
  if (!Number.isInteger(surah) || !Number.isInteger(ayah)) return false;
  const meta = SURAHS[surah - 1];
  return meta != null && ayah >= 1 && ayah <= meta.ayahs;
}

// Basmalah ditampilkan di atas ayat pertama, kecuali Al-Fatihah (basmalah = ayat 1) dan At-Taubah.
export function showsBasmalah(surah: number): boolean {
  return surah !== 1 && surah !== 9;
}

// Juz yang dimulai di tengah surah tetap diberi kepala surah (tanpa basmalah) sebagai konteks.
export function buildReaderItems<T extends AyahRef>(ayat: readonly T[]): ReaderItem<T>[] {
  const items: ReaderItem<T>[] = [];
  let prevSurah = 0;
  for (const a of ayat) {
    if (a.surah !== prevSurah) {
      items.push({ kind: 'header', key: `h${a.surah}`, surah: a.surah, basmalah: a.ayah === 1 && showsBasmalah(a.surah) });
      prevSurah = a.surah;
    }
    items.push({ kind: 'ayah', key: `${a.surah}:${a.ayah}`, ayah: a });
  }
  return items;
}

export function juzOf(surah: number, ayah: number): number {
  let juz = 1;
  for (let i = 0; i < JUZ_STARTS.length; i++) {
    const [s, a] = JUZ_STARTS[i];
    if (surah > s || (surah === s && ayah >= a)) juz = i + 1;
    else break;
  }
  return juz;
}

export function juzStart(juz: number): AyahRef {
  const [surah, ayah] = JUZ_STARTS[Math.min(Math.max(juz, 1), JUZ_COUNT) - 1];
  return { surah, ayah };
}

// Rentang surah di dalam satu juz, mis. juz 2 → [{surah 2, from 142, to 252}].
export function juzSegments(juz: number): Array<{ surah: number; from: number; to: number }> {
  const start = juzStart(juz);
  const end: AyahRef = juz >= JUZ_COUNT
    ? { surah: 114, ayah: SURAHS[113].ayahs }
    : previousAyah(juzStart(juz + 1));
  const out: Array<{ surah: number; from: number; to: number }> = [];
  for (let s = start.surah; s <= end.surah; s++) {
    out.push({
      surah: s,
      from: s === start.surah ? start.ayah : 1,
      to: s === end.surah ? end.ayah : SURAHS[s - 1].ayahs,
    });
  }
  return out;
}

function previousAyah(ref: AyahRef): AyahRef {
  if (ref.ayah > 1) return { surah: ref.surah, ayah: ref.ayah - 1 };
  const prev = SURAHS[ref.surah - 2];
  return { surah: prev.number, ayah: prev.ayahs };
}

// "Al-Baqarah" → "albaqarah"; buang diakritik latin (ā, ḥ) dan tanda baca.
export function normalizeLatin(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Kerangka konsonan agar ejaan beda tetap cocok: "kahfi" ~ "Al-Kahf", "yasin" ~ "Ya-Sin".
function consonants(s: string): string {
  return s.replace(/[aiueoy]/g, '');
}

// Pencarian surah: nomor persis, nama latin, arti (id/en), atau nama Arab.
// Urutan: nama persis → awalan nama → bagian nama → arti/nama Arab → kerangka konsonan.
export function searchSurahs(query: string, surahs: readonly SurahMeta[] = SURAHS): SurahMeta[] {
  const raw = query.trim();
  if (!raw) return [...surahs];
  if (/^\d+$/.test(raw)) {
    const hit = surahs.find((m) => m.number === Number(raw));
    return hit ? [hit] : [];
  }
  const q = normalizeLatin(raw);
  const qCons = consonants(q);
  const scored: Array<{ meta: SurahMeta; score: number }> = [];
  for (const meta of surahs) {
    const name = normalizeLatin(meta.nameLatin);
    const bare = name.replace(/^(al|an|ar|as|at|ad|az|asy|adz|ash)/, '');
    let score = 0;
    if (q && (name === q || bare === q)) score = 5;
    else if (q && (name.startsWith(q) || bare.startsWith(q))) score = 4;
    else if (q && name.includes(q)) score = 3;
    else if (q && (normalizeLatin(meta.meaningId).includes(q) || normalizeLatin(meta.meaningEn).includes(q))) score = 2;
    else if (meta.nameAr.includes(raw)) score = 2;
    else if (qCons.length >= MIN_CONSONANT_QUERY && consonants(name).includes(qCons)) score = 1;
    if (score > 0) scored.push({ meta, score });
  }
  return scored.sort((a, b) => b.score - a.score || a.meta.number - b.meta.number).map((x) => x.meta);
}

// Penanda terakhir dibaca disimpan sebagai JSON di sync_meta; data rusak/usang → null.
export function parseBookmark(raw: string | null | undefined): AyahRef | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<AyahRef> | null;
    if (typeof v?.surah !== 'number' || typeof v?.ayah !== 'number') return null;
    return isValidRef(v.surah, v.ayah) ? { surah: v.surah, ayah: v.ayah } : null;
  } catch {
    return null;
  }
}

export function parseFontStep(raw: string | null | undefined): number {
  if (raw == null || raw === '') return DEFAULT_FONT_STEP;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 && n < FONT_STEPS.length ? n : DEFAULT_FONT_STEP;
}

// Angka Arab-Indik untuk penanda nomor ayat (١٢٣).
export function toArabicDigits(n: number): string {
  return String(n).replace(/\d/g, (d) => String.fromCharCode(0x0660 + Number(d)));
}
