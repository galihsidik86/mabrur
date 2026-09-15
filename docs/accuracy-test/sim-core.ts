/*
 * Primitif bersama harness Monte Carlo (docs/accuracy-test/run.ts + modul
 * eksperimen di docs/accuracy-test/experiments/): RNG ber-seed, injeksi noise
 * GPS, haversine, Vincenty (referensi), metrik confusion matrix, dan re-ekspor
 * koordinat/algoritma PRODUKSI.
 *
 * R10 (impor produksi): koordinat sakral & 4 dari 6 algoritma inti (Miqat*
 * tidak termasuk, lihat di bawah) diimpor LANGSUNG dari
 * apps/mobile/src/services/sacred-zones-core.ts (modul murni, tanpa Expo —
 * sudah dipakai docs/accuracy-test/gps-replay/*, pola impor yang sama dipakai
 * di sini). Ini menggantikan salinan verbatim yang dipakai run.ts sebelum
 * revisi 2026-09-14.
 *
 * TIDAK diimpor (dengan alasan eksplisit):
 * - `haversine` (di bawah): berasal dari apps/mobile/src/services/location.ts,
 *   yang mengimpor `expo-location` (gagal di runtime Node/tsx harness). Formula
 *   di sini IDENTIK verbatim (dibandingkan baris-demi-baris) dengan
 *   location.ts:3-16 DAN dengan fungsi privat `distanceMeters` di
 *   sacred-zones-core.ts (tidak diekspor, jadi tidak bisa diimpor meski mau) —
 *   perubahan pada salah satu WAJIB disinkronkan manual ke sini.
 * - `MIQAT`: bukan bagian sacred-zones-core.ts — ini cerminan data seed server
 *   (server/src/db/seeds/004_miqat_zones.ts), dipertahankan sesuai instruksi.
 */

export {
  KAABAH, SAFA, MARWAH, ARAFAH_BOUNDARY, JAMARAT,
  isPointInPolygon, TawafTracker, SaiTracker, detectNearestJamarat,
  type TawafConfig,
} from '../../apps/mobile/src/services/sacred-zones-core';

// ==================== RNG mulberry32 ber-seed + Box-Muller ==================

function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Rng {
  reset(offset?: number): void;
  next(): number;
  gauss(): number;
}

/** RNG mutable ber-seed; reset(offset) mengganti stream ke mulberry32(seed+offset). */
export function createRng(seed: number): Rng {
  let current = mulberry32(seed);
  return {
    reset(offset = 0) { current = mulberry32(seed + offset); },
    next() { return current(); },
    gauss() {
      let u = 0, v = 0;
      while (u === 0) u = current();
      while (v === 0) v = current();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    },
  };
}

// ==================== KONVERSI METER<->DERAJAT ===============================

export const M_PER_DEG_LAT = 111320;
export function mPerDegLng(lat: number): number { return 111320 * Math.cos((lat * Math.PI) / 180); }

/** Injeksi noise GPS: offset Gaussian isotropik (sigma m per sumbu East & North), iid. */
export function addNoiseIid(lat: number, lng: number, sigma: number, gauss: () => number) {
  if (sigma === 0) return { lat, lng };
  const dEast = gauss() * sigma;
  const dNorth = gauss() * sigma;
  return {
    lat: lat + dNorth / M_PER_DEG_LAT,
    lng: lng + dEast / mPerDegLng(lat),
  };
}

// ==================== HAVERSINE (lihat catatan "TIDAK diimpor" di atas) =====

export function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ==================== VINCENTY inverse (WGS-84) — referensi jarak elipsoid ==

