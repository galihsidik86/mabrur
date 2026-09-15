import { describe, it, expect } from 'vitest';
import {
  SAFA, MARWAH, KAABAH, HAJAR_ASWAD, JAMARAT,
  ARAFAH_BOUNDARY, ARAFAH_CENTER, NAMIRAH_MOSQUE_CENTER,
  isPointInPolygon, checkArafahPosition, detectNearestJamarat,
  distanceMetersExport, SaiTracker,
} from '../../../../apps/mobile/src/services/sacred-zones-core';

// Tes koordinat OSM (revisi 2026-09-15) — lihat
// .orkestra/runs/20260915-1900-lanjutan-lokasi-pustaka-apk/handoffs/01-research-scout-koordinat.md
// untuk sumber & metodologi lengkap tiap titik. Dijalankan via `npm run test:replay`.

const M_PER_DEG_LAT = 111320;
const mPerDegLng = (lat: number) => M_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);

describe('Koordinat OSM 2026-09-15 — Safa & Marwah', () => {
  it('jarak Safa–Marwah ≈377 m (±2 m, titik puncak OSM node 4589923995/4589923996)', () => {
    const d = distanceMetersExport(SAFA.lat, SAFA.lng, MARWAH.lat, MARWAH.lng);
    expect(d).toBeGreaterThan(375);
    expect(d).toBeLessThan(379);
  });

  it("Safa > 80 m dari Ka'bah (di luar band tawaf 10–80 m — bukit Safa bukan bagian mataf)", () => {
    const d = distanceMetersExport(SAFA.lat, SAFA.lng, KAABAH.lat, KAABAH.lng);
    expect(d).toBeGreaterThan(80);
  });

  it("lintasan sa'i lurus Safa<->Marwah 7 leg penuh → SaiTracker menghitung 7", () => {
    const tracker = new SaiTracker();
    const steps = 60;
    for (let leg = 0; leg < 7; leg++) {
      const src = leg % 2 === 0 ? SAFA : MARWAH;
      const dst = leg % 2 === 0 ? MARWAH : SAFA;
      for (let s = 0; s <= steps; s++) {
        const f = s / steps;
        tracker.update(src.lat + (dst.lat - src.lat) * f, src.lng + (dst.lng - src.lng) * f);
      }
    }
    expect(tracker.getLegs()).toBe(7);
  });
});

describe('Koordinat OSM 2026-09-15 — Jamarat (node historic=monument)', () => {
  it('urutan bujur aqabah < wustha < ula (Aqabah paling barat = paling dekat Makkah)', () => {
    expect(JAMARAT.aqabah.lng).toBeLessThan(JAMARAT.wustha.lng);
    expect(JAMARAT.wustha.lng).toBeLessThan(JAMARAT.ula.lng);
  });

  it('jarak Ula–Wustha ≈153 m (±2 m)', () => {
    const d = distanceMetersExport(JAMARAT.ula.lat, JAMARAT.ula.lng, JAMARAT.wustha.lat, JAMARAT.wustha.lng);
    expect(d).toBeGreaterThan(151);
    expect(d).toBeLessThan(155);
  });

  it('jarak Wustha–Aqabah ≈236 m (±2 m)', () => {
    const d = distanceMetersExport(JAMARAT.wustha.lat, JAMARAT.wustha.lng, JAMARAT.aqabah.lat, JAMARAT.aqabah.lng);
    expect(d).toBeGreaterThan(234);
    expect(d).toBeLessThan(238);
  });

  it('titik 5 m dari tiap pilar terdeteksi sebagai pilar tsb (bukan pilar tetangga)', () => {
    for (const key of ['ula', 'wustha', 'aqabah'] as const) {
      const p = JAMARAT[key];
      const lat = p.lat + 5 / M_PER_DEG_LAT;
      const nearest = detectNearestJamarat(lat, p.lng);
      expect(nearest?.key).toBe(key);
    }
  });

  it('titik tepat di tengah dua pilar (Ula–Wustha) → null (di luar radius 30 m keduanya)', () => {
    const mid = {
      lat: (JAMARAT.ula.lat + JAMARAT.wustha.lat) / 2,
      lng: (JAMARAT.ula.lng + JAMARAT.wustha.lng) / 2,
    };
    expect(detectNearestJamarat(mid.lat, mid.lng)).toBeNull();
  });
});

