/*
 * =============================================================================
 *  MABRUR — Pengujian Akurasi Algoritma Geospasial (berbasis simulasi)
 * =============================================================================
 *  Menguji 6 algoritma inti terhadap injeksi noise GPS Gaussian (sigma = 0,1,3,5,10,15 m):
 *    1. Haversine        vs Vincenty (elipsoid WGS-84)   -> MAE, RMSE, error %
 *    2. Geofence Miqat   (point-in-circle)               -> confusion matrix, F1
 *    3. Deteksi Arafah   (ray-casting polygon)           -> confusion matrix, F1
 *    4. Penghitung Tawaf (angular crossing)              -> counting accuracy
 *    5. Penghitung Sa'i  (zone alternation)              -> counting accuracy
 *    6. Deteksi Jamarat  (nearest-in-radius, 3 kelas)    -> confusion matrix
 *
 *  Algoritma disalin VERBATIM dari:
 *    apps/mobile/src/services/sacred-zones.ts
 *    apps/mobile/src/services/location.ts
 *  (tracker di-refactor agar menerima `now` eksplisit demi determinisme; logika identik).
 *
 *  Reproducible: RNG mulberry32 ber-seed. Jalankan: npx tsx docs/accuracy-test/run.ts
 * =============================================================================
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const OUT_DIR = join(__dirname, 'results');
mkdirSync(OUT_DIR, { recursive: true });

const SEED = 42;
const SIGMAS = [0, 1, 3, 5, 10, 15]; // meter, std dev per sumbu (East/North)

// Akumulator hasil terstruktur -> results/monte_carlo_results.json
// (pengisian murni aditif; tidak menambah/menggeser panggilan rng() apa pun)
const J: {
  meta: Record<string, unknown>;
  geometry: Record<string, number>;
  haversine: Record<string, { mae: number; rmse: number; meanPct: number; maxPct: number }>;
  miqat: Array<Record<string, number>>;
  arafah: Array<Record<string, number>>;
  tawaf: Array<Record<string, number>>;
  sai: Array<Record<string, number>>;
  jamarat: Array<Record<string, number>>;
  jamarat_confusion_sigma15: Record<string, Record<string, number>>;
} = {
  meta: {
    seed: SEED,
    prng: 'mulberry32',
    sigmas_m: SIGMAS,
    samples: {
      haversine_per_skenario: 5000, miqat_per_sigma: 8000, arafah_per_sigma: 12000,
      tawaf_trials_per_sigma: 300, sai_trials_per_sigma: 300, jamarat_per_kelas_per_sigma: 4000,
    },
  },
  geometry: {}, haversine: {}, miqat: [], arafah: [], tawaf: [], sai: [],
  jamarat: [], jamarat_confusion_sigma15: {},
};

// ============================ RNG & NOISE ====================================

function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
let rng = mulberry32(SEED);
function resetRng(offset = 0) { rng = mulberry32(SEED + offset); }

// Box-Muller -> N(0,1)
function gauss(): number {
  let u = 0, v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

const M_PER_DEG_LAT = 111320;
function mPerDegLng(lat: number) { return 111320 * Math.cos((lat * Math.PI) / 180); }

// Injeksi noise GPS: offset Gaussian isotropik (sigma m per sumbu East & North)
function addNoise(lat: number, lng: number, sigma: number) {
  if (sigma === 0) return { lat, lng };
  const dEast = gauss() * sigma;
  const dNorth = gauss() * sigma;
  return {
    lat: lat + dNorth / M_PER_DEG_LAT,
    lng: lng + dEast / mPerDegLng(lat),
  };
}

// ==================== ALGORITMA ASLI (verbatim) ==============================

// --- location.ts: haversine ---
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// --- sacred-zones.ts: isPointInPolygon (ray casting) ---
function isPointInPolygon(lat: number, lng: number, polygon: Array<{ lat: number; lng: number }>): boolean {
  let inside = false;
  const n = polygon.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const yi = polygon[i].lat, xi = polygon[i].lng;
    const yj = polygon[j].lat, xj = polygon[j].lng;
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// --- koordinat referensi (verbatim) ---
const KAABAH = { lat: 21.42251, lng: 39.8262 };
const SAFA = { lat: 21.42266, lng: 39.82649 };
const MARWAH = { lat: 21.4264, lng: 39.82698 };
const ARAFAH_BOUNDARY = [
  { lat: 21.375, lng: 39.96 }, { lat: 21.378, lng: 40.01 }, { lat: 21.34, lng: 40.02 },
  { lat: 21.325, lng: 39.99 }, { lat: 21.335, lng: 39.955 },
];
const JAMARAT = {
  ula: { lat: 21.4212, lng: 39.8717, name: 'Ula' },
  wustha: { lat: 21.4207, lng: 39.8722, name: 'Wustha' },
  aqabah: { lat: 21.4203, lng: 39.8727, name: 'Aqabah' },
};
type JamKey = 'ula' | 'wustha' | 'aqabah';

const MIQAT = [
  { name: 'Dzulhulaifah', lat: 24.4097, lng: 39.5433, radius: 1000, warning: 3000 },
  { name: 'Al-Juhfah', lat: 22.7267, lng: 39.0778, radius: 1000, warning: 3000 },
  { name: 'Qarnul Manazil', lat: 21.6219, lng: 40.4344, radius: 1000, warning: 3000 },
  { name: 'Yalamlam', lat: 20.5489, lng: 39.8733, radius: 1000, warning: 3000 },
  { name: 'Dhat Irq', lat: 21.9269, lng: 40.4161, radius: 1000, warning: 3000 },
];

// --- TawafTracker (logika identik; Date.now() -> parameter now) ---
class TawafTracker {
  private prevAngle: number | null = null;
  private rounds = 0;
  private lastCrossTime = 0;
  private readonly MIN_INTERVAL = 120_000;
  private getAngle(lat: number, lng: number): number {
    const dLat = lat - KAABAH.lat;
    const dLng = lng - KAABAH.lng;
    return Math.atan2(dLat, dLng) * (180 / Math.PI);
  }
  update(lat: number, lng: number, now: number): void {
    const dist = haversine(lat, lng, KAABAH.lat, KAABAH.lng);
    if (dist < 10 || dist > 80) return;
    const angle = this.getAngle(lat, lng);
    if (this.prevAngle !== null) {
      const crossed = this.prevAngle > 0 && this.prevAngle < 90 && angle < 0 && angle > -90;
      if (crossed && now - this.lastCrossTime > this.MIN_INTERVAL) {
        this.rounds++; this.lastCrossTime = now;
      }
    }
    this.prevAngle = angle;
  }
  getRounds() { return this.rounds; }
}

// --- SaiTracker (logika identik) ---
type SaiZone = 'safa' | 'marwah' | 'between';
class SaiTracker {
  private lastZone: SaiZone = 'between';
  private legs = 0;
  private started = false;
  private readonly ZONE_RADIUS = 25;
  private detectZone(lat: number, lng: number): SaiZone {
    if (haversine(lat, lng, SAFA.lat, SAFA.lng) <= this.ZONE_RADIUS) return 'safa';
    if (haversine(lat, lng, MARWAH.lat, MARWAH.lng) <= this.ZONE_RADIUS) return 'marwah';
    return 'between';
  }
  update(lat: number, lng: number): void {
    const zone = this.detectZone(lat, lng);
    if (zone === 'between' || zone === this.lastZone) return;
    if (!this.started) { if (zone === 'safa') { this.started = true; this.lastZone = 'safa'; } return; }
    if ((this.lastZone === 'safa' && zone === 'marwah') || (this.lastZone === 'marwah' && zone === 'safa')) {
      this.legs++; this.lastZone = zone;
    }
  }
  getLegs() { return this.legs; }
}

// --- detectNearestJamarat (verbatim) ---
function detectNearestJamarat(lat: number, lng: number): JamKey | null {
  const entries = Object.entries(JAMARAT) as Array<[JamKey, typeof JAMARAT.ula]>;
  let nearest: { key: JamKey; distance: number } | null = null;
  for (const [key, j] of entries) {
    const d = haversine(lat, lng, j.lat, j.lng);
    if (d <= 30 && (!nearest || d < nearest.distance)) nearest = { key, distance: d };
  }
  return nearest ? nearest.key : null;
}

// ==================== REFERENSI: Vincenty inverse (WGS-84) ===================

function vincenty(lat1: number, lon1: number, lat2: number, lon2: number): number {
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

// ==================== METRIK ================================================

interface Bin { tp: number; fp: number; tn: number; fn: number; }
function binMetrics(b: Bin) {
  const total = b.tp + b.fp + b.tn + b.fn;
  const acc = total ? (b.tp + b.tn) / total : 0;
  const prec = b.tp + b.fp ? b.tp / (b.tp + b.fp) : 0;
  const rec = b.tp + b.fn ? b.tp / (b.tp + b.fn) : 0;
  const f1 = prec + rec ? (2 * prec * rec) / (prec + rec) : 0;
  return { acc, prec, rec, f1 };
}
const pct = (x: number) => (x * 100).toFixed(2);

// ==================== OUTPUT BUILDER ========================================

const lines: string[] = [];
function w(s = '') { lines.push(s); console.log(s); }

w('# Hasil Pengujian Akurasi Algoritma Geospasial — Sistem Mabrur');
w('');
w(`> Simulasi Monte Carlo, RNG mulberry32 ber-seed (seed=${SEED}) — hasil reproducible.`);
w(`> Model noise GPS: Gaussian isotropik, sigma per sumbu (East/North) = {${SIGMAS.join(', ')}} m.`);
w(`> sigma=0 = baseline tanpa noise (verifikasi kebenaran algoritma).`);
w('');

// ============ GEOMETRI DASAR (untuk paper) ==================================
w('## 0. Karakteristik Geometri (konteks)');
w('');
const dSafaMarwah = haversine(SAFA.lat, SAFA.lng, MARWAH.lat, MARWAH.lng);
const dUW = haversine(JAMARAT.ula.lat, JAMARAT.ula.lng, JAMARAT.wustha.lat, JAMARAT.wustha.lng);
const dWA = haversine(JAMARAT.wustha.lat, JAMARAT.wustha.lng, JAMARAT.aqabah.lat, JAMARAT.aqabah.lng);
const dUA = haversine(JAMARAT.ula.lat, JAMARAT.ula.lng, JAMARAT.aqabah.lat, JAMARAT.aqabah.lng);
J.geometry = {
  safa_marwah_m: +dSafaMarwah.toFixed(1),
  jamarat_ula_wustha_m: +dUW.toFixed(1),
  jamarat_wustha_aqabah_m: +dWA.toFixed(1),
  jamarat_ula_aqabah_m: +dUA.toFixed(1),
};
w('| Besaran | Nilai |');
w('|---|---|');
w(`| Jarak Safa–Marwah | ${dSafaMarwah.toFixed(1)} m |`);
w(`| Jarak Jamarat Ula–Wustha | ${dUW.toFixed(1)} m |`);
w(`| Jarak Jamarat Wustha–Aqabah | ${dWA.toFixed(1)} m |`);
w(`| Jarak Jamarat Ula–Aqabah | ${dUA.toFixed(1)} m |`);
w(`| Radius deteksi Jamarat | 30 m (2×radius=60 m < jarak pilar terdekat 68 m → tidak tumpang tindih) |`);
w(`| Radius zona Sa'i (Safa/Marwah) | 25 m |`);
w(`| Band radius Tawaf | 10–80 m dari Ka'bah |`);
w('');

// ============ 1. HAVERSINE vs VINCENTY ======================================
w('## 1. Akurasi Haversine vs Vincenty (elipsoid WGS-84)');
w('');
resetRng(1);
function haversineTest(label: string, gen: () => [number, number, number, number], n: number) {
  let sumErr = 0, sumSq = 0, maxPct = 0, sumPct = 0, cnt = 0;
  for (let i = 0; i < n; i++) {
    const [la1, lo1, la2, lo2] = gen();
    const ref = vincenty(la1, lo1, la2, lo2);
    if (ref < 1) continue;
    const hav = haversine(la1, lo1, la2, lo2);
    const err = Math.abs(hav - ref);
    const p = (err / ref) * 100;
    sumErr += err; sumSq += err * err; sumPct += p; maxPct = Math.max(maxPct, p); cnt++;
  }
  const mae = sumErr / cnt, rmse = Math.sqrt(sumSq / cnt), meanPct = sumPct / cnt;
  w(`| ${label} | ${mae.toFixed(3)} | ${rmse.toFixed(3)} | ${meanPct.toFixed(4)} | ${maxPct.toFixed(4)} |`);
  return { mae, rmse, meanPct, maxPct };
}
w('| Skenario jarak | MAE (m) | RMSE (m) | Error rata2 (%) | Error maks (%) |');
w('|---|---|---|---|---|');
// (a) skala tawaf/sai: <500 m di sekitar Masjidil Haram
const havLokal = haversineTest('Lokal Masjidil Haram (0–0,5 km)', () => {
  const la1 = 21.42 + (rng() - 0.5) * 0.01, lo1 = 39.826 + (rng() - 0.5) * 0.01;
  const la2 = la1 + (rng() - 0.5) * 0.008, lo2 = lo1 + (rng() - 0.5) * 0.008;
  return [la1, lo1, la2, lo2];
}, 5000);
// (b) skala miqat
const havMiqat = haversineTest('Skala Miqat (10–450 km)', () => {
  const la1 = 21 + rng() * 4, lo1 = 39 + rng() * 2;
  const la2 = 21 + rng() * 4, lo2 = 39 + rng() * 2;
  return [la1, lo1, la2, lo2];
}, 5000);
J.haversine = {
  lokal: { mae: +havLokal.mae.toFixed(3), rmse: +havLokal.rmse.toFixed(3),
           meanPct: +havLokal.meanPct.toFixed(4), maxPct: +havLokal.maxPct.toFixed(4) },
  miqat: { mae: +havMiqat.mae.toFixed(3), rmse: +havMiqat.rmse.toFixed(3),
           meanPct: +havMiqat.meanPct.toFixed(4), maxPct: +havMiqat.maxPct.toFixed(4) },
};
w('');
w('*Catatan: Haversine mengasumsikan bumi bola (R=6.371 km); Vincenty memodelkan elipsoid WGS-84.*');
w('');

// ============ 2. GEOFENCE MIQAT (point-in-circle) ===========================
w("## 2. Geofence Miqat — klasifikasi 'dalam batas' (radius 1.000 m)");
w('');
w('Ground truth = jarak sebenarnya ≤ 1.000 m. Prediksi = jarak dari posisi ber-noise ≤ 1.000 m.');
w('');
w('| sigma (m) | Akurasi (%) | Presisi (%) | Recall (%) | F1 (%) |');
w('|---|---|---|---|---|');
const miqatCsv = ['sigma,accuracy,precision,recall,f1'];
for (const sigma of SIGMAS) {
  resetRng(100 + sigma);
  const b: Bin = { tp: 0, fp: 0, tn: 0, fn: 0 };
  const N = 8000;
  for (let i = 0; i < N; i++) {
    const m = MIQAT[i % MIQAT.length];
    // titik pada jarak sebenarnya uniform 0–2500 m, bearing acak (menekankan batas 1000 m)
    const trueDist = rng() * 2500;
    const bearing = rng() * 2 * Math.PI;
    const dN = trueDist * Math.cos(bearing), dE = trueDist * Math.sin(bearing);
    const lat = m.lat + dN / M_PER_DEG_LAT;
    const lng = m.lng + dE / mPerDegLng(m.lat);
    const truth = haversine(lat, lng, m.lat, m.lng) <= m.radius; // ground truth: posisi bersih
    const nz = addNoise(lat, lng, sigma);
    const pred = haversine(nz.lat, nz.lng, m.lat, m.lng) <= m.radius;
    if (pred && truth) b.tp++; else if (pred && !truth) b.fp++;
    else if (!pred && !truth) b.tn++; else b.fn++;
  }
  const mt = binMetrics(b);
  w(`| ${sigma} | ${pct(mt.acc)} | ${pct(mt.prec)} | ${pct(mt.rec)} | ${pct(mt.f1)} |`);
  miqatCsv.push(`${sigma},${pct(mt.acc)},${pct(mt.prec)},${pct(mt.rec)},${pct(mt.f1)}`);
  J.miqat.push({ sigma, akurasi: +pct(mt.acc), presisi: +pct(mt.prec), recall: +pct(mt.rec), f1: +pct(mt.f1) });
}
writeFileSync(join(OUT_DIR, 'miqat_accuracy.csv'), miqatCsv.join('\n'));
w('');

// ============ 3. DETEKSI ARAFAH (ray casting) ===============================
w('## 3. Deteksi Arafah — point-in-polygon (ray casting, 5 titik)');
w('');
w('Ground truth = point-in-polygon posisi bersih. Prediksi = point-in-polygon posisi ber-noise.');
w('');
w('| sigma (m) | Akurasi (%) | Presisi (%) | Recall (%) | F1 (%) |');
w('|---|---|---|---|---|');
const arafahCsv = ['sigma,accuracy,precision,recall,f1'];
// bounding box poligon
const latMin = 21.320, latMax = 21.382, lngMin = 39.950, lngMax = 40.025;
for (const sigma of SIGMAS) {
  resetRng(200 + sigma);
  const b: Bin = { tp: 0, fp: 0, tn: 0, fn: 0 };
  const N = 12000;
  for (let i = 0; i < N; i++) {
    const lat = latMin + rng() * (latMax - latMin);
    const lng = lngMin + rng() * (lngMax - lngMin);
    const truth = isPointInPolygon(lat, lng, ARAFAH_BOUNDARY);
    const nz = addNoise(lat, lng, sigma);
    const pred = isPointInPolygon(nz.lat, nz.lng, ARAFAH_BOUNDARY);
    if (pred && truth) b.tp++; else if (pred && !truth) b.fp++;
    else if (!pred && !truth) b.tn++; else b.fn++;
  }
  const mt = binMetrics(b);
  w(`| ${sigma} | ${pct(mt.acc)} | ${pct(mt.prec)} | ${pct(mt.rec)} | ${pct(mt.f1)} |`);
  arafahCsv.push(`${sigma},${pct(mt.acc)},${pct(mt.prec)},${pct(mt.rec)},${pct(mt.f1)}`);
  J.arafah.push({ sigma, akurasi: +pct(mt.acc), presisi: +pct(mt.prec), recall: +pct(mt.rec), f1: +pct(mt.f1) });
}
writeFileSync(join(OUT_DIR, 'arafah_accuracy.csv'), arafahCsv.join('\n'));
w('');
w('*Kesalahan terkonsentrasi di pita tepi poligon; interior/eksterior jauh selalu benar.*');
w('');

// ============ 4. PENGHITUNG TAWAF ===========================================
w('## 4. Penghitung Tawaf Otomatis (target = 7 putaran)');
w('');
function tawafPath(): Array<{ lat: number; lng: number; t: number }> {
  // Mulai dari sisi barat (beta=270 deg), tempuh tepat 7 putaran penuh.
  // Crossing sisi timur (beta=90 mod 360) terjadi pada offset 180,540,...,2340 deg
  // -> 7 crossing, semua di interior dengan margin 180 deg di kedua ujung.
  const r = 25, dt = 3, perLap = 300, stepsPerLap = perLap / dt;
  const startBeta = 271.8; // offset setengah-langkah: hindari sampel mendarat tepat di angle=0 (garis Hajar Aswad)
  const total = 7 * stepsPerLap; // 700 langkah x 3,6 deg = 2520 deg = 7 putaran
  const pts: Array<{ lat: number; lng: number; t: number }> = [];
  let t = 0;
  for (let s = 0; s < total; s++) {
    const beta = ((startBeta + s * (360 / stepsPerLap)) * Math.PI) / 180;
    const dN = r * Math.cos(beta), dE = r * Math.sin(beta);
    const lat = KAABAH.lat + dN / M_PER_DEG_LAT;
    const lng = KAABAH.lng + dE / mPerDegLng(KAABAH.lat);
    pts.push({ lat, lng, t: t * 1000 });
    t += dt;
  }
  return pts;
}
w('| sigma (m) | Rata2 putaran | Akurasi tepat-7 (%) | MAE | RMSE |');
w('|---|---|---|---|---|');
const tawafCsv = ['sigma,mean,exact7_pct,mae,rmse'];
const TRIALS = 300;
for (const sigma of SIGMAS) {
  resetRng(300 + sigma);
  let sum = 0, exact = 0, sumErr = 0, sumSq = 0;
  for (let tr = 0; tr < TRIALS; tr++) {
    const path = tawafPath();
    const tk = new TawafTracker();
    for (const p of path) {
      const nz = addNoise(p.lat, p.lng, sigma);
      tk.update(nz.lat, nz.lng, p.t);
    }
    const r = tk.getRounds();
    sum += r; if (r === 7) exact++;
    sumErr += Math.abs(r - 7); sumSq += (r - 7) ** 2;
  }
  const mean = sum / TRIALS, mae = sumErr / TRIALS, rmse = Math.sqrt(sumSq / TRIALS);
  w(`| ${sigma} | ${mean.toFixed(2)} | ${pct(exact / TRIALS)} | ${mae.toFixed(3)} | ${rmse.toFixed(3)} |`);
  tawafCsv.push(`${sigma},${mean.toFixed(2)},${pct(exact / TRIALS)},${mae.toFixed(3)},${rmse.toFixed(3)}`);
  J.tawaf.push({ sigma, mean: +mean.toFixed(2), exact7: +pct(exact / TRIALS), mae: +mae.toFixed(3), rmse: +rmse.toFixed(3) });
}
writeFileSync(join(OUT_DIR, 'tawaf_accuracy.csv'), tawafCsv.join('\n'));
w('');
w(`*${TRIALS} percobaan/sigma. Lintasan melingkar r=25 m, ~300 s/putaran (~0,52 m/s), sampling 3 s.*`);
w('');

// ============ 5. PENGHITUNG SA'I ============================================
w("## 5. Penghitung Sa'i Otomatis (target = 7 leg)");
w('');
function saiPath(): Array<{ lat: number; lng: number }> {
  const dt = 3;
  const legTime = 400 + rng() * 80;
  const steps = Math.round(legTime / dt);
  const pts: Array<{ lat: number; lng: number }> = [];
  for (let leg = 0; leg < 7; leg++) {
    const src = leg % 2 === 0 ? SAFA : MARWAH;
    const dst = leg % 2 === 0 ? MARWAH : SAFA;
    for (let s = 0; s < steps; s++) {
      const f = s / steps;
      pts.push({ lat: src.lat + (dst.lat - src.lat) * f, lng: src.lng + (dst.lng - src.lng) * f });
    }
  }
  pts.push({ lat: MARWAH.lat, lng: MARWAH.lng });
  return pts;
}
w('| sigma (m) | Rata2 leg | Akurasi tepat-7 (%) | MAE | RMSE |');
w('|---|---|---|---|---|');
const saiCsv = ['sigma,mean,exact7_pct,mae,rmse'];
for (const sigma of SIGMAS) {
  resetRng(400 + sigma);
  let sum = 0, exact = 0, sumErr = 0, sumSq = 0;
  for (let tr = 0; tr < TRIALS; tr++) {
    const path = saiPath();
    const tk = new SaiTracker();
    for (const p of path) {
      const nz = addNoise(p.lat, p.lng, sigma);
      tk.update(nz.lat, nz.lng);
    }
    const r = tk.getLegs();
    sum += r; if (r === 7) exact++;
    sumErr += Math.abs(r - 7); sumSq += (r - 7) ** 2;
  }
  const mean = sum / TRIALS, mae = sumErr / TRIALS, rmse = Math.sqrt(sumSq / TRIALS);
  w(`| ${sigma} | ${mean.toFixed(2)} | ${pct(exact / TRIALS)} | ${mae.toFixed(3)} | ${rmse.toFixed(3)} |`);
  saiCsv.push(`${sigma},${mean.toFixed(2)},${pct(exact / TRIALS)},${mae.toFixed(3)},${rmse.toFixed(3)}`);
  J.sai.push({ sigma, mean: +mean.toFixed(2), exact7: +pct(exact / TRIALS), mae: +mae.toFixed(3), rmse: +rmse.toFixed(3) });
}
writeFileSync(join(OUT_DIR, 'sai_accuracy.csv'), saiCsv.join('\n'));
w('');
w(`*${TRIALS} percobaan/sigma. Jarak Safa–Marwah ${dSafaMarwah.toFixed(0)} m, ~415–480 s/leg, sampling 3 s.*`);
w('');

// ============ 6. DETEKSI JAMARAT (3 kelas) ==================================
w('## 6. Deteksi Jamarat — identifikasi 1 dari 3 pilar (radius 30 m)');
w('');
w('Ground truth = pilar tempat jamaah berdiri (jarak ≤ 12 m dari pilar). Prediksi = jamarat terdekat dalam radius 30 m.');
w('');
w('| sigma (m) | Akurasi benar (%) | Salah pilar (%) | Tak terdeteksi (%) |');
w('|---|---|---|---|');
const jamCsv = ['sigma,correct,wrong,none'];
const jamKeys: JamKey[] = ['ula', 'wustha', 'aqabah'];
const confAtSigma: Record<number, Record<string, Record<string, number>>> = {};
for (const sigma of SIGMAS) {
  resetRng(500 + sigma);
  let correct = 0, wrong = 0, none = 0, total = 0;
  const conf: Record<string, Record<string, number>> = {};
  for (const k of jamKeys) conf[k] = { ula: 0, wustha: 0, aqabah: 0, none: 0 };
  const perClass = 4000;
  for (const truth of jamKeys) {
    const pillar = JAMARAT[truth];
    for (let i = 0; i < perClass; i++) {
      const d = rng() * 12; // jamaah berkerumun ≤12 m dari pilar
      const bearing = rng() * 2 * Math.PI;
      const lat = pillar.lat + (d * Math.cos(bearing)) / M_PER_DEG_LAT;
      const lng = pillar.lng + (d * Math.sin(bearing)) / mPerDegLng(pillar.lat);
      const nz = addNoise(lat, lng, sigma);
      const pred = detectNearestJamarat(nz.lat, nz.lng);
      total++;
      conf[truth][pred ?? 'none']++;
      if (pred === null) none++; else if (pred === truth) correct++; else wrong++;
    }
  }
  confAtSigma[sigma] = conf;
  w(`| ${sigma} | ${pct(correct / total)} | ${pct(wrong / total)} | ${pct(none / total)} |`);
  jamCsv.push(`${sigma},${pct(correct / total)},${pct(wrong / total)},${pct(none / total)}`);
  J.jamarat.push({ sigma, benar: +pct(correct / total), salahPilar: +pct(wrong / total), takTerdeteksi: +pct(none / total) });
}
writeFileSync(join(OUT_DIR, 'jamarat_accuracy.csv'), jamCsv.join('\n'));
w('');
// confusion matrix pada sigma = 15 m (kolom "tak terdeteksi" terisi; sigma kecil = diagonal sempurna)
const CM_SIGMA = 15;
J.jamarat_confusion_sigma15 = confAtSigma[CM_SIGMA];
w(`### Confusion matrix Jamarat pada sigma = ${CM_SIGMA} m`);
w('');
w('| Sebenarnya \\ Prediksi | Ula | Wustha | Aqabah | Tak terdeteksi |');
w('|---|---|---|---|---|');
for (const k of jamKeys) {
  const c = confAtSigma[CM_SIGMA][k];
  w(`| **${JAMARAT[k].name}** | ${c.ula} | ${c.wustha} | ${c.aqabah} | ${c.none} |`);
}
w('');
w('*Pilar terpisah 68–144 m > 2×radius (60 m) → nyaris tidak ada salah-pilar. Degradasi di sigma besar didominasi "tak terdeteksi": noise mendorong posisi keluar radius 30 m.*');
w('');

// ============ RINGKASAN =====================================================
w('## Ringkasan & Temuan');
w('');
w('- **Haversine**: galat terhadap elipsoid WGS-84 sangat kecil (< 0,5%), memadai untuk skala meter.');
w('- **Sa\'i**: paling tahan noise — pemisahan geometris Safa–Marwah (≈415 m) ≫ error GPS.');
w('- **Geofence Miqat & Arafah**: kesalahan hanya di pita tepi selebar ~sigma; akurasi menurun landai.');
w('- **Tawaf**: sensitif pada sigma besar (radius kecil 25 m); debounce 120 s meredam sebagian galat.');
w('- **Jamarat**: pemisahan pilar (68–144 m) memadai → salah-pilar hampir nol; kerentanan justru "tak terdeteksi" saat sigma besar (noise keluar radius 30 m). Layak dibahas sebagai keterbatasan.');
w('');
w(`*Dibangun dari analisis kode Mabrur. Seed=${SEED}. CSV per algoritma tersimpan di \`docs/accuracy-test/results/\`.*`);

writeFileSync(join(OUT_DIR, 'summary.md'), lines.join('\n'));
writeFileSync(join(OUT_DIR, 'monte_carlo_results.json'), JSON.stringify(J, null, 2) + '\n');
console.log('\n[OK] Ringkasan -> docs/accuracy-test/results/summary.md + 5 file CSV + monte_carlo_results.json.');
