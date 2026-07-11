/*
 * Replay trace GPS riil ke keenam algoritma deteksi ritual — melalui modul
 * PRODUKSI apps/mobile/src/services/sacred-zones-core (bukan salinan).
 *
 * Pemetaan per algoritma (asumsi lengkap di README):
 * - Sa'i    : transformasi rigid trace ke sumbu Safa->Marwah (skala dilaporkan);
 *             truth = lintasan terhalus melalui SaiTracker yang sama.
 * - Tawaf   : superimposisi deret residual riil (grid 3 dtk) ke lingkaran ideal
 *             r=25 m, 7 putaran; truth = 7.
 * - Miqat / Arafah / Jamarat : klasifikasi titik pada K penempatan deterministik
 *             melintasi batas; truth = sisi titik terhalus, prediksi = titik mentah.
 */
import {
  SAFA, MARWAH, KAABAH, ARAFAH_BOUNDARY, JAMARAT,
  isPointInPolygon, distanceMetersExport,
  TawafTracker, SaiTracker, detectNearestJamarat,
} from '../../../apps/mobile/src/services/sacred-zones-core';
import type { EnuPoint, Residual } from './transform';
import {
  rigidTransform, smoothPath, enuToLatLon, resampleResiduals,
  M_PER_DEG_LAT, mPerDegLon,
} from './transform';

// ==================== util ====================

interface Bin { tp: number; fp: number; tn: number; fn: number; }
function binMetrics(b: Bin) {
  const total = b.tp + b.fp + b.tn + b.fn;
  const acc = total ? (b.tp + b.tn) / total : 0;
  const prec = b.tp + b.fp ? b.tp / (b.tp + b.fp) : 0;
  const rec = b.tp + b.fn ? b.tp / (b.tp + b.fn) : 0;
  const f1 = prec + rec ? (2 * prec * rec) / (prec + rec) : 0;
  return { acc: acc * 100, prec: prec * 100, rec: rec * 100, f1: f1 * 100, total };
}
const r2 = (v: number) => +v.toFixed(2);

// ==================== SA'I ====================

export interface SaiReplayResult {
  applicable: boolean;
  scale: number;            // 419 / panjang-leg-aktual (derau ikut terskala)
  legLengthM: number;
  truthLegs: number;
  predictedLegs: number;
  exact: boolean;
}

export function replaySai(raw: EnuPoint[], smooth: EnuPoint[]): SaiReplayResult {
  // panjang leg = jarak terjauh titik terhalus dari titik awal terhalus
  const s0 = smooth[0];
  let far = 0, farIdx = 0;
  smooth.forEach((p, i) => {
    const d = Math.hypot(p.e - s0.e, p.n - s0.n);
    if (d > far) { far = d; farIdx = i; }
  });
  if (far < 50) {
    return { applicable: false, scale: 1, legLengthM: r2(far), truthLegs: 0, predictedLegs: 0, exact: true };
  }

  // Kerangka target: ENU ber-anchor SAFA; sumbu Safa->Marwah
  const kLon = mPerDegLon(SAFA.lat);
  const tgtE = (MARWAH.lng - SAFA.lng) * kLon;
  const tgtN = (MARWAH.lat - SAFA.lat) * M_PER_DEG_LAT;
  const corridor = Math.hypot(tgtE, tgtN); // ±419 m
  const targetBearing = Math.atan2(tgtN, tgtE);

  const traceBearing = Math.atan2(smooth[farIdx].n - s0.n, smooth[farIdx].e - s0.e);
  const theta = targetBearing - traceBearing;
  const scale = corridor / far;

  // bawa titik awal terhalus ke (0,0) dulu, lalu rotasi+skala, anchor = SAFA
  const center = (pts: EnuPoint[]) => pts.map((p) => ({ ...p, e: p.e - s0.e, n: p.n - s0.n }));
  const tRaw = rigidTransform(center(raw), theta, 0, 0, scale);
  const tSmooth = rigidTransform(center(smooth), theta, 0, 0, scale);

  const run = (pts: EnuPoint[]): number => {
    const tracker = new SaiTracker();
    for (const p of pts) {
      const ll = enuToLatLon(p.e, p.n, SAFA);
      tracker.update(ll.lat, ll.lng);
    }
    return tracker.getLegs();
  };
  const truthLegs = run(tSmooth);
  const predictedLegs = run(tRaw);
  return {
    applicable: true, scale: r2(scale), legLengthM: r2(far),
    truthLegs, predictedLegs, exact: truthLegs === predictedLegs,
  };
}

