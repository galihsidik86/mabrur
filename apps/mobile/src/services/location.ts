import * as Location from 'expo-location';

export function haversine(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
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

export function formatDistance(meters: number): string {
  if (meters >= 1000) {
    return (meters / 1000).toFixed(1).replace('.', ',') + ' km';
  }
  return Math.round(meters / 10) * 10 + ' m';
}

export interface MiqatZone {
  id: string;
  name: string;
  zone_type: string;
  center_lat: number;
  center_lng: number;
  radius_meters: number;
  warning_radius: number;
}

export interface NearestResult {
  zone: MiqatZone;
  distance: number;
  withinWarning: boolean;
}

export function findNearest(
  lat: number,
  lng: number,
  zones: MiqatZone[],
): NearestResult | null {
  const miqats = zones.filter((z) => z.zone_type === 'miqat');
  if (miqats.length === 0) return null;

  let nearest = miqats[0];
  let minDist = Infinity;

  for (const z of miqats) {
    const d = haversine(lat, lng, z.center_lat, z.center_lng);
    if (d < minDist) {
      minDist = d;
      nearest = z;
    }
  }

  return {
    zone: nearest,
    distance: minDist,
    withinWarning: minDist <= nearest.warning_radius,
  };
}

export async function requestPermission(): Promise<boolean> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === 'granted';
}

export async function getPosition(): Promise<{
  lat: number;
  lng: number;
  accuracy: number | null;
} | null> {
  try {
    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
    return {
      lat: loc.coords.latitude,
      lng: loc.coords.longitude,
      accuracy: loc.coords.accuracy,
    };
  } catch {
    return null;
  }
}

export function watchPosition(
  callback: (lat: number, lng: number, accuracy: number | null) => void,
): { remove: () => void } {
  let sub: Location.LocationSubscription | null = null;

  Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.High,
      distanceInterval: 50,
      timeInterval: 10000,
    },
    (loc) => {
      callback(loc.coords.latitude, loc.coords.longitude, loc.coords.accuracy);
    },
  ).then((s) => {
    sub = s;
  });

  return {
    remove: () => {
      sub?.remove();
    },
  };
}
