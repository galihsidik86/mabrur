import * as Location from 'expo-location';

// ==================== SACRED COORDINATES ====================

export const KAABAH = { lat: 21.42251, lng: 39.82620 };
export const HAJAR_ASWAD = { lat: 21.42244, lng: 39.82631 }; // SE corner

export const SAFA = { lat: 21.42266, lng: 39.82649 };
export const MARWAH = { lat: 21.42640, lng: 39.82698 };

// ==================== ARAFAH BOUNDARY ====================
// Padang Arafah: area wukuf yang sah
// Batas utama menggunakan polygon sederhana (5 titik)
// Sumber: peta resmi Kementerian Haji Saudi Arabia

export const ARAFAH_CENTER = { lat: 21.3549, lng: 39.9842 }; // Jabal Rahmah
export const ARAFAH_BOUNDARY: Array<{ lat: number; lng: number }> = [
  { lat: 21.3750, lng: 39.9600 },  // barat laut
  { lat: 21.3780, lng: 40.0100 },  // timur laut
  { lat: 21.3400, lng: 40.0200 },  // timur tenggara
  { lat: 21.3250, lng: 39.9900 },  // selatan
  { lat: 21.3350, lng: 39.9550 },  // barat daya
];

// Masjid Namirah: sebagian di dalam Arafah, sebagian di luar
// Wukuf di bagian masjid yang di luar Arafah TIDAK SAH
export const NAMIRAH_BOUNDARY = { lat: 21.3630, lng: 39.9760 };
export const NAMIRAH_WARNING_RADIUS = 200; // meter — area peringatan

// ==================== ARAFAH ZONE DETECTION ====================

function isPointInPolygon(
  lat: number, lng: number,
  polygon: Array<{ lat: number; lng: number }>,
): boolean {
  let inside = false;
  const n = polygon.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const yi = polygon[i].lat, xi = polygon[i].lng;
    const yj = polygon[j].lat, xj = polygon[j].lng;
    if (
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi
    ) {
      inside = !inside;
    }
  }
  return inside;
}

export type ArafahStatus =
  | 'inside'         // di dalam Arafah — wukuf sah
  | 'outside'        // di luar Arafah — wukuf TIDAK sah
  | 'namirah_danger' // dekat Masjid Namirah (batas rawan)
  | 'unknown';       // belum ada GPS

export interface ArafahResult {
  status: ArafahStatus;
  distToCenter: number;       // meter ke Jabal Rahmah
  distToNamirah: number;      // meter ke batas Namirah
  message: string;
}

export function checkArafahPosition(lat: number, lng: number): ArafahResult {
  const distToCenter = distanceMetersExport(lat, lng, ARAFAH_CENTER.lat, ARAFAH_CENTER.lng);
  const distToNamirah = distanceMetersExport(lat, lng, NAMIRAH_BOUNDARY.lat, NAMIRAH_BOUNDARY.lng);
  const inArafah = isPointInPolygon(lat, lng, ARAFAH_BOUNDARY);

  if (!inArafah) {
    return {
      status: 'outside',
      distToCenter,
      distToNamirah,
      message: 'PERINGATAN: Kamu di LUAR area Arafah! Wukuf di luar Arafah tidak sah. Segera masuk ke area Arafah.',
    };
  }

  if (distToNamirah <= NAMIRAH_WARNING_RADIUS) {
    return {
      status: 'namirah_danger',
      distToCenter,
      distToNamirah,
      message: 'HATI-HATI: Kamu dekat batas Masjid Namirah. Sebagian masjid ini di LUAR Arafah. Pastikan posisimu di sisi timur masjid.',
    };
  }

  return {
    status: 'inside',
    distToCenter,
    distToNamirah,
    message: 'Kamu di DALAM area Arafah. Wukuf sah. Perbanyak doa dan dzikir.',
  };
}

// Export distance function for Arafah
export function distanceMetersExport(lat1: number, lng1: number, lat2: number, lng2: number): number {
  return distanceMeters(lat1, lng1, lat2, lng2);
}

export const JAMARAT = {
  ula: { lat: 21.4212, lng: 39.8717, name: 'Jamarat Ula (Kecil)' },
  wustha: { lat: 21.4207, lng: 39.8722, name: 'Jamarat Wustha (Tengah)' },
  aqabah: { lat: 21.4203, lng: 39.8727, name: 'Jamarat Aqabah (Besar)' },
};

// ==================== DISTANCE HELPER ====================

function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ==================== TAWAF AUTO COUNTER ====================
// Detect when user crosses the Hajar Aswad line (counterclockwise)
// by tracking angular position relative to Ka'bah center.