// ==================== TAWAF ====================

export interface TawafReplayResult {
  truthRounds: number;      // 7
  predictedRounds: number;
  exact: boolean;
  residualSamplesUsed: number;
  residualTiled: boolean;   // deret residual < 700 sampel -> diulang (dicatat)
}

export function replayTawaf(residuals: Residual[]): TawafReplayResult {
  const res3s = resampleResiduals(residuals, 3000);
  const stepsPerLap = 100, total = 7 * stepsPerLap; // identik dengan harness: 300 dtk/putaran, 3 dtk/sampel
  const startBeta = 271.8;
  const tiled = res3s.length < total;

  const tracker = new TawafTracker();
  for (let s = 0; s < total; s++) {
    const beta = ((startBeta + s * (360 / stepsPerLap)) * Math.PI) / 180;
    const rIdeal = 25;
    const dN = rIdeal * Math.cos(beta), dE = rIdeal * Math.sin(beta);
    const noise = res3s[s % res3s.length];
    const ll = enuToLatLon(dE + noise.dE, dN + noise.dN, KAABAH);
    tracker.update(ll.lat, ll.lng, s * 3000); // seam waktu produksi
  }
  return {
    truthRounds: 7, predictedRounds: tracker.getRounds(),
    exact: tracker.getRounds() === 7,
    residualSamplesUsed: Math.min(res3s.length, total), residualTiled: tiled,
  };
}

// ==================== KLASIFIKASI (miqat / arafah / jamarat) ====================

const PLACEMENTS = 25; // penempatan deterministik melintasi batas

export interface ClassifyResult { acc: number; prec: number; rec: number; f1: number; total: number; }

/** Penempatan: geser pasangan (smooth, raw) sehingga centroid smooth berada pada
 *  jarak bertanda d_k dari batas, d_k merentang simetris melintasi batas. */
function* placements(raw: EnuPoint[], smooth: EnuPoint[], spanM: number) {
  let ce = 0, cn = 0;
  for (const p of smooth) { ce += p.e; cn += p.n; }
  ce /= smooth.length; cn /= smooth.length;
  for (let k = 0; k < PLACEMENTS; k++) {
    const d = -spanM + (2 * spanM * k) / (PLACEMENTS - 1); // -span..+span
    yield { d, ce, cn };
  }
}

// Miqat: ring 1.000 m di sekitar Qarnul Manazil (zona seed produksi)
const QARNUL = { lat: 21.6219, lng: 40.4344 };
export function replayMiqat(raw: EnuPoint[], smooth: EnuPoint[]): ClassifyResult {
  const b: Bin = { tp: 0, fp: 0, tn: 0, fn: 0 };
  for (const { d, ce, cn } of placements(raw, smooth, 50)) {
    // anchor: titik pada jarak (1000 - d) di utara pusat -> centroid duduk di sisi dalam/luar ring
    const anchor = enuToLatLon(0, 1000 - d, QARNUL);
    for (let i = 0; i < raw.length; i++) {
      const sLL = enuToLatLon(smooth[i].e - ce, smooth[i].n - cn, anchor);
      const rLL = enuToLatLon(raw[i].e - ce, raw[i].n - cn, anchor);
      const truth = distanceMetersExport(sLL.lat, sLL.lng, QARNUL.lat, QARNUL.lng) <= 1000;
      const pred = distanceMetersExport(rLL.lat, rLL.lng, QARNUL.lat, QARNUL.lng) <= 1000;
      if (pred && truth) b.tp++; else if (pred && !truth) b.fp++;
      else if (!pred && !truth) b.tn++; else b.fn++;
    }
  }
  const m = binMetrics(b);
  return { acc: r2(m.acc), prec: r2(m.prec), rec: r2(m.rec), f1: r2(m.f1), total: m.total };
}

