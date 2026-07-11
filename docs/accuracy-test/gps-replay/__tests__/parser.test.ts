import { describe, it, expect } from 'vitest';
import { parseGpx, parseCsv, parseTraceFile, splitSegments } from '../parser';

const GPX_OK = `<?xml version="1.0"?>
<gpx version="1.1" creator="GPS Logger">
 <trk><trkseg>
  <trkpt lat="-6.5971" lon="106.7991"><time>2026-07-10T06:00:00Z</time><extensions><accuracy>4.5</accuracy></extensions></trkpt>
  <trkpt lat="-6.5972" lon="106.7992"><time>2026-07-10T06:00:03Z</time><extensions><accuracy>5.1</accuracy></extensions></trkpt>
  <trkpt lat="-6.5973" lon="106.7993"><time>2026-07-10T06:00:06Z</time><extensions><accuracy>3.9</accuracy></extensions></trkpt>
 </trkseg></trk>
</gpx>`;

describe('parseGpx', () => {
  it('membaca titik, waktu, dan akurasi', () => {
    const r = parseGpx(GPX_OK);
    expect(r.points).toHaveLength(3);
    expect(r.points[0].lat).toBeCloseTo(-6.5971);
    expect(r.points[0].lon).toBeCloseTo(106.7991);
    expect(r.points[0].acc).toBeCloseTo(4.5);
    expect(r.accuracyAvailable).toBe(true);
    expect(r.accuracySource).toBe('accuracy');
    expect(r.points[1].t - r.points[0].t).toBe(3000);
  });

  it('mengurutkan waktu dan membuang duplikat timestamp', () => {
    const xml = `<gpx><trk><trkseg>
      <trkpt lat="1" lon="1"><time>2026-07-10T06:00:06Z</time></trkpt>
      <trkpt lat="2" lon="2"><time>2026-07-10T06:00:00Z</time></trkpt>
      <trkpt lat="3" lon="3"><time>2026-07-10T06:00:00Z</time></trkpt>
    </trkseg></trk></gpx>`;
    const r = parseGpx(xml);
    expect(r.points).toHaveLength(2);
    expect(r.points[0].lat).toBe(2); // kemunculan pertama dipertahankan
    expect(r.dropped.duplicate).toBe(1);
  });

  it('membuang titik tidak valid dan melaporkannya', () => {
    const xml = `<gpx><trk><trkseg>
      <trkpt lat="91" lon="1"><time>2026-07-10T06:00:00Z</time></trkpt>
      <trkpt lat="1" lon="1"><time>bukan-waktu</time></trkpt>
      <trkpt lat="1" lon="1"><time>2026-07-10T06:00:03Z</time></trkpt>
    </trkseg></trk></gpx>`;
    const r = parseGpx(xml);
    expect(r.points).toHaveLength(1);
    expect(r.dropped.invalid).toBe(2);
  });

  it('melaporkan loncatan waktu', () => {
    const xml = `<gpx><trk><trkseg>
      <trkpt lat="1" lon="1"><time>2026-07-10T06:00:00Z</time></trkpt>
      <trkpt lat="1" lon="1"><time>2026-07-10T06:00:03Z</time></trkpt>
      <trkpt lat="1" lon="1"><time>2026-07-10T06:02:00Z</time></trkpt>
    </trkseg></trk></gpx>`;
    const r = parseGpx(xml);
    expect(r.gaps).toHaveLength(1);
    expect(r.gaps[0].seconds).toBeCloseTo(117);
  });

  it('hdop menjadi fallback akurasi berlabel proksi', () => {
    const xml = `<gpx><trk><trkseg>
      <trkpt lat="1" lon="1"><time>2026-07-10T06:00:00Z</time><hdop>1.2</hdop></trkpt>
    </trkseg></trk></gpx>`;
    const r = parseGpx(xml);
    expect(r.points[0].acc).toBeCloseTo(1.2);
    expect(r.accuracySource).toBe('hdop');
  });

  it('tanpa akurasi: acc null, accuracyAvailable false', () => {
    const xml = `<gpx><trk><trkseg>
      <trkpt lat="1" lon="1"><time>2026-07-10T06:00:00Z</time></trkpt>
    </trkseg></trk></gpx>`;
    const r = parseGpx(xml);
    expect(r.points[0].acc).toBeNull();
    expect(r.accuracyAvailable).toBe(false);
  });

  it('menolak berkas yang bukan GPX / tanpa trkpt', () => {
    expect(() => parseGpx('<html></html>')).toThrow(/Bukan berkas GPX/);
    expect(() => parseGpx('<gpx></gpx>')).toThrow(/trkpt/);
  });
});

describe('parseCsv', () => {
  it('membaca header fleksibel + epoch detik', () => {
    const csv = 'timestamp,latitude,longitude,accuracy\n1780034400,-6.5971,106.7991,4.5\n1780034403,-6.5972,106.7992,5.0';
    const r = parseCsv(csv);
    expect(r.points).toHaveLength(2);
    expect(r.points[0].t).toBe(1780034400000); // detik -> ms
    expect(r.points[0].acc).toBeCloseTo(4.5);
  });

  it('membaca ISO time dan tanpa kolom akurasi', () => {
    const csv = 'time,lat,lng\n2026-07-10T06:00:00Z,-6.5971,106.7991';
    const r = parseCsv(csv);
    expect(r.points).toHaveLength(1);
    expect(r.points[0].acc).toBeNull();
    expect(r.accuracyAvailable).toBe(false);
  });

  it('menolak CSV tanpa kolom wajib', () => {
    expect(() => parseCsv('a,b,c\n1,2,3')).toThrow(/kolom wajib/);
  });
});

describe('parseTraceFile & splitSegments', () => {
  it('dispatch berdasarkan ekstensi; menolak format lain', () => {
    expect(parseTraceFile('x.gpx', GPX_OK).source).toBe('gpx');
    expect(() => parseTraceFile('x.kml', '')).toThrow(/tidak didukung/);
  });

  it('memecah segmen pada loncatan > 60 dtk', () => {
    const pts = [0, 3, 6, 120, 123].map((s) => ({ t: s * 1000, lat: 1, lon: 1, acc: null }));
    const segs = splitSegments(pts);
    expect(segs).toHaveLength(2);
    expect(segs[0]).toHaveLength(3);
    expect(segs[1]).toHaveLength(2);
  });
});
