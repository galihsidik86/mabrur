import { db } from '../db';
import { AppError } from '../middleware/error-handler';
import { audit } from './audit.service';

// ==================== Miqat Zones ====================

export async function listZones() {
  return db('miqat_zones').select(
    'id', 'name', 'zone_type', 'center_lat', 'center_lng',
    'radius_meters', 'warning_radius',
  );
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function nearestMiqat(lat: number, lng: number) {
  const zones = await db('miqat_zones').where('zone_type', 'miqat');
  if (zones.length === 0) throw new AppError(404, 'Zona miqat belum dikonfigurasi', 'NOT_FOUND');

  let nearest = zones[0];
  let minDist = Infinity;

  for (const z of zones) {
    const dist = haversine(lat, lng, z.center_lat, z.center_lng);
    if (dist < minDist) {
      minDist = dist;
      nearest = z;
    }
  }

  return {
    zone: {
      id: nearest.id,
      name: nearest.name,
      center_lat: nearest.center_lat,
      center_lng: nearest.center_lng,
    },
    distance_meters: Math.round(minDist),
    within_warning: minDist <= nearest.warning_radius,
    within_boundary: minDist <= nearest.radius_meters,
  };
}

// ==================== Ihram Status ====================

export async function getIhram(userId: string) {
  const status = await db('ihram_status').where('user_id', userId).first();
  return status || { user_id: userId, is_ihram: false, niat_type: null, changed_at: null };
}

export async function toggleIhram(userId: string, isIhram: boolean, niatType?: string) {
  const exists = await db('ihram_status').where('user_id', userId).first();
  const data = {
    is_ihram: isIhram,
    niat_type: isIhram ? (niatType || 'umrah') : null,
    changed_at: new Date(),
  };

  if (exists) {
    await db('ihram_status').where('user_id', userId).update(data);
  } else {
    await db('ihram_status').insert({ user_id: userId, ...data });
  }

  await audit(userId, 'ihram.toggle', 'ihram_status', userId, { is_ihram: isIhram });
  return { user_id: userId, ...data };
}

// ==================== User Location ====================

export async function updateLocation(userId: string, lat: number, lng: number, accuracy?: number) {
  const exists = await db('user_locations').where('user_id', userId).first();
  const data = { lat, lng, accuracy: accuracy ?? null, updated_at: new Date() };

  if (exists) {
    await db('user_locations').where('user_id', userId).update(data);
  } else {
    await db('user_locations').insert({ user_id: userId, ...data });
  }

  return data;
}