export class TawafTracker {
  private prevAngle: number | null = null;
  private rounds = 0;
  private lastCrossTime = 0;
  private readonly MIN_INTERVAL = 120_000; // minimum 2 min between rounds (prevent double count)
  onChange: ((rounds: number) => void) | null = null;

  private getAngle(lat: number, lng: number): number {
    // Angle from Ka'bah center, 0° = east (Hajar Aswad direction)
    const dLat = lat - KAABAH.lat;
    const dLng = lng - KAABAH.lng;
    return Math.atan2(dLat, dLng) * (180 / Math.PI); // -180 to 180
  }

  update(lat: number, lng: number): void {
    const dist = distanceMeters(lat, lng, KAABAH.lat, KAABAH.lng);
    // Only track if within tawaf area (10-80m from Ka'bah)
    if (dist < 10 || dist > 80) return;

    const angle = this.getAngle(lat, lng);

    if (this.prevAngle !== null) {
      // Detect crossing 0° going counterclockwise (angle goes positive → negative)
      // Counterclockwise around Ka'bah: angle decreases
      const crossed = this.prevAngle > 0 && this.prevAngle < 90 &&
                      angle < 0 && angle > -90;

      if (crossed) {
        const now = Date.now();
        if (now - this.lastCrossTime > this.MIN_INTERVAL) {
          this.rounds++;
          this.lastCrossTime = now;
          this.onChange?.(this.rounds);
        }
      }
    }

    this.prevAngle = angle;
  }

  getRounds(): number { return this.rounds; }
  reset(): void { this.rounds = 0; this.prevAngle = null; this.lastCrossTime = 0; }
}

// ==================== SAI AUTO COUNTER ====================
// Track alternation between Safa and Marwah zones.

export type SaiZone = 'safa' | 'marwah' | 'between';

export class SaiTracker {
  private lastZone: SaiZone = 'between';
  private legs = 0;
  private started = false;
  private readonly ZONE_RADIUS = 25; // meters
  onChange: ((legs: number, zone: SaiZone) => void) | null = null;

  private detectZone(lat: number, lng: number): SaiZone {
    const dSafa = distanceMeters(lat, lng, SAFA.lat, SAFA.lng);
    const dMarwah = distanceMeters(lat, lng, MARWAH.lat, MARWAH.lng);

    if (dSafa <= this.ZONE_RADIUS) return 'safa';
    if (dMarwah <= this.ZONE_RADIUS) return 'marwah';
    return 'between';
  }

  update(lat: number, lng: number): void {
    const zone = this.detectZone(lat, lng);

    if (zone === 'between') return;
    if (zone === this.lastZone) return;

    // First zone must be Safa (Sa'i starts from Safa)
    if (!this.started) {
      if (zone === 'safa') {
        this.started = true;
        this.lastZone = 'safa';
        this.onChange?.(this.legs, zone);
      }
      return;
    }

    // Alternation detected
    if ((this.lastZone === 'safa' && zone === 'marwah') ||
        (this.lastZone === 'marwah' && zone === 'safa')) {
      this.legs++;
      this.lastZone = zone;
      this.onChange?.(this.legs, zone);
    }
  }

  getLegs(): number { return this.legs; }
  getZone(): SaiZone { return this.lastZone; }
  reset(): void { this.legs = 0; this.lastZone = 'between'; this.started = false; }
}

// ==================== JUMRAH PROXIMITY ====================

export function detectNearestJamarat(lat: number, lng: number): {
  name: string; key: 'ula' | 'wustha' | 'aqabah'; distance: number;
} | null {
  const entries = Object.entries(JAMARAT) as Array<['ula' | 'wustha' | 'aqabah', typeof JAMARAT.ula]>;
  let nearest: { name: string; key: 'ula' | 'wustha' | 'aqabah'; distance: number } | null = null;

  for (const [key, j] of entries) {
    const d = distanceMeters(lat, lng, j.lat, j.lng);
    if (d <= 30 && (!nearest || d < nearest.distance)) {
      nearest = { name: j.name, key, distance: d };
    }
  }

  return nearest;
}

// ==================== GPS WATCHER ====================

export function watchSacredLocation(
  callback: (lat: number, lng: number) => void,
): { remove: () => void } {
  let sub: Location.LocationSubscription | null = null;

  Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.BestForNavigation,
      distanceInterval: 2, // every 2 meters
      timeInterval: 3000,  // every 3 seconds
    },
    (loc) => {
      callback(loc.coords.latitude, loc.coords.longitude);
    },
  ).then((s) => { sub = s; });

  return { remove: () => { sub?.remove(); } };
}
