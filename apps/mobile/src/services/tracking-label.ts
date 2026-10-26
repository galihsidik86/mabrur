// Label status lokasi jamaah untuk aplikasi muthawwif (murni — bisa dites dari vitest).
// Teks bahasa datang dari parameter `t` (fungsi terjemahan dari useI18n) agar modul ini
// tidak mengimpor services/i18n.ts (yang memakai expo-secure-store).

export type TrackingStatus = 'tracked' | 'stale' | 'none';

export type TrackingLabelKey =
  | 'monitor.seen_just_now'
  | 'monitor.seen_minutes_ago'
  | 'monitor.seen_at_time'
  | 'monitor.seen_at_date'
  | 'monitor.status_tracked'
  | 'monitor.status_stale'
  | 'monitor.status_none';

/** Kompatibel dengan TFunction dari useI18n (yang menerima semua TranslationKey). */
export type TrackingLabelT = (key: TrackingLabelKey, params?: Record<string, string | number>) => string;

const pad = (n: number) => String(n).padStart(2, '0');

/** id: "baru saja" / "7 mnt lalu" / "pukul 09.05" (hari ini) / "22/10 21.30" (hari lain). */
export function lastSeenLabel(updatedAt: string, now: number, t: TrackingLabelT): string {
  const d = new Date(updatedAt);
  const ageMin = Math.floor((now - d.getTime()) / 60000);
  if (ageMin < 1) return t('monitor.seen_just_now');
  if (ageMin < 60) return t('monitor.seen_minutes_ago', { minutes: ageMin });
  const time = { hh: pad(d.getHours()), mm: pad(d.getMinutes()) };
  if (d.toDateString() === new Date(now).toDateString()) return t('monitor.seen_at_time', time);
  return t('monitor.seen_at_date', { ...time, dd: pad(d.getDate()), mo: pad(d.getMonth() + 1) });
}

export function trackingLabel(
  tracking: TrackingStatus,
  updatedAt: string | null,
  now: number,
  t: TrackingLabelT,
): string {
  if (tracking === 'none' || !updatedAt) return t('monitor.status_none');
  const seen = lastSeenLabel(updatedAt, now, t);
  return t(tracking === 'tracked' ? 'monitor.status_tracked' : 'monitor.status_stale', { seen });
}
