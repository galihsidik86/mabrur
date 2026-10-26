// Logika murni pemantauan rombongan (tanpa impor db/config — bisa dites langsung).

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Lokasi lebih tua dari ini dianggap tidak terpantau ("terakhir terlihat"). */
export const TRACKED_MAX_MINUTES = 30;
/** Jamaah lebih jauh dari ini ke muthawwif terdekat ditandai "jauh dari rombongan". */
export const FAR_FROM_GROUP_M = 1000;
/** Jeda minimum antar-pengingat "aktifkan lokasi" ke jamaah yang sama. */
export const REMINDER_COOLDOWN_MS = 5 * 60 * 1000;
/**
 * Koordinat lebih tua dari ini tidak lagi dikirim ke muthawwif (hanya waktu terakhir terlihat).
 * Cukup untuk "tampilkan lokasi terakhir saat jamaah offline", tapi lokasi tidak bisa dibaca
 * tanpa batas waktu setelah jamaah berhenti berbagi (logout / cabut izin / pulang).
 */
export const LOCATION_RETENTION_HOURS = 12;
const MIQAT_WARNING_M = 3000;

export type TrackingStatus = 'tracked' | 'stale' | 'none';

export interface MemberRow {
  id: string;
  name: string;
  phone: string;
  role_in_group: 'jamaah' | 'muthawwif';
  lat: number | null;
  lng: number | null;
  loc_updated: string | Date | null;
  is_ihram: boolean | null;
  niat_type: string | null;
}

export interface MiqatZoneRow {
  name: string;
  center_lat: number;
  center_lng: number;
}

export interface MemberStatus {
  id: string;
  name: string;
  phone: string;
  role_in_group: 'jamaah' | 'muthawwif';
  location: { lat: number; lng: number; updated_at: string | Date } | null;
  last_seen_at: string | Date | null;
  tracking: TrackingStatus;
  ihram: { is_ihram: boolean; niat_type: string | null };
  nearest_miqat: { name: string; distance: number } | null;
  distance_to_leader: number | null;
  far_from_group: boolean;
  status: 'safe' | 'attention';
}

export function trackingStatus(locUpdated: string | Date | null, now: number): TrackingStatus {
  if (!locUpdated) return 'none';
  const ageMin = (now - new Date(locUpdated).getTime()) / 60000;
  return ageMin <= TRACKED_MAX_MINUTES ? 'tracked' : 'stale';
}

function nearestMiqat(lat: number, lng: number, zones: MiqatZoneRow[]): MemberStatus['nearest_miqat'] {
  let best: MemberStatus['nearest_miqat'] = null;
  for (const z of zones) {
    const d = haversine(lat, lng, z.center_lat, z.center_lng);
    if (!best || d < best.distance) best = { name: z.name, distance: Math.round(d) };
  }
  return best;
}

export function buildMemberStatuses(rows: MemberRow[], zones: MiqatZoneRow[], now: number) {
  const hasLoc = (r: MemberRow) => r.lat != null && r.lng != null;
  const isFresh = (r: MemberRow) => hasLoc(r) && trackingStatus(r.loc_updated, now) === 'tracked';
  // Jarak ke rombongan diukur ke muthawwif terdekat yang lokasinya masih segar.
  const leaders = rows.filter((r) => r.role_in_group === 'muthawwif' && isFresh(r));

  const withinRetention = (r: MemberRow) =>
    hasLoc(r) && !!r.loc_updated && now - new Date(r.loc_updated).getTime() <= LOCATION_RETENTION_HOURS * 3600000;

  const members: MemberStatus[] = rows.map((r) => {
    const tracking = hasLoc(r) ? trackingStatus(r.loc_updated, now) : 'none';
    const showLoc = withinRetention(r);
    const miqat = showLoc ? nearestMiqat(r.lat!, r.lng!, zones) : null;

    let distanceToLeader: number | null = null;
    if (r.role_in_group === 'jamaah' && isFresh(r) && leaders.length > 0) {
      distanceToLeader = Math.round(Math.min(...leaders.map((l) => haversine(r.lat!, r.lng!, l.lat!, l.lng!))));
    }
    const farFromGroup = distanceToLeader != null && distanceToLeader > FAR_FROM_GROUP_M;

    const needsIhram = !!miqat && miqat.distance <= MIQAT_WARNING_M && !r.is_ihram;
    const status = tracking !== 'tracked' || needsIhram || farFromGroup ? 'attention' : 'safe';

    return {
      id: r.id,
      name: r.name,
      phone: r.phone,
      role_in_group: r.role_in_group,
      location: showLoc ? { lat: r.lat!, lng: r.lng!, updated_at: r.loc_updated! } : null,
      last_seen_at: hasLoc(r) ? r.loc_updated : null,
      tracking,
      ihram: { is_ihram: !!r.is_ihram, niat_type: r.niat_type },
      nearest_miqat: miqat,
      distance_to_leader: distanceToLeader,
      far_from_group: farFromGroup,
      status,
    };
  });

  const jamaah = members.filter((m) => m.role_in_group === 'jamaah');
  return {
    stats: {
      total: members.length,
      safe: members.filter((m) => m.status === 'safe').length,
      attention: members.filter((m) => m.status === 'attention').length,
      jamaah_total: jamaah.length,
      tracked: jamaah.filter((m) => m.tracking === 'tracked').length,
      stale: jamaah.filter((m) => m.tracking === 'stale').length,
      no_location: jamaah.filter((m) => m.tracking === 'none').length,
      far_from_group: jamaah.filter((m) => m.far_from_group).length,
    },
    members,
  };
}

/**
 * Pilih jamaah yang akan dikirimi pengingat "aktifkan lokasi".
 * Tanpa userIds: semua jamaah yang tidak terpantau. Dengan userIds: hanya jamaah
 * rombongan ini yang diminta (id di luar rombongan diabaikan). Jeda anti-spam per jamaah.
 */
export function pickReminderTargets(
  members: MemberStatus[],
  userIds: string[] | undefined,
  lastSent: ReadonlyMap<string, number>,
  now: number,
): { targets: string[]; skipped_cooldown: number } {
  const wanted = userIds ? new Set(userIds) : null;
  const candidates = members.filter((m) =>
    m.role_in_group === 'jamaah' && (wanted ? wanted.has(m.id) : m.tracking !== 'tracked'));
  const targets = candidates
    .filter((m) => now - (lastSent.get(m.id) ?? -Infinity) > REMINDER_COOLDOWN_MS)
    .map((m) => m.id);
  return { targets, skipped_cooldown: candidates.length - targets.length };
}

/**
 * Catat target ke log jeda SEBELUM ada await apa pun, agar permintaan paralel berikutnya
 * langsung melihatnya (anti-spam tak bisa dibobol dengan request bersamaan). Sekaligus
 * membuang entri yang jedanya sudah lewat agar log tidak tumbuh tanpa batas.
 * Sengaja memutasi `log`: ini cache proses bersama, bukan data domain.
 */
export function reserveReminders(log: Map<string, number>, targets: string[], now: number): void {
  for (const [id, at] of log) if (now - at > REMINDER_COOLDOWN_MS) log.delete(id);
  for (const id of targets) log.set(id, now);
}
