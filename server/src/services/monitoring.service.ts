import { db } from '../db';
import { AppError } from '../middleware/error-handler';

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

const STALE_MINUTES = 30;

export async function getMemberStatuses(groupId: string) {
  const group = await db('groups').where('id', groupId).first();
  if (!group) throw new AppError(404, 'Rombongan tidak ditemukan', 'NOT_FOUND');

  const members = await db('group_members')
    .join('users', 'users.id', 'group_members.user_id')
    .leftJoin('user_locations', 'user_locations.user_id', 'users.id')
    .leftJoin('ihram_status', 'ihram_status.user_id', 'users.id')
    .where({
      'group_members.group_id': groupId,
      'group_members.is_active': true,
    })
    .select(
      'users.id',
      'users.name',
      'users.phone',
      'group_members.role_in_group',
      'user_locations.lat',
      'user_locations.lng',
      'user_locations.updated_at as loc_updated',
      'ihram_status.is_ihram',
      'ihram_status.niat_type',
    );

  const zones = await db('miqat_zones').where('zone_type', 'miqat');
  const now = Date.now();

  const result = members.map((m: any) => {
    const hasLoc = m.lat != null && m.lng != null;
    const locAge = hasLoc && m.loc_updated
      ? (now - new Date(m.loc_updated).getTime()) / 60000
      : Infinity;

    let nearestMiqat = null;
    if (hasLoc) {
      let minDist = Infinity;
      let nearestZone: any = null;
      for (const z of zones) {
        const d = haversine(m.lat, m.lng, z.center_lat, z.center_lng);
        if (d < minDist) {
          minDist = d;
          nearestZone = z;
        }
      }
      if (nearestZone) {
        nearestMiqat = { name: nearestZone.name, distance: Math.round(minDist) };
      }
    }

    let status: 'safe' | 'attention' = 'safe';
    if (!hasLoc || locAge > STALE_MINUTES) {
      status = 'attention';
    } else if (nearestMiqat && nearestMiqat.distance <= 3000 && !m.is_ihram) {
      status = 'attention';
    }

    return {
      id: m.id,
      name: m.name,
      phone: m.phone,
      role_in_group: m.role_in_group,
      location: hasLoc
        ? { lat: m.lat, lng: m.lng, updated_at: m.loc_updated }
        : null,
      ihram: { is_ihram: !!m.is_ihram, niat_type: m.niat_type },
      nearest_miqat: nearestMiqat,
      status,
    };
  });

  return {
    stats: {
      total: result.length,
      safe: result.filter((m: any) => m.status === 'safe').length,
      attention: result.filter((m: any) => m.status === 'attention').length,
    },
    members: result,
  };
}
