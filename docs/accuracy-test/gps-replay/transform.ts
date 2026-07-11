/*
 * Transformasi koordinat untuk georeferensi ulang trace GPS.
 *
 * Metode (didokumentasikan sebagai asumsi di README):
 * 1. toLocalENU  — proyeksi equirectangular relatif titik awal trace
 *    (konstanta meter/derajat sama dengan harness: 111.320 m per derajat lintang).
 * 2. rigidTransform — translasi + rotasi (+skala opsional, HANYA untuk pemetaan
 *    sa'i; faktor skala dilaporkan karena ikut menskalakan derau).
 * 3. extractResiduals — deviasi titik mentah terhadap referensi terhalus
 *    (moving average terpusat); deret residual inilah "pola galat asli".
 * 4. resampleResiduals — interpolasi linier deret residual ke grid waktu tetap
 *    (default 3 dtk, sesuai sampling BestForNavigation aplikasi).
 */
import type { TracePoint } from './parser';

export const M_PER_DEG_LAT = 111320;
export function mPerDegLon(latDeg: number): number {
  return M_PER_DEG_LAT * Math.cos((latDeg * Math.PI) / 180);
}

export interface EnuPoint { t: number; e: number; n: number; acc: number | null; }

/** Proyeksi ke koordinat lokal East/North (meter) relatif titik pertama. */
export function toLocalENU(points: TracePoint[]): { origin: TracePoint; enu: EnuPoint[] } {
  if (points.length === 0) throw new Error('toLocalENU: trace kosong');
  const origin = points[0];
  const kLon = mPerDegLon(origin.lat);
  const enu = points.map((p) => ({
    t: p.t,
    e: (p.lon - origin.lon) * kLon,
    n: (p.lat - origin.lat) * M_PER_DEG_LAT,
    acc: p.acc,
  }));
  return { origin, enu };
}

/** Balikan ENU lokal -> lat/lon pada kerangka acuan BARU (anchor). */
export function enuToLatLon(
  e: number, n: number, anchor: { lat: number; lng: number },
): { lat: number; lng: number } {
  return {
    lat: anchor.lat + n / M_PER_DEG_LAT,
    lng: anchor.lng + e / mPerDegLon(anchor.lat),
  };
}

/**
 * Transformasi rigid: rotasi theta (radian, berlawanan jarum jam) lalu translasi.
 * scale default 1 (rigid murni); scale != 1 hanya untuk pemetaan sa'i.
 */
export function rigidTransform(
  enu: EnuPoint[], thetaRad: number, tE: number, tN: number, scale: number = 1,
): EnuPoint[] {
  const c = Math.cos(thetaRad), s = Math.sin(thetaRad);
  return enu.map((p) => ({
    t: p.t,
    e: scale * (p.e * c - p.n * s) + tE,
    n: scale * (p.e * s + p.n * c) + tN,
    acc: p.acc,
  }));
}

/** Arah dominan trace (radian dari sumbu-E, ccw) via titik awal->akhir. */
export function principalBearing(enu: EnuPoint[]): number {
  const a = enu[0], b = enu[enu.length - 1];
  return Math.atan2(b.n - a.n, b.e - a.e);
}

/**
 * Referensi terhalus: moving average terpusat.
 * Jendela menyusut SIMETRIS di ujung (k = min(half, i, n-1-i)) — jendela asimetris
 * menimbulkan bias tepi (garis lurus pun menghasilkan residual palsu).
 * Konsekuensi: residual di kedua titik ujung selalu 0; statistik derau sebaiknya
 * memangkas half-window dari kedua ujung (dilakukan di characterize.ts).
 */
export function smoothPath(enu: EnuPoint[], window: number = 11): EnuPoint[] {
  const half = Math.floor(window / 2);
  const n = enu.length;
  return enu.map((p, i) => {
    const k = Math.min(half, i, n - 1 - i);
    let se = 0, sn = 0;
    for (let j = i - k; j <= i + k; j++) { se += enu[j].e; sn += enu[j].n; }
    const m = 2 * k + 1;
    return { t: p.t, e: se / m, n: sn / m, acc: p.acc };
  });
}

export interface Residual { t: number; dE: number; dN: number; }

/** Residual = mentah - terhalus (per sumbu). */
export function extractResiduals(raw: EnuPoint[], smooth: EnuPoint[]): Residual[] {
  if (raw.length !== smooth.length) throw new Error('extractResiduals: panjang tidak sama');
  return raw.map((p, i) => ({ t: p.t, dE: p.e - smooth[i].e, dN: p.n - smooth[i].n }));
}

/** Interpolasi linier deret residual ke grid dt tetap (default 3000 ms). */
export function resampleResiduals(res: Residual[], dtMs: number = 3000): Residual[] {
  if (res.length < 2) return [...res];
  const out: Residual[] = [];
  const t0 = res[0].t, tEnd = res[res.length - 1].t;
  let j = 0;
  for (let t = t0; t <= tEnd; t += dtMs) {
    while (j < res.length - 2 && res[j + 1].t <= t) j++;
    const a = res[j], b = res[j + 1];
    const f = b.t === a.t ? 0 : (t - a.t) / (b.t - a.t);
    out.push({ t, dE: a.dE + (b.dE - a.dE) * f, dN: a.dN + (b.dN - a.dN) * f });
  }
  return out;
}
