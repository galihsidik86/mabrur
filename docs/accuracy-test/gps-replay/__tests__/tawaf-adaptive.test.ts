import { describe, it, expect } from 'vitest';
import { TawafTracker, KAABAH } from '../../../../apps/mobile/src/services/sacred-zones-core';
import { pressureToAltitude, altitudeToFloor } from '../../../../apps/mobile/src/services/floor-core';

const M_PER_DEG_LAT = 111320;
const mPerDegLng = (lat: number) => M_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);

// Lintasan melingkar metrik r meter mengelilingi Ka'bah, 7 putaran, sampling 3 dtk.
// startBeta 271.8° = offset setengah-langkah (hindari sampel tepat di angle 0),
// sama seperti harness run.ts.
function circlePath(r: number): Array<{ lat: number; lng: number; t: number }> {
  const stepsPerLap = 100, total = 7 * stepsPerLap, startBeta = 271.8;
  const pts: Array<{ lat: number; lng: number; t: number }> = [];
  for (let s = 0; s < total; s++) {
    const beta = ((startBeta + s * (360 / stepsPerLap)) * Math.PI) / 180;
    const dN = r * Math.cos(beta), dE = r * Math.sin(beta);
    pts.push({
      lat: KAABAH.lat + dN / M_PER_DEG_LAT,
      lng: KAABAH.lng + dE / mPerDegLng(KAABAH.lat),
      t: s * 3000,
    });
  }
  return pts;
}

function run(tracker: TawafTracker, path: Array<{ lat: number; lng: number; t: number }>) {
  for (const p of path) tracker.update(p.lat, p.lng, p.t);
  return tracker.getRounds();
}

describe('TawafTracker — kompatibilitas mundur (default = perilaku jurnal)', () => {
  it('default: radius 25 m (lantai dasar) → 7 putaran', () => {
    expect(run(new TawafTracker(), circlePath(25))).toBe(7);
  });

  it('default: radius 120 m (lantai atas) → 0 (di luar band 10–80 m)', () => {
    expect(run(new TawafTracker(), circlePath(120))).toBe(0);
  });
});

describe('TawafTracker — mode adaptif (multi-lantai)', () => {
  it('adaptif: radius 25 m tetap 7 (tanpa regresi lantai dasar)', () => {
    expect(run(new TawafTracker({ adaptive: true }), circlePath(25))).toBe(7);
  });

  it('adaptif: radius 120 m (lantai 1) → 7 putaran', () => {
    expect(run(new TawafTracker({ adaptive: true }), circlePath(120))).toBe(7);
  });

  it('adaptif: radius 200 m (atap) → 7 putaran', () => {
    expect(run(new TawafTracker({ adaptive: true }), circlePath(200))).toBe(7);
  });

  it('adaptif: berjalan LURUS menyeberang dekat Ka\'bah → tidak dihitung (bukan mengedar)', () => {
    // garis lurus dari barat ke timur melewati sisi utara Ka'bah pada jarak ~40 m,
    // radius ke Ka'bah berubah drastis (jauh→dekat→jauh) → tidak stabil.
    const tracker = new TawafTracker({ adaptive: true });
    const pts: Array<{ lat: number; lng: number; t: number }> = [];
    for (let i = 0; i < 120; i++) {
      const east = -200 + i * 4; // -200..276 m arah timur
      const north = 40;          // tetap 40 m di utara
      pts.push({
        lat: KAABAH.lat + north / M_PER_DEG_LAT,
        lng: KAABAH.lng + east / mPerDegLng(KAABAH.lat),
        t: i * 3000,
      });
    }
    expect(run(tracker, pts)).toBe(0);
  });

  it('getRadius() melaporkan radius edar terestimasi (~120 m)', () => {
    const t = new TawafTracker({ adaptive: true });
    run(t, circlePath(120));
    expect(t.getRadius()).toBeGreaterThan(110);
    expect(t.getRadius()).toBeLessThan(130);
  });
});

describe('floor-core — barometer', () => {
  it('tekanan sama dengan acuan → ketinggian 0', () => {
    expect(pressureToAltitude(1000, 1000)).toBeCloseTo(0, 5);
  });

  it('turun ~1 hPa dari 1013 → naik ~8,3 m', () => {
    const alt = pressureToAltitude(1012, 1013);
    expect(alt).toBeGreaterThan(7);
    expect(alt).toBeLessThan(9);
  });

  it('altitudeToFloor: memetakan ketinggian ke lantai', () => {
    expect(altitudeToFloor(0).floor).toBe(0);
    expect(altitudeToFloor(0).label).toMatch(/dasar/i);
    expect(altitudeToFloor(5.5).floor).toBe(1);
    expect(altitudeToFloor(11).floor).toBe(2);
    expect(altitudeToFloor(17).label).toMatch(/atap/i);
  });
});