// Arafah: melintasi tepi selatan poligon (segmen v3->v4), normal ~utara-selatan
export function replayArafah(raw: EnuPoint[], smooth: EnuPoint[]): ClassifyResult {
  const edgeMid = {
    lat: (ARAFAH_BOUNDARY[2].lat + ARAFAH_BOUNDARY[3].lat) / 2,
    lng: (ARAFAH_BOUNDARY[2].lng + ARAFAH_BOUNDARY[3].lng) / 2,
  };
  const b: Bin = { tp: 0, fp: 0, tn: 0, fn: 0 };
  for (const { d, ce, cn } of placements(raw, smooth, 50)) {
    const anchor = enuToLatLon(0, d, edgeMid); // d>0 = ke utara (arah dalam poligon)
    for (let i = 0; i < raw.length; i++) {
      const sLL = enuToLatLon(smooth[i].e - ce, smooth[i].n - cn, anchor);
      const rLL = enuToLatLon(raw[i].e - ce, raw[i].n - cn, anchor);
      const truth = isPointInPolygon(sLL.lat, sLL.lng, ARAFAH_BOUNDARY);
      const pred = isPointInPolygon(rLL.lat, rLL.lng, ARAFAH_BOUNDARY);
      if (pred && truth) b.tp++; else if (pred && !truth) b.fp++;
      else if (!pred && !truth) b.tn++; else b.fn++;
    }
  }
  const m = binMetrics(b);
  return { acc: r2(m.acc), prec: r2(m.prec), rec: r2(m.rec), f1: r2(m.f1), total: m.total };
}

// Jamarat: penempatan di sekitar pilar Wustha (kasus tersulit: diapit dua pilar)
export interface JamaratReplayResult {
  benar: number; salahPilar: number; takTerdeteksi: number; totalTruthDetected: number;
}
export function replayJamarat(raw: EnuPoint[], smooth: EnuPoint[]): JamaratReplayResult {
  let benar = 0, salah = 0, none = 0;
  for (const { d, ce, cn } of placements(raw, smooth, 15)) {
    const anchor = enuToLatLon(0, d, JAMARAT.wustha);
    for (let i = 0; i < raw.length; i++) {
      const sLL = enuToLatLon(smooth[i].e - ce, smooth[i].n - cn, anchor);
      const rLL = enuToLatLon(raw[i].e - ce, raw[i].n - cn, anchor);
      const truth = detectNearestJamarat(sLL.lat, sLL.lng);
      if (!truth) continue; // truth di luar radius semua pilar -> di luar semesta uji naskah
      const pred = detectNearestJamarat(rLL.lat, rLL.lng);
      if (!pred) none++;
      else if (pred.key === truth.key) benar++;
      else salah++;
    }
  }
  const total = benar + salah + none;
  return {
    benar: total ? r2((benar / total) * 100) : 0,
    salahPilar: total ? r2((salah / total) * 100) : 0,
    takTerdeteksi: total ? r2((none / total) * 100) : 0,
    totalTruthDetected: total,
  };
}

// ==================== ORKESTRASI PER TRACE ====================

export interface TraceReplayResults {
  sai: SaiReplayResult;
  tawaf: TawafReplayResult;
  miqat: ClassifyResult;
  arafah: ClassifyResult;
  jamarat: JamaratReplayResult;
}

export function replayAll(raw: EnuPoint[], residuals: Residual[]): TraceReplayResults {
  const smooth = smoothPath(raw);
  return {
    sai: replaySai(raw, smooth),
    tawaf: replayTawaf(residuals),
    miqat: replayMiqat(raw, smooth),
    arafah: replayArafah(raw, smooth),
    jamarat: replayJamarat(raw, smooth),
  };
}
