/*
 * Parser trace GPS: GPX (track points) dan CSV.
 * Keluaran: TracePoint[] terurut waktu, tervalidasi, bebas duplikat timestamp.
 * Tanpa dependensi eksternal — GPX dari aplikasi perekam (GPS Logger dkk.)
 * berstruktur sederhana sehingga cukup diparse per blok <trkpt>.
 */

export interface TracePoint {
  t: number;          // epoch ms
  lat: number;
  lon: number;
  acc: number | null; // akurasi horizontal (m) bila tersedia
}

export interface ParseReport {
  points: TracePoint[];
  source: 'gpx' | 'csv';
  dropped: { invalid: number; duplicate: number };
  gaps: Array<{ index: number; seconds: number }>; // loncatan waktu > GAP_WARN_S
  accuracyAvailable: boolean;
  accuracySource: 'accuracy' | 'hdop' | null; // hdop = proksi, bukan meter sejati
}

const GAP_WARN_S = 10;   // loncatan yang dilaporkan
export const GAP_SPLIT_S = 60; // ambang pecah segmen (dipakai pemanggil)

function isValidLat(v: number) { return Number.isFinite(v) && v >= -90 && v <= 90; }
function isValidLon(v: number) { return Number.isFinite(v) && v >= -180 && v <= 180; }

function finalize(raw: TracePoint[], source: 'gpx' | 'csv', invalid: number,
                  accSource: 'accuracy' | 'hdop' | null): ParseReport {
  // urutkan waktu, buang duplikat timestamp (pertahankan kemunculan pertama)
  raw.sort((a, b) => a.t - b.t);
  const points: TracePoint[] = [];
  let duplicate = 0;
  for (const p of raw) {
    if (points.length > 0 && p.t === points[points.length - 1].t) { duplicate++; continue; }
    points.push(p);
  }
  const gaps: ParseReport['gaps'] = [];
  for (let i = 1; i < points.length; i++) {
    const dt = (points[i].t - points[i - 1].t) / 1000;
    if (dt > GAP_WARN_S) gaps.push({ index: i, seconds: +dt.toFixed(1) });
  }
  return {
    points, source,
    dropped: { invalid, duplicate },
    gaps,
    accuracyAvailable: points.some((p) => p.acc !== null),
    accuracySource: accSource,
  };
}

// ==================== GPX ====================

export function parseGpx(xml: string): ParseReport {
  if (!/<gpx[\s>]/i.test(xml)) throw new Error('Bukan berkas GPX: tag <gpx> tidak ditemukan');
  const blocks = xml.match(/<trkpt\b[\s\S]*?<\/trkpt>/gi) ?? [];
  if (blocks.length === 0) throw new Error('GPX tidak memuat <trkpt> sama sekali');

  const raw: TracePoint[] = [];
  let invalid = 0;
  let accSource: 'accuracy' | 'hdop' | null = null;

  for (const b of blocks) {
    const lat = parseFloat(b.match(/\blat="([^"]+)"/)?.[1] ?? 'NaN');
    const lon = parseFloat(b.match(/\blon="([^"]+)"/)?.[1] ?? 'NaN');
    const timeStr = b.match(/<time>([^<]+)<\/time>/)?.[1];
    const t = timeStr ? Date.parse(timeStr) : NaN;

    // akurasi: tag <accuracy> (GPS Logger) atau ekstensi gpxtpx; fallback <hdop> (proksi)
    let acc: number | null = null;
    const accStr = b.match(/<(?:[a-z0-9]+:)?accuracy>([^<]+)<\/(?:[a-z0-9]+:)?accuracy>/i)?.[1];
    if (accStr !== undefined) {
      acc = parseFloat(accStr);
      accSource = accSource ?? 'accuracy';
    } else {
      const hdopStr = b.match(/<hdop>([^<]+)<\/hdop>/i)?.[1];
      if (hdopStr !== undefined) {
        acc = parseFloat(hdopStr);
        accSource = accSource ?? 'hdop';
      }
    }
    if (acc !== null && !Number.isFinite(acc)) acc = null;

    if (!isValidLat(lat) || !isValidLon(lon) || !Number.isFinite(t)) { invalid++; continue; }
    raw.push({ t, lat, lon, acc });
  }
  if (raw.length === 0) throw new Error('GPX: seluruh titik tidak valid (lat/lon/time)');
  return finalize(raw, 'gpx', invalid, accSource);
}

// ==================== CSV ====================
// Header fleksibel: time|timestamp|datetime, lat|latitude, lon|lng|longitude,
// acc|accuracy|hacc. Timestamp: ISO-8601 atau epoch (detik/milidetik).

const HEADER_ALIASES: Record<string, string[]> = {
  time: ['time', 'timestamp', 'datetime', 'date time'],
  lat: ['lat', 'latitude'],
  lon: ['lon', 'lng', 'longitude'],
  acc: ['acc', 'accuracy', 'hacc', 'horizontal accuracy', 'accuracy(m)'],
};

function parseTimestamp(s: string): number {
  const trimmed = s.trim().replace(/^"|"$/g, '');
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    const n = parseFloat(trimmed);
    return n > 1e12 ? n : n * 1000; // epoch ms vs epoch s
  }
  return Date.parse(trimmed);
}

export function parseCsv(text: string): ParseReport {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '');
  if (lines.length < 2) throw new Error('CSV: butuh header + minimal 1 baris data');

  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, '').toLowerCase());
  const col: Record<string, number> = {};
  for (const [key, aliases] of Object.entries(HEADER_ALIASES)) {
    const idx = headers.findIndex((h) => aliases.includes(h));
    if (idx >= 0) col[key] = idx;
  }
  if (col.time === undefined || col.lat === undefined || col.lon === undefined) {
    throw new Error(`CSV: kolom wajib tidak ditemukan (butuh time/lat/lon; header: ${headers.join(', ')})`);
  }

  const raw: TracePoint[] = [];
  let invalid = 0;
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(',');
    const t = parseTimestamp(cells[col.time] ?? '');
    const lat = parseFloat(cells[col.lat] ?? 'NaN');
    const lon = parseFloat(cells[col.lon] ?? 'NaN');
    let acc: number | null = null;
    if (col.acc !== undefined) {
      const a = parseFloat(cells[col.acc] ?? 'NaN');
      acc = Number.isFinite(a) ? a : null;
    }
    if (!isValidLat(lat) || !isValidLon(lon) || !Number.isFinite(t)) { invalid++; continue; }
    raw.push({ t, lat, lon, acc });
  }
  if (raw.length === 0) throw new Error('CSV: seluruh baris tidak valid');
  return finalize(raw, 'csv', invalid, col.acc !== undefined ? 'accuracy' : null);
}

// ==================== DISPATCH ====================

export function parseTraceFile(filename: string, content: string): ParseReport {
  if (/\.gpx$/i.test(filename)) return parseGpx(content);
  if (/\.csv$/i.test(filename)) return parseCsv(content);
  throw new Error(`Format tidak didukung: ${filename} (hanya .gpx / .csv)`);
}

/** Pecah menjadi segmen kontinu pada loncatan waktu > GAP_SPLIT_S. */
export function splitSegments(points: TracePoint[], maxGapS: number = GAP_SPLIT_S): TracePoint[][] {
  if (points.length === 0) return [];
  const segments: TracePoint[][] = [[points[0]]];
  for (let i = 1; i < points.length; i++) {
    if ((points[i].t - points[i - 1].t) / 1000 > maxGapS) segments.push([]);
    segments[segments.length - 1].push(points[i]);
  }
  return segments;
}