describe("Koordinat OSM 2026-09-15 — Ka'bah & Hajar Aswad", () => {
  it('jarak centroid Ka\'bah ↔ sudut Hajar Aswad kecil & wajar untuk skala bangunan (5–10 m, bukan titik identik)', () => {
    // Nilai sebenarnya ≈6,6 m (haversine, node OSM 1199442721 vs centroid way
    // 103914569) — rentang 5–10 m dipakai sebagai sanity check "bukan titik
    // sama" & "wajar untuk skala Ka'bah" (~12x10 m), bukan target presisi.
    const d = distanceMetersExport(KAABAH.lat, KAABAH.lng, HAJAR_ASWAD.lat, HAJAR_ASWAD.lng);
    expect(d).toBeGreaterThan(5);
    expect(d).toBeLessThan(10);
  });
});

describe('Koordinat OSM 2026-09-15 — Arafah (poligon 36 titik, OSM way 1377422823)', () => {
  it('Jabal Rahmah (ARAFAH_CENTER) berada di dalam poligon', () => {
    expect(isPointInPolygon(ARAFAH_CENTER.lat, ARAFAH_CENTER.lng, ARAFAH_BOUNDARY)).toBe(true);
  });

  it('sisi barat/mihrab Masjid Namirah (Wadi Uranah) → DI LUAR Arafah', () => {
    const r = checkArafahPosition(21.3527898, 39.9643189);
    expect(r.status).toBe('outside');
  });

  it('sisi timur/belakang Masjid Namirah → DI DALAM Arafah + status peringatan Namirah', () => {
    const r = checkArafahPosition(21.3533099, 39.9684002);
    expect(r.status).toBe('namirah_danger');
  });

  it('titik 500 m di barat pusat Masjid Namirah → DI LUAR Arafah', () => {
    const lng = NAMIRAH_MOSQUE_CENTER.lng - 500 / mPerDegLng(NAMIRAH_MOSQUE_CENTER.lat);
    const r = checkArafahPosition(NAMIRAH_MOSQUE_CENTER.lat, lng);
    expect(r.status).toBe('outside');
  });

  it('titik di dalam & dekat tepi poligon LAIN (jauh dari Namirah) → DI DALAM tanpa peringatan Namirah', () => {
    // ~25 m dari tepi poligon dekat simpul timur laut, ~3,4 km dari Masjid
    // Namirah — membuktikan peringatan Namirah TIDAK dipicu oleh kedekatan
    // ke sembarang tepi poligon, hanya tepi yang dekat masjid (§NAMIRAH_*).
    const r = checkArafahPosition(21.377754844412504, 39.98507086262229);
    expect(r.status).toBe('inside');
  });

  it('poligon ARAFAH_BOUNDARY tidak self-intersecting', () => {
    const refLat = ARAFAH_BOUNDARY[0].lat;
    const toEN = (p: { lat: number; lng: number }) => ({
      e: p.lng * mPerDegLng(refLat), n: p.lat * M_PER_DEG_LAT,
    });
    const pts = ARAFAH_BOUNDARY.map(toEN);
    const n = pts.length;
    const ccw = (a: typeof pts[0], b: typeof pts[0], c: typeof pts[0]) =>
      (c.n - a.n) * (b.e - a.e) - (b.n - a.n) * (c.e - a.e);
    const segIntersect = (p1: typeof pts[0], p2: typeof pts[0], p3: typeof pts[0], p4: typeof pts[0]) => {
      const d1 = ccw(p3, p4, p1), d2 = ccw(p3, p4, p2), d3 = ccw(p1, p2, p3), d4 = ccw(p1, p2, p4);
      return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
    };
    let intersections = 0;
    for (let i = 0; i < n; i++) {
      const a1 = pts[i], a2 = pts[(i + 1) % n];
      for (let j = i + 1; j < n; j++) {
        if ((j + 1) % n === i || (i + 1) % n === j) continue; // lewati sisi bertetangga (berbagi simpul)
        const b1 = pts[j], b2 = pts[(j + 1) % n];
        if (segIntersect(a1, a2, b1, b2)) intersections++;
      }
    }
    expect(intersections).toBe(0);
  });
});
