/*
 * Fungsi statistik murni dipakai bersama oleh run.ts (harness Monte Carlo) dan
 * tes vitest (docs/accuracy-test/gps-replay/__tests__/stats.test.ts). Tidak ada
 * Math.random()/Date.now() di sini — semua sumber acak (bila perlu) diinjeksi
 * lewat parameter gaussFn agar tetap deterministik terhadap RNG ber-seed caller.
 */

// ==================== INTERVAL KEPERCAYAAN WILSON (95%) ====================
// Dipakai untuk semua proporsi (akurasi miqat/arafah, tepat-7 tawaf/sai,
// benar/salah/tak-terdeteksi jamarat) — lebih andal daripada interval normal
// (Wald) terutama saat p mendekati 0 atau 100%.

const Z95 = 1.959963985; // Phi^-1(0.975)

export interface WilsonCI { lo: number; hi: number; }

/** successes dari n percobaan -> interval kepercayaan 95% Wilson (proporsi 0..1). */
export function wilson95(successes: number, n: number): WilsonCI {
  if (n <= 0) return { lo: 0, hi: 0 };
  const p = successes / n;
  const z2 = Z95 * Z95;
  const denom = 1 + z2 / n;
  const center = p + z2 / (2 * n);
  const adj = Z95 * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n));
  return {
    lo: Math.max(0, (center - adj) / denom),
    hi: Math.min(1, (center + adj) / denom),
  };
}

// ==================== DERAU AR(1) STASIONER ================================
// x_0 = sigma * g();  x_k = rho*x_{k-1} + sigma*sqrt(1-rho^2) * g()
// Properti: Var(x_k) = sigma^2 untuk semua k (dimulai dari keadaan stasioner),
// Corr(x_k, x_{k-1}) = rho. `gaussFn` adalah generator N(0,1) milik caller
// (mis. Box-Muller di atas RNG mulberry32 ber-seed run.ts) agar konsumsi RNG
// tetap deterministik & dapat direproduksi.
export function makeAR1(rho: number, sigma: number, gaussFn: () => number): () => number {
  let state: number | null = null;
  const innovSigma = sigma * Math.sqrt(Math.max(0, 1 - rho * rho));
  return () => {
    if (state === null) {
      state = sigma * gaussFn();
    } else {
      state = rho * state + innovSigma * gaussFn();
    }
    return state;
  };
}

/** rho dari time-constant Gauss-Markov: rho = exp(-dt/tau). */
export function gaussMarkovRho(dt: number, tau: number): number {
  return Math.exp(-dt / tau);
}

// ==================== DISTRIBUSI RICE (I0 termodifikasi Bessel) =============
// Dipakai untuk cek analitik "tak terdeteksi" Jamarat: magnitudo posisi
// ber-noise (offset sebenarnya nu, noise isotropik sigma) berdistribusi Rice.
// exp(-x)*I0(x) via aproksimasi Abramowitz & Stegun 9.8.1/9.8.2 (akurasi
// relatif ~1e-7 pada domain yang relevan) — dihitung dalam skala exp agar
// tidak overflow untuk x besar (I0(x) sendiri meledak untuk x > ~700).
export function expScaledI0(x: number): number {
  if (x < 3.75) {
    const t = x / 3.75;
    const t2 = t * t;
    const i0 = 1 + t2 * (3.5156229 + t2 * (3.0899424 + t2 * (1.2067492 +
      t2 * (0.2659732 + t2 * (0.0360768 + t2 * 0.0045813)))));
    return i0 * Math.exp(-x);
  }
  const t = 3.75 / x;
  const poly = 0.39894228 + t * (0.01328592 + t * (0.00225319 + t * (-0.00157565 +
    t * (0.00916281 + t * (-0.02057706 + t * (0.02635537 + t * (-0.01647633 + t * 0.00392377)))))));
  return poly / Math.sqrt(x);
}

/** PDF Rice f(r; nu, sigma), numerik stabil (eksponen digabung sebelum exp()). */
export function ricePdf(r: number, nu: number, sigma: number): number {
  if (r <= 0 || sigma <= 0) return 0;
  const exponent = -((r - nu) * (r - nu)) / (2 * sigma * sigma);
  return (r / (sigma * sigma)) * Math.exp(exponent) * expScaledI0((r * nu) / (sigma * sigma));
}

/** Aturan Simpson, n harus genap. */
export function simpson(f: (x: number) => number, a: number, b: number, n: number): number {
  const steps = n % 2 === 0 ? n : n + 1;
  const h = (b - a) / steps;
  let sum = f(a) + f(b);
  for (let i = 1; i < steps; i++) {
    const x = a + i * h;
    sum += (i % 2 === 0 ? 2 : 4) * f(x);
  }
  return (sum * h) / 3;
}

/** CDF Rice P(R <= r) via integrasi numerik Simpson dari 0 ke r. */
export function riceCdf(r: number, nu: number, sigma: number, steps = 2000): number {
  if (r <= 0) return 0;
  return simpson((x) => ricePdf(x, nu, sigma), 0, r, steps);
}

// ==================== GEOMETRI BANTUAN =======================================

export interface LatLng { lat: number; lng: number; }

/** Keliling poligon tertutup (m), pakai fungsi jarak yang diinjeksi (haversine). */
export function polygonPerimeterMeters(
  polygon: LatLng[],
  distFn: (lat1: number, lng1: number, lat2: number, lng2: number) => number,
): number {
  let total = 0;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    total += distFn(a.lat, a.lng, b.lat, b.lng);
  }
  return total;
}

/** Luas kotak sampel (m^2) dari batas lat/lng, pakai meter-per-derajat pada lat tengah. */
export function boxAreaM2(
  latMin: number, latMax: number, lngMin: number, lngMax: number,
  mPerDegLat: number, mPerDegLngAt: (lat: number) => number,
): number {
  const midLat = (latMin + latMax) / 2;
  const heightM = (latMax - latMin) * mPerDegLat;
  const widthM = (lngMax - lngMin) * mPerDegLngAt(midLat);
  return heightM * widthM;
}

// ==================== NORMAL BAKU (erf, CDF) =================================
// Aproksimasi Abramowitz & Stegun 7.1.26 (akurasi absolut ~1,5e-7).

export function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const t = 1 / (1 + p * ax);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-ax * ax);
  return sign * y;
}

/** CDF normal baku Phi(x). */
export function normalCdf(x: number): number {
  return 0.5 * (1 + erf(x / Math.SQRT2));
}

// ==================== FORMAT ANGKA (desimal koma, konvensi naskah) =========

export function idDecimal(v: number, dec?: number): string {
  return (dec !== undefined ? v.toFixed(dec) : String(v)).replace('.', ',');
}
