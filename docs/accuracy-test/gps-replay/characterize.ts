/*
 * Karakterisasi derau empiris dari trace GPS.
 * Mengukur seberapa jauh derau riil menyimpang dari asumsi simulasi
 * (Gaussian isotropik i.i.d.): sigma per sumbu, normalitas (Jarque-Bera + data
 * Q-Q), dan autokorelasi temporal (ACF).
 *
 * Catatan metodologis: residual dihitung terhadap referensi terhalus (MA
 * terpusat, jendela 11). Half-window (5 sampel) dipangkas dari kedua ujung
 * sebelum statistik dihitung, karena jendela menyusut di ujung menekan residual.
 */
import type { EnuPoint, Residual } from './transform';
import { smoothPath, extractResiduals } from './transform';

export interface AxisStats {
  n: number;
  mean: number;
  sigma: number;
  skewness: number;
  kurtosisExcess: number;
  jarqueBera: number;   // JB = n/6 (S^2 + K^2/4); ~chi2(df=2) bila normal
  jbPValue: number;     // aproksimasi p dari chi2(2): p = exp(-JB/2)
  acf: number[];        // lag 1..MAX_LAG
  lag1: number;
  decorrelationLag: number; // lag pertama dengan |rho| < 0.2 (0 bila lag-1 sudah)
}

export interface NoiseCharacterization {
  window: number;
  trimmed: number;          // sampel terpangkas per ujung
  east: AxisStats;
  north: AxisStats;
  sigmaRadialMean: number;  // rata-rata |residual| radial
  sigmaEffective: number;   // sqrt((sigmaE^2 + sigmaN^2)/2) — setara sigma per-sumbu simulasi
  isotropyRatio: number;    // sigmaE / sigmaN (1 = isotropik)
  qq: { east: Array<[number, number]>; north: Array<[number, number]> }; // [teoretis, empiris]
  verdict: string;          // ringkasan tekstual penyimpangan dari Gaussian i.i.d.
}

const MAX_LAG = 20;
const QQ_POINTS = 99; // persentil 1..99

function mean(xs: number[]): number { return xs.reduce((a, b) => a + b, 0) / xs.length; }

function acfSeries(xs: number[], maxLag: number): number[] {
  const m = mean(xs);
  const c0 = xs.reduce((a, x) => a + (x - m) ** 2, 0) / xs.length;
  const out: number[] = [];
  for (let k = 1; k <= maxLag; k++) {
    let ck = 0;
    for (let i = 0; i < xs.length - k; i++) ck += (xs[i] - m) * (xs[i + k] - m);
    ck /= xs.length;
    out.push(c0 === 0 ? 0 : ck / c0);
  }
  return out;
}

// invers CDF normal baku (aproksimasi Acklam) — untuk kuantil teoretis Q-Q
export function normInv(p: number): number {
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const pl = 0.02425;
  if (p < pl) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p <= 1 - pl) {
    const q = p - 0.5, r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }
  const q = Math.sqrt(-2 * Math.log(1 - p));
  return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
    ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
}

function quantile(sorted: number[], p: number): number {
  const idx = p * (sorted.length - 1);
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

function axisStats(xs: number[]): AxisStats {
  const n = xs.length;
  const m = mean(xs);
  const dev = xs.map((x) => x - m);
  const m2 = mean(dev.map((d) => d * d));
  const m3 = mean(dev.map((d) => d * d * d));
  const m4 = mean(dev.map((d) => d * d * d * d));
  const sigma = Math.sqrt(m2);
  const skewness = m2 === 0 ? 0 : m3 / m2 ** 1.5;
  const kurtosisExcess = m2 === 0 ? 0 : m4 / (m2 * m2) - 3;
  const jb = (n / 6) * (skewness ** 2 + kurtosisExcess ** 2 / 4);
  const acf = acfSeries(xs, Math.min(MAX_LAG, n - 2));
  const decor = acf.findIndex((r) => Math.abs(r) < 0.2);
  return {
    n, mean: m, sigma, skewness, kurtosisExcess,
    jarqueBera: jb,
    jbPValue: Math.exp(-jb / 2), // survival chi2(df=2)
    acf, lag1: acf[0] ?? 0,
    decorrelationLag: decor === -1 ? MAX_LAG : decor + 1,
  };
}

function qqData(xs: number[], sigma: number, mu: number): Array<[number, number]> {
  const sorted = [...xs].sort((a, b) => a - b);
  const out: Array<[number, number]> = [];
  for (let i = 1; i <= QQ_POINTS; i++) {
    const p = i / (QQ_POINTS + 1);
    out.push([mu + sigma * normInv(p), quantile(sorted, p)]);
  }
  return out;
}

export function characterize(enu: EnuPoint[], window: number = 11): NoiseCharacterization {
  if (enu.length < 4 * window) {
    throw new Error(`characterize: trace terlalu pendek (${enu.length} titik; butuh >= ${4 * window})`);
  }
  const smooth = smoothPath(enu, window);
  const res: Residual[] = extractResiduals(enu, smooth);
  const half = Math.floor(window / 2);
  const core = res.slice(half, res.length - half); // pangkas bias tepi

  const east = axisStats(core.map((r) => r.dE));
  const north = axisStats(core.map((r) => r.dN));
  const sigmaEffective = Math.sqrt((east.sigma ** 2 + north.sigma ** 2) / 2);
  const sigmaRadialMean = mean(core.map((r) => Math.hypot(r.dE, r.dN)));
  const isotropyRatio = north.sigma === 0 ? Infinity : east.sigma / north.sigma;

  const flags: string[] = [];
  if (Math.max(east.lag1, north.lag1) > 0.3) {
    flags.push(`autokorelasi temporal signifikan (lag-1 rho E=${east.lag1.toFixed(2)}, N=${north.lag1.toFixed(2)}) — melanggar asumsi i.i.d.`);
  }
  if (isotropyRatio > 1.5 || isotropyRatio < 1 / 1.5) {
    flags.push(`anisotropik (sigmaE/sigmaN = ${isotropyRatio.toFixed(2)}) — melanggar asumsi isotropik`);
  }
  if (east.jbPValue < 0.05 || north.jbPValue < 0.05) {
    flags.push(`non-normal menurut Jarque-Bera (p_E=${east.jbPValue.toExponential(1)}, p_N=${north.jbPValue.toExponential(1)})`);
  }
  const verdict = flags.length === 0
    ? 'Konsisten dengan Gaussian isotropik i.i.d. pada taraf uji yang dipakai.'
    : flags.join('; ');

  return {
    window, trimmed: half, east, north,
    sigmaRadialMean, sigmaEffective, isotropyRatio,
    qq: {
      east: qqData(core.map((r) => r.dE), east.sigma, east.mean),
      north: qqData(core.map((r) => r.dN), north.sigma, north.mean),
    },
    verdict,
  };
}
