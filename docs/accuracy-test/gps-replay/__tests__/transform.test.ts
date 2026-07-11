import { describe, it, expect } from 'vitest';
import {
  toLocalENU, enuToLatLon, rigidTransform, principalBearing,
  smoothPath, extractResiduals, resampleResiduals, M_PER_DEG_LAT, mPerDegLon,
} from '../transform';
import type { TracePoint } from '../parser';

const pt = (t: number, lat: number, lon: number): TracePoint => ({ t, lat, lon, acc: null });

describe('toLocalENU / enuToLatLon', () => {
  it('titik awal menjadi (0,0)', () => {
    const { enu } = toLocalENU([pt(0, -6.5971, 106.7991), pt(3000, -6.5972, 106.7992)]);
    expect(enu[0].e).toBe(0);
    expect(enu[0].n).toBe(0);
  });

  it('1 km utara: n = 1000 m (error < 1 cm)', () => {
    const dLat = 1000 / M_PER_DEG_LAT;
    const { enu } = toLocalENU([pt(0, -6.5, 106.8), pt(1000, -6.5 + dLat, 106.8)]);
    expect(Math.abs(enu[1].n - 1000)).toBeLessThan(0.01);
    expect(Math.abs(enu[1].e)).toBeLessThan(0.01);
  });

  it('roundtrip ENU -> lat/lon pada anchor baru (error < 1 cm pada 1 km)', () => {
    const anchor = { lat: 21.42251, lng: 39.8262 }; // Ka'bah
    const back = enuToLatLon(1000, -500, anchor);
    // ubah kembali ke meter relatif anchor
    const e2 = (back.lng - anchor.lng) * mPerDegLon(anchor.lat);
    const n2 = (back.lat - anchor.lat) * M_PER_DEG_LAT;
    expect(Math.abs(e2 - 1000)).toBeLessThan(0.01);
    expect(Math.abs(n2 - -500)).toBeLessThan(0.01);
  });
});

describe('rigidTransform', () => {
  it('rotasi 90 derajat ccw memetakan (1,0) -> (0,1)', () => {
    const out = rigidTransform([{ t: 0, e: 1, n: 0, acc: null }], Math.PI / 2, 0, 0);
    expect(out[0].e).toBeCloseTo(0, 10);
    expect(out[0].n).toBeCloseTo(1, 10);
  });

  it('translasi + skala', () => {
    const out = rigidTransform([{ t: 0, e: 2, n: 3, acc: null }], 0, 10, 20, 2);
    expect(out[0].e).toBeCloseTo(14);
    expect(out[0].n).toBeCloseTo(26);
  });

  it('rigid murni mempertahankan jarak antar titik', () => {
    const pts = [{ t: 0, e: 0, n: 0, acc: null }, { t: 1, e: 3, n: 4, acc: null }];
    const out = rigidTransform(pts, 0.7, 100, -50);
    const d = Math.hypot(out[1].e - out[0].e, out[1].n - out[0].n);
    expect(d).toBeCloseTo(5, 10);
  });
});

describe('principalBearing', () => {
  it('lintasan ke timur = 0 rad; ke utara = pi/2', () => {
    const east = [{ t: 0, e: 0, n: 0, acc: null }, { t: 1, e: 10, n: 0, acc: null }];
    const north = [{ t: 0, e: 0, n: 0, acc: null }, { t: 1, e: 0, n: 10, acc: null }];
    expect(principalBearing(east)).toBeCloseTo(0);
    expect(principalBearing(north)).toBeCloseTo(Math.PI / 2);
  });
});

describe('smoothPath + extractResiduals', () => {
  it('garis lurus sempurna: residual nol', () => {
    const enu = Array.from({ length: 30 }, (_, i) => ({ t: i * 3000, e: i * 1.5, n: 0, acc: null }));
    const res = extractResiduals(enu, smoothPath(enu));
    for (const r of res) {
      expect(Math.abs(r.dE)).toBeLessThan(1e-9);
      expect(Math.abs(r.dN)).toBeLessThan(1e-9);
    }
  });

  it('deviasi tunggal di tengah terdistribusi ke residual (nilai puncak dikenali)', () => {
    const enu = Array.from({ length: 21 }, (_, i) => ({ t: i * 3000, e: i * 1.0, n: 0, acc: null }));
    enu[10] = { ...enu[10], n: 5 }; // satu outlier 5 m ke utara
    const res = extractResiduals(enu, smoothPath(enu, 11));
    // titik outlier harus punya residual dN terbesar dan positif
    const peak = res.reduce((a, b) => (Math.abs(b.dN) > Math.abs(a.dN) ? b : a));
    expect(peak.t).toBe(10 * 3000);
    expect(peak.dN).toBeGreaterThan(3); // 5 m dikurangi rata-rata jendela (5/11)
  });
});

describe('resampleResiduals', () => {
  it('grid 3 dtk dari data 1 dtk, interpolasi linier benar', () => {
    const res = Array.from({ length: 10 }, (_, i) => ({ t: i * 1000, dE: i * 1.0, dN: 0 }));
    const out = resampleResiduals(res, 3000);
    expect(out).toHaveLength(4); // t = 0, 3000, 6000, 9000
    expect(out[1].dE).toBeCloseTo(3);
    expect(out[3].dE).toBeCloseTo(9);
  });

  it('interpolasi di antara dua sampel', () => {
    const res = [{ t: 0, dE: 0, dN: 0 }, { t: 4000, dE: 4, dN: -4 }];
    const out = resampleResiduals(res, 3000);
    expect(out[1].dE).toBeCloseTo(3);
    expect(out[1].dN).toBeCloseTo(-3);
  });
});
