/*
 * Generator 3 fixture GPX sintetis DEMO (deterministik, seed tetap).
 * HASIL DARI FIXTURE INI TIDAK BOLEH DIKUTIP NASKAH — hanya untuk menguji
 * pipeline end-to-end sebelum log GPS riil tersedia di field_logs/.
 *
 *   npx tsx docs/accuracy-test/gps-replay/fixtures/make-fixtures.ts
 *
 * Skenario (meniru rencana perekaman riil):
 *   demo-a-lapangan-terbuka : jalan lurus ~300 m, derau kecil hampir putih
 *   demo-b-urban-canyon     : derau besar AR(1) kuat + lonjakan multipath
 *   demo-c-bolak-balik      : 7 lintasan bolak-balik lurus 400 m (proxy sa'i)
 */
import { writeFileSync } from 'fs';
import { join } from 'path';

const SEED = 271828;
const BASE_LAT = -6.5971, BASE_LON = 106.7991; // sekitar Bogor (lokasi perekaman riil kelak)
const BASE_TIME = Date.parse('2026-07-10T06:00:00Z');
const M_PER_DEG_LAT = 111320;
const mPerDegLon = (lat: number) => M_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);

function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
let rng = mulberry32(SEED);
function gauss(): number {
  let u = 0, v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

interface Sample { e: number; n: number; acc: number; }

/** Deret derau AR(1): x_t = rho*x_{t-1} + sqrt(1-rho^2)*sigma*w_t */
function ar1Series(len: number, sigma: number, rho: number): number[] {
  const out: number[] = [0];
  const k = Math.sqrt(1 - rho * rho);
  for (let i = 1; i < len; i++) out.push(rho * out[i - 1] + k * sigma * gauss());
  return out;
}

function toGpx(name: string, samples: Sample[]): string {
  const kLon = mPerDegLon(BASE_LAT);
  const pts = samples.map((s, i) => {
    const lat = (BASE_LAT + s.n / M_PER_DEG_LAT).toFixed(7);
    const lon = (BASE_LON + s.e / kLon).toFixed(7);
    const time = new Date(BASE_TIME + i * 1000).toISOString();
    return `  <trkpt lat="${lat}" lon="${lon}"><time>${time}</time><extensions><accuracy>${s.acc.toFixed(1)}</accuracy></extensions></trkpt>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="MABRUR-DEMO-FIXTURE (SINTETIS — BUKAN DATA LAPANGAN)">\n <trk><name>${name}</name><trkseg>\n${pts.join('\n')}\n </trkseg></trk>\n</gpx>\n`;
}

// --- A: lapangan terbuka — lurus 300 m @1,4 m/s, sigma 3 m, rho 0,3 ---
function makeA(): Sample[] {
  const dur = Math.round(300 / 1.4);
  const nzE = ar1Series(dur, 3, 0.3), nzN = ar1Series(dur, 3, 0.3);
  return Array.from({ length: dur }, (_, i) => ({
    e: i * 1.4 + nzE[i],
    n: nzN[i],
    acc: 4 + Math.abs(gauss()) * 1.5,
  }));
}

// --- B: urban canyon — jalur L 250 m @1,2 m/s, sigma 8 m, rho 0,85, 5% lonjakan multipath ---
function makeB(): Sample[] {
  const dur = Math.round(250 / 1.2);
  const nzE = ar1Series(dur, 8, 0.85), nzN = ar1Series(dur, 8, 0.85);
  return Array.from({ length: dur }, (_, i) => {
    const along = i * 1.2;
    const e = along < 150 ? along : 150;
    const n = along < 150 ? 0 : along - 150;
    const jump = rng() < 0.05 ? 15 * (rng() < 0.5 ? 1 : -1) : 0; // pantulan dinding
    return { e: e + nzE[i] + jump, n: n + nzN[i], acc: 12 + Math.abs(gauss()) * 5 };
  });
}

// --- C: bolak-balik lurus 400 m x 7 leg @1,3 m/s, sigma 4 m, rho 0,5 (proxy sa'i) ---
function makeC(): Sample[] {
  const legTime = Math.round(400 / 1.3);
  const dur = legTime * 7;
  const nzE = ar1Series(dur, 4, 0.5), nzN = ar1Series(dur, 4, 0.5);
  return Array.from({ length: dur }, (_, i) => {
    const leg = Math.floor(i / legTime);
    const f = (i % legTime) / legTime;
    const along = leg % 2 === 0 ? f * 400 : (1 - f) * 400;
    return { e: along + nzE[i], n: nzN[i], acc: 5 + Math.abs(gauss()) * 2 };
  });
}

const out = (f: string, s: string) => {
  writeFileSync(join(__dirname, f), s);
  console.log(`${f}: ${s.split('\n').length} baris`);
};
rng = mulberry32(SEED);
out('demo-a-lapangan-terbuka.gpx', toGpx('DEMO A — lapangan terbuka (sintetis)', makeA()));
out('demo-b-urban-canyon.gpx', toGpx('DEMO B — urban canyon (sintetis)', makeB()));
out('demo-c-bolak-balik.gpx', toGpx('DEMO C — bolak-balik 400 m (sintetis, proxy sa\'i)', makeC()));
