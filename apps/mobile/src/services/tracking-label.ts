// Label status lokasi jamaah untuk aplikasi muthawwif (murni — bisa dites dari vitest).

export type TrackingStatus = 'tracked' | 'stale' | 'none';

const pad = (n: number) => String(n).padStart(2, '0');
const hhmm = (d: Date) => `${pad(d.getHours())}.${pad(d.getMinutes())}`;

/** "baru saja" / "7 mnt lalu" / "pukul 09.05" (hari ini) / "22/10 21.30" (hari lain). */
export function lastSeenLabel(updatedAt: string, now: number): string {
  const d = new Date(updatedAt);
  const ageMin = Math.floor((now - d.getTime()) / 60000);
  if (ageMin < 1) return 'baru saja';
  if (ageMin < 60) return `${ageMin} mnt lalu`;
  if (d.toDateString() === new Date(now).toDateString()) return `pukul ${hhmm(d)}`;
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${hhmm(d)}`;
}

export function trackingLabel(tracking: TrackingStatus, updatedAt: string | null, now: number): string {
  if (tracking === 'none' || !updatedAt) return 'Belum ada lokasi';
  const seen = lastSeenLabel(updatedAt, now);
  return tracking === 'tracked' ? `Terpantau · ${seen}` : `Terakhir terlihat ${seen}`;
}
