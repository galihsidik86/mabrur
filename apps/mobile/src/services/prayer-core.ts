// Logika murni layar Waktu Salat & Kiblat (tanpa impor Expo → dites dari server/tests/prayer-core.test.ts).
// Bukan bagian dari algoritma naskah jurnal; KAABAH hanya dibaca dari sacred-zones-core.
import { KAABAH } from './sacred-zones-core';

export type PrayerKey = 'fajr' | 'sunrise' | 'dhuha' | 'dhuhr' | 'asr' | 'maghrib' | 'isha';

// Kunci yang dikirim server (/prayer-times). Dhuha dihitung di sini.
const SERVER_KEYS = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'] as const;
const OBLIGATORY: readonly PrayerKey[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
const MINUTES_PER_DAY = 24 * 60;

// Awal Dhuha ≈ matahari setinggi tombak (~4,5°), lazim didekati terbit + 20 menit.
export const DHUHA_OFFSET_MIN = 20;

export interface PrayerSlot {
  key: PrayerKey;
  time: string;     // HH:MM
  minutes: number;  // menit sejak tengah malam (waktu lokal)
}

export interface NextPrayer {
  key: PrayerKey;
  time: string;
  minutesUntil: number;
}

export function parseHHMM(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const m = /^(\d{2}):(\d{2})$/.exec(value);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

function formatHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// Tujuh waktu berurutan, atau null bila data server rusak/tidak lengkap.
export function buildSchedule(times: Record<string, unknown> | null | undefined): PrayerSlot[] | null {
  if (!times) return null;
  const base: PrayerSlot[] = [];
  for (const key of SERVER_KEYS) {
    const minutes = parseHHMM(times[key]);
    if (minutes == null) return null;
    base.push({ key, time: times[key] as string, minutes });
  }
  const sunrise = base[1].minutes;
  const dhuha = sunrise + DHUHA_OFFSET_MIN;
  const slots = [
    ...base.slice(0, 2),
    { key: 'dhuha' as const, time: formatHHMM(dhuha), minutes: dhuha },
    ...base.slice(2),
  ];
  const ordered = slots.every((s, i) => i === 0 || s.minutes > slots[i - 1].minutes);
  return ordered ? slots : null;
}

// Waktu yang sedang berlaku = waktu terakhir yang sudah masuk; sebelum Subuh masih Isya.
export function currentSlot(schedule: readonly PrayerSlot[], nowMinutes: number): PrayerKey {
  let current: PrayerKey = 'isha';
  for (const slot of schedule) {
    if (slot.minutes <= nowMinutes) current = slot.key;
  }
  return current;
}

// Salat wajib berikutnya (Terbit & Dhuha dilewati); setelah Isya → Subuh esok hari.
export function nextPrayer(schedule: readonly PrayerSlot[], nowMinutes: number): NextPrayer | null {
  const wajib = schedule.filter((s) => OBLIGATORY.includes(s.key));
  if (wajib.length === 0) return null;
  const upcoming = wajib.find((s) => s.minutes > nowMinutes);
  const target = upcoming ?? wajib[0];
  const targetMinutes = upcoming ? target.minutes : target.minutes + MINUTES_PER_DAY;
  return { key: target.key, time: target.time, minutesUntil: Math.ceil(targetMinutes - nowMinutes) };
}

// ==================== KIBLAT ====================

const toRad = (d: number) => (d * Math.PI) / 180;

// Azimuth awal great-circle ke Ka'bah, relatif utara sejati, rentang [0, 360).
export function qiblaBearing(lat: number, lng: number): number {
  const kLat = toRad(KAABAH.lat);
  const pLat = toRad(lat);
  const dLng = toRad(KAABAH.lng - lng);
  const y = Math.sin(dLng) * Math.cos(kLat);
  const x = Math.cos(pLat) * Math.sin(kLat) - Math.sin(pLat) * Math.cos(kLat) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

// Selisih bertanda (-180, 180]: positif = HP perlu diputar ke kanan.
export function headingDelta(bearing: number, heading: number): number {
  const d = (((bearing - heading) % 360) + 540) % 360 - 180;
  return d === -180 ? 180 : d;
}

// Low-pass melingkar untuk heading kompas (aman melintasi 0°/360°); prev null = sampel pertama.
export const HEADING_SMOOTHING = 0.25;

export function smoothHeading(prev: number | null, raw: number, alpha = HEADING_SMOOTHING): number {
  if (prev == null) return ((raw % 360) + 360) % 360;
  const next = prev + alpha * headingDelta(raw, prev);
  return ((next % 360) + 360) % 360;
}

// Histeresis supaya penanda "Tepat" tidak berkedip akibat derau kompas.
export const QIBLA_ENTER_DEG = 5;
export const QIBLA_EXIT_DEG = 8;

export function nextAligned(wasAligned: boolean, delta: number): boolean {
  const off = Math.abs(delta);
  return wasAligned ? off <= QIBLA_EXIT_DEG : off <= QIBLA_ENTER_DEG;
}

// ==================== HIJRIAH ====================

export interface HijriDate { day: number; month: number; year: number }

function isPlausibleHijri(h: HijriDate): boolean {
  return h.day >= 1 && h.day <= 30 && h.month >= 1 && h.month <= 12 && h.year > 1300 && h.year < 1700;
}

// Kalender Umm al-Qura bawaan ICU; null bila perangkat tidak mendukung kalender ini.
function hijriFromIntl(date: Date): HijriDate | null {
  try {
    const fmt = new Intl.DateTimeFormat('en-US-u-ca-islamic-umalqura', { day: 'numeric', month: 'numeric', year: 'numeric' });
    if (fmt.resolvedOptions().calendar !== 'islamic-umalqura') return null;
    const parts = fmt.formatToParts(date);
    const num = (type: string) => Number.parseInt(parts.find((p) => p.type === type)?.value ?? '', 10);
    const h = { day: num('day'), month: num('month'), year: num('year') };
    return isPlausibleHijri(h) ? h : null;
  } catch {
    return null;
  }
}

// Kalender Hijriah tabular (aritmetika, epoch sipil) — cadangan bila Intl tidak tersedia; bisa meleset ±1 hari.
export function hijriTabular(date: Date): HijriDate {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const a = Math.floor((14 - m) / 12);
  const yy = y + 4800 - a;
  const mm = m + 12 * a - 3;
  const jdn = d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;

  let l = jdn - 1948440 + 10632;
  const n = Math.floor((l - 1) / 10631);
  l = l - 10631 * n + 354;
  const j = Math.floor((10985 - l) / 5316) * Math.floor((50 * l) / 17719) + Math.floor(l / 5670) * Math.floor((43 * l) / 15238);
  l = l - Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50) - Math.floor(j / 16) * Math.floor((15238 * j) / 43) + 29;
  const month = Math.floor((24 * l) / 709);
  const day = l - Math.floor((709 * month) / 24);
  const year = 30 * n + j - 30;
  return { day, month, year };
}

// Tabel Umm al-Qura 1445–1460 H (dibangkitkan dari kalender ICU): 1 Muharram 1445 = 19 Juli 2023,
// lalu panjang tiap bulan berurutan ('1' = 30 hari, '0' = 29 hari). Dipakai bila Intl tak mendukung kalender ini.
const UMQ_START_UTC = Date.UTC(2023, 6, 19);
const UMQ_START_YEAR = 1445;
const UMQ_MONTH_LENGTHS =
  '011101001001011101100100101110101010010110110101001010110110101001010110111001001101101100100101'
  + '101101010010101101101010010110101101001010101110100100101111010010010111011001001011011010100101';

export function hijriFromTable(date: Date): HijriDate | null {
  let days = Math.round((Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - UMQ_START_UTC) / 86400000);
  if (days < 0) return null;
  for (let i = 0; i < UMQ_MONTH_LENGTHS.length; i++) {
    const len = UMQ_MONTH_LENGTHS[i] === '1' ? 30 : 29;
    if (days < len) return { day: days + 1, month: (i % 12) + 1, year: UMQ_START_YEAR + Math.floor(i / 12) };
    days -= len;
  }
  return null;
}

export function toHijri(date: Date): HijriDate {
  return hijriFromIntl(date) ?? hijriFromTable(date) ?? hijriTabular(date);
}

// ==================== LAIN-LAIN ====================

export interface AddressLike {
  city?: string | null;
  subregion?: string | null;
  region?: string | null;
  country?: string | null;
}

// "Kota, Negara" dari hasil reverse-geocode; null bila kosong.
export function placeLabel(addr: AddressLike | null | undefined): string | null {
  if (!addr) return null;
  const place = addr.city || addr.subregion || addr.region || null;
  const parts = [place, addr.country].filter((p): p is string => !!p && p.trim().length > 0);
  const unique = parts.filter((p, i) => parts.indexOf(p) === i);
  return unique.length > 0 ? unique.join(', ') : null;
}

export function localDateKey(date: Date): string {
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${mm}-${dd}`;
}
