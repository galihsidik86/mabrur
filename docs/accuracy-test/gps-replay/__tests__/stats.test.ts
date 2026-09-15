import { describe, it, expect } from 'vitest';
import {
  wilson95, makeAR1, gaussMarkovRho, expScaledI0, ricePdf, riceCdf, simpson,
  polygonPerimeterMeters, boxAreaM2, normalCdf,
} from '../../stats';

// PRNG mulberry32 lokal (identik dgn run.ts) + Box-Muller, dipakai HANYA di tes
// untuk menghasilkan gaussFn deterministik bagi makeAR1.
function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function makeGauss(seed: number): () => number {
  const rng = mulberry32(seed);
  return () => {
    let u = 0, v = 0;
    while (u === 0) u = rng();
    while (v === 0) v = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
}

describe('wilson95', () => {
  it('interval mengandung phat dan berada dalam [0,1]', () => {
    const ci = wilson95(72, 100);
    expect(ci.lo).toBeGreaterThanOrEqual(0);
    expect(ci.hi).toBeLessThanOrEqual(1);
    expect(ci.lo).toBeLessThan(0.72);
    expect(ci.hi).toBeGreaterThan(0.72);
  });

  it('n=0 -> [0,0] (tidak crash)', () => {
    expect(wilson95(0, 0)).toEqual({ lo: 0, hi: 0 });
  });

  it('0 sukses dari 100 -> batas atas mendekati 3,6% (dikenal luas, bukan 0)', () => {
    const ci = wilson95(0, 100);
    expect(ci.lo).toBe(0);
    expect(ci.hi).toBeGreaterThan(0.02);
    expect(ci.hi).toBeLessThan(0.05);
  });

  it('100 sukses dari 100 -> batas bawah < 1 (bukan degenerate)', () => {
    const ci = wilson95(100, 100);
    expect(ci.hi).toBe(1);
    expect(ci.lo).toBeGreaterThan(0.95);
    expect(ci.lo).toBeLessThan(1);
  });

  it('interval menyempit seiring n membesar (p tetap)', () => {
    const small = wilson95(72, 100);
    const large = wilson95(7200, 10000);
    expect(large.hi - large.lo).toBeLessThan(small.hi - small.lo);
  });
});

describe('makeAR1', () => {
  it('varians stasioner ~ sigma^2 dan korelasi-lag1 ~ rho (10.000 sampel, toleransi longgar)', () => {
    const sigma = 3, rho = 0.6;
    const next = makeAR1(rho, sigma, makeGauss(7));
    const xs: number[] = [];
    for (let i = 0; i < 10000; i++) xs.push(next());
    const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
    const variance = xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length;
    let cov = 0;
    for (let i = 1; i < xs.length; i++) cov += (xs[i] - mean) * (xs[i - 1] - mean);
    cov /= xs.length - 1;
    const empRho = cov / variance;
    expect(Math.sqrt(variance)).toBeGreaterThan(sigma * 0.9);
    expect(Math.sqrt(variance)).toBeLessThan(sigma * 1.1);
    expect(empRho).toBeGreaterThan(rho - 0.1);
    expect(empRho).toBeLessThan(rho + 0.1);
  });

  it('rho=0 -> setara iid (tanpa korelasi lag-1 signifikan)', () => {
    const next = makeAR1(0, 2, makeGauss(11));
    const xs: number[] = [];
    for (let i = 0; i < 5000; i++) xs.push(next());
    const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
    let cov = 0, variance = 0;
    for (const x of xs) variance += (x - mean) ** 2;
    variance /= xs.length;
    for (let i = 1; i < xs.length; i++) cov += (xs[i] - mean) * (xs[i - 1] - mean);
    cov /= xs.length - 1;
    expect(Math.abs(cov / variance)).toBeLessThan(0.08);
  });
});

describe('gaussMarkovRho', () => {
  it('rho = exp(-dt/tau)', () => {
    expect(gaussMarkovRho(3, 30)).toBeCloseTo(Math.exp(-0.1), 10);
    expect(gaussMarkovRho(0, 30)).toBeCloseTo(1, 10);
  });
});

describe('expScaledI0', () => {
  it('x=0 -> exp(0)*I0(0) = 1', () => {
    expect(expScaledI0(0)).toBeCloseTo(1, 5);
  });

  it('kontinu di batas seri/asimtotik x=3.75 (selisih kecil)', () => {
    const below = expScaledI0(3.7499);
    const above = expScaledI0(3.7501);
    expect(Math.abs(below - above)).toBeLessThan(1e-5);
  });
});

describe('riceCdf', () => {
  it('nu=0 tereduksi ke CDF Rayleigh: 1 - exp(-r^2/(2 sigma^2))', () => {
    const sigma = 5;
    for (const r of [2, 5, 10, 20]) {
      const rayleigh = 1 - Math.exp(-(r * r) / (2 * sigma * sigma));
      expect(riceCdf(r, 0, sigma)).toBeCloseTo(rayleigh, 3);
    }
  });

  it('monoton naik dan mendekati 1 untuk r besar', () => {
    const sigma = 4, nu = 10;
    const c1 = riceCdf(15, nu, sigma);
    const c2 = riceCdf(30, nu, sigma);
    const c3 = riceCdf(80, nu, sigma);
    expect(c2).toBeGreaterThan(c1);
    expect(c3).toBeGreaterThanOrEqual(c2);
    expect(c3).toBeCloseTo(1, 2);
  });

  it('nu besar relatif sigma -> massa terkonsentrasi dekat r=nu (mendekati normal)', () => {
    const nu = 50, sigma = 2;
    const cdfBelow = riceCdf(nu - 3 * sigma, nu, sigma);
    const cdfAbove = riceCdf(nu + 3 * sigma, nu, sigma);
    expect(cdfBelow).toBeLessThan(0.02);
    expect(cdfAbove).toBeGreaterThan(0.98);
  });
});

describe('simpson', () => {
  it('integral x^2 dari 0..3 = 9 (eksak utk polinomial derajat<=3)', () => {
    expect(simpson((x) => x * x, 0, 3, 100)).toBeCloseTo(9, 6);
  });
});

describe('normalCdf', () => {
  it('nilai baku: Phi(0)=0,5; Phi(1,96)≈0,975; Phi(2,326)≈0,99; Phi(-2,326)≈0,01', () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 6);
    expect(normalCdf(1.959963985)).toBeCloseTo(0.975, 4);
    expect(normalCdf(2.326348)).toBeCloseTo(0.99, 4);
    expect(normalCdf(-2.326348)).toBeCloseTo(0.01, 4);
  });
});

describe('geometri bantuan', () => {
  it('polygonPerimeterMeters: bujur sangkar sisi 10 (metrik Euclidean planar) -> keliling 40', () => {
    const square = [
      { lat: 0, lng: 0 }, { lat: 0, lng: 10 }, { lat: 10, lng: 10 }, { lat: 10, lng: 0 },
    ];
    const euclid = (lat1: number, lng1: number, lat2: number, lng2: number) =>
      Math.sqrt((lat2 - lat1) ** 2 + (lng2 - lng1) ** 2);
    expect(polygonPerimeterMeters(square, euclid)).toBeCloseTo(40, 6);
  });

  it('boxAreaM2: kotak 2x3 derajat @ 1 m/derajat -> luas 6 m^2', () => {
    const area = boxAreaM2(0, 2, 0, 3, 1, () => 1);
    expect(area).toBeCloseTo(6, 6);
  });
});