export function vincenty(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const a = 6378137, b = 6356752.314245, f = 1 / 298.257223563;
  const rad = Math.PI / 180;
  const L = (lon2 - lon1) * rad;
  const U1 = Math.atan((1 - f) * Math.tan(lat1 * rad));
  const U2 = Math.atan((1 - f) * Math.tan(lat2 * rad));
  const sinU1 = Math.sin(U1), cosU1 = Math.cos(U1);
  const sinU2 = Math.sin(U2), cosU2 = Math.cos(U2);
  let lambda = L, lambdaP: number, iter = 0;
  let cosSqAlpha = 0, sinSigma = 0, cos2SigmaM = 0, cosSigma = 0, sigma = 0;
  do {
    const sinLambda = Math.sin(lambda), cosLambda = Math.cos(lambda);
    sinSigma = Math.sqrt(
      (cosU2 * sinLambda) ** 2 + (cosU1 * sinU2 - sinU1 * cosU2 * cosLambda) ** 2,
    );
    if (sinSigma === 0) return 0;
    cosSigma = sinU1 * sinU2 + cosU1 * cosU2 * cosLambda;
    sigma = Math.atan2(sinSigma, cosSigma);
    const sinAlpha = (cosU1 * cosU2 * sinLambda) / sinSigma;
    cosSqAlpha = 1 - sinAlpha ** 2;
    cos2SigmaM = cosSqAlpha !== 0 ? cosSigma - (2 * sinU1 * sinU2) / cosSqAlpha : 0;
    const C = (f / 16) * cosSqAlpha * (4 + f * (4 - 3 * cosSqAlpha));
    lambdaP = lambda;
    lambda = L + (1 - C) * f * sinAlpha *
      (sigma + C * sinSigma * (cos2SigmaM + C * cosSigma * (-1 + 2 * cos2SigmaM ** 2)));
  } while (Math.abs(lambda - lambdaP) > 1e-12 && ++iter < 1000);
  const uSq = (cosSqAlpha * (a * a - b * b)) / (b * b);
  const A = 1 + (uSq / 16384) * (4096 + uSq * (-768 + uSq * (320 - 175 * uSq)));
  const B = (uSq / 1024) * (256 + uSq * (-128 + uSq * (74 - 47 * uSq)));
  const deltaSigma = B * sinSigma * (cos2SigmaM + (B / 4) *
    (cosSigma * (-1 + 2 * cos2SigmaM ** 2) -
      (B / 6) * cos2SigmaM * (-3 + 4 * sinSigma ** 2) * (-3 + 4 * cos2SigmaM ** 2)));
  return b * A * (sigma - deltaSigma);
}

// ==================== MIQAT (cermin seed server, BUKAN dari sacred-zones-core) =

export interface MiqatDef { name: string; lat: number; lng: number; radius: number; warning: number; }
export const MIQAT: MiqatDef[] = [
  { name: 'Dzulhulaifah', lat: 24.4097, lng: 39.5433, radius: 1000, warning: 3000 },
  { name: 'Al-Juhfah', lat: 22.7267, lng: 39.0778, radius: 1000, warning: 3000 },
  { name: 'Qarnul Manazil', lat: 21.6219, lng: 40.4344, radius: 1000, warning: 3000 },
  { name: 'Yalamlam', lat: 20.5489, lng: 39.8733, radius: 1000, warning: 3000 },
  { name: 'Dhat Irq', lat: 21.9269, lng: 40.4161, radius: 1000, warning: 3000 },
];

// ==================== METRIK ================================================

export interface Bin { tp: number; fp: number; tn: number; fn: number; }
export function binMetrics(b: Bin) {
  const total = b.tp + b.fp + b.tn + b.fn;
  const acc = total ? (b.tp + b.tn) / total : 0;
  const prec = b.tp + b.fp ? b.tp / (b.tp + b.fp) : 0;
  const rec = b.tp + b.fn ? b.tp / (b.tp + b.fn) : 0;
  const f1 = prec + rec ? (2 * prec * rec) / (prec + rec) : 0;
  return { acc, prec, rec, f1 };
}
export const pct = (x: number) => (x * 100).toFixed(2);
