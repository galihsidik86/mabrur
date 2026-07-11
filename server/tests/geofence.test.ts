import { describe, it, expect } from 'vitest';

// Inline haversine for unit testing (same logic as service)
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

describe('haversine distance', () => {
  it('returns 0 for same point', () => {
    expect(haversine(21.4225, 39.8262, 21.4225, 39.8262)).toBe(0);
  });

  it('calculates Kaabah to Bir Ali (~332km)', () => {
    const d = haversine(21.4225, 39.8262, 24.4097, 39.5433);
    expect(d).toBeGreaterThan(320000);
    expect(d).toBeLessThan(340000);
  });

  it('calculates Kaabah to Qarnul Manazil (~75km)', () => {
    const d = haversine(21.4225, 39.8262, 21.6219, 40.4344);
    expect(d).toBeGreaterThan(60000);
    expect(d).toBeLessThan(80000);
  });

  it('detects within 3km warning zone', () => {
    // Point 2km from Bir Ali
    const birAliLat = 24.4097, birAliLng = 39.5433;
    const nearLat = birAliLat + 0.015; // ~1.7km north
    const d = haversine(nearLat, birAliLng, birAliLat, birAliLng);
    expect(d).toBeLessThan(3000);
    expect(d).toBeGreaterThan(1000);
  });

  it('detects outside warning zone', () => {
    const birAliLat = 24.4097, birAliLng = 39.5433;
    const farLat = birAliLat + 0.1; // ~11km north
    const d = haversine(farLat, birAliLng, birAliLat, birAliLng);
    expect(d).toBeGreaterThan(3000);
  });
});

describe('nearest miqat logic', () => {
  const miqats = [
    { name: 'Bir Ali', lat: 24.4097, lng: 39.5433 },
    { name: 'Qarnul Manazil', lat: 21.6219, lng: 40.4344 },
    { name: 'Yalamlam', lat: 20.5489, lng: 39.8733 },
  ];

  function findNearest(lat: number, lng: number) {
    let nearest = miqats[0];
    let minDist = Infinity;
    for (const m of miqats) {
      const d = haversine(lat, lng, m.lat, m.lng);
      if (d < minDist) { minDist = d; nearest = m; }
    }
    return { name: nearest.name, distance: minDist };
  }

  it('finds Bir Ali as nearest from Madinah area', () => {
    const result = findNearest(24.47, 39.61); // Madinah
    expect(result.name).toBe('Bir Ali');
  });

  it('finds Qarnul Manazil as nearest from Taif area', () => {
    const result = findNearest(21.27, 40.42); // near Taif
    expect(result.name).toBe('Qarnul Manazil');
  });

  it('finds Yalamlam as nearest from south', () => {
    const result = findNearest(20.2, 39.9); // south of Makkah
    expect(result.name).toBe('Yalamlam');
  });
});
