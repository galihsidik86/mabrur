/*
 * =============================================================================
 *  MABRUR — Pengujian Akurasi Algoritma Geospasial (berbasis simulasi)
 * =============================================================================
 *  Menguji 6 algoritma inti terhadap injeksi noise GPS Gaussian (sigma = 0,1,3,5,10,15 m):
 *    1. Haversine        vs Vincenty (elipsoid WGS-84)   -> MAE, RMSE, error %
 *    2. Geofence Miqat   (point-in-circle)               -> confusion matrix, F1
 *    3. Deteksi Arafah   (ray-casting polygon)            -> confusion matrix, F1
 *    4. Penghitung Tawaf (sudut kumulatif ter-unwrap CCW) -> akurasi hitung + CI + pemicuan dini
 *    5. Penghitung Sa'i  (zone alternation)               -> akurasi hitung
 *    6. Deteksi Jamarat  (nearest-in-radius, 3 kelas)     -> confusion matrix
 *
 *  R10 (2026-09-14): koordinat sakral & algoritma murni diimpor LANGSUNG dari
 *  apps/mobile/src/services/sacred-zones-core.ts via docs/accuracy-test/sim-core.ts
 *  (lihat catatan lengkap "TIDAK diimpor" di sim-core.ts untuk haversine & MIQAT).
 *  Sebelum revisi ini seluruh algoritma DISALIN verbatim — kini hanya haversine
 *  (blocked oleh dependensi expo-location di location.ts) dan MIQAT (cermin
 *  seed server, bukan bagian sacred-zones-core.ts) yang tetap berupa salinan.
 *
 *  Eksperimen tambahan (R4/R5/R6/R8/R9, naskah revisi 2026-09-14) ada di
 *  docs/accuracy-test/experiments/*.ts, diorkestrasi dari file ini.
 *
 *  Reproducible: RNG mulberry32 ber-seed. Jalankan: npx tsx docs/accuracy-test/run.ts
 * =============================================================================
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import {
  createRng, addNoiseIid, haversine, vincenty, M_PER_DEG_LAT, mPerDegLng,
  MIQAT, binMetrics, pct, Bin,
  KAABAH, SAFA, MARWAH, ARAFAH_BOUNDARY, JAMARAT,
  isPointInPolygon, TawafTracker, SaiTracker, detectNearestJamarat,
} from './sim-core';
import { wilson95, idDecimal } from './stats';
import { runTawafScenarios } from './experiments/tawaf-scenarios';
import { runSaiScenarios } from './experiments/sai-scenarios';
import { runNoiseModels } from './experiments/noise-models';
import { runAnalyticChecks } from './experiments/analytic';

const OUT_DIR = join(__dirname, 'results');
mkdirSync(OUT_DIR, { recursive: true });

const SEED = 42;
const SIGMAS = [0, 1, 3, 5, 10, 15]; // meter, std dev per sumbu (East/North)
const TRIALS = 300;

const R = createRng(SEED);
const gauss = () => R.gauss();
const addNoise = (lat: number, lng: number, sigma: number) => addNoiseIid(lat, lng, sigma, gauss);
type JamKey = 'ula' | 'wustha' | 'aqabah';

// Akumulator hasil terstruktur -> results/monte_carlo_results.json
// (pengisian murni aditif; tidak menambah/menggeser panggilan rng() apa pun)
const J: {
  meta: Record<string, unknown>;
  geometry: Record<string, number>;
  haversine: Record<string, { mae: number; rmse: number; meanPct: number; maxPct: number }>;
  miqat: Array<Record<string, number>>;
  arafah: Array<Record<string, number>>;
  tawaf: Array<Record<string, number>>;
  sai: Array<Record<string, number>>;
  jamarat: Array<Record<string, number>>;
  jamarat_confusion_sigma15: Record<string, Record<string, number>>;
  tawaf_histogram: Record<string, Record<string, number>>;
  tawaf_early_trigger: Array<Record<string, number>>;
} = {
  meta: {
    seed: SEED,
    prng: 'mulberry32',
    sigmas_m: SIGMAS,
    samples: {
      haversine_per_skenario: 5000, miqat_per_sigma: 8000, arafah_per_sigma: 12000,
      tawaf_trials_per_sigma: TRIALS, sai_trials_per_sigma: TRIALS, jamarat_per_kelas_per_sigma: 4000,
    },
  },
  geometry: {}, haversine: {}, miqat: [], arafah: [], tawaf: [], sai: [],
  jamarat: [], jamarat_confusion_sigma15: {}, tawaf_histogram: {}, tawaf_early_trigger: [],
};

// ==================== OUTPUT BUILDER ========================================

const lines: string[] = [];
function w(s = '') { lines.push(s); console.log(s); }

w('# Hasil Pengujian Akurasi Algoritma Geospasial — Sistem Mabrur');
w('');
w(`> Simulasi Monte Carlo, RNG mulberry32 ber-seed (seed=${SEED}) — hasil reproducible.`);
w(`> Model noise GPS: Gaussian isotropik, sigma per sumbu (East/North) = {${SIGMAS.join(', ')}} m.`);
w(`> sigma=0 = baseline tanpa noise (verifikasi kebenaran algoritma).`);
w('');

// ============ GEOMETRI DASAR (untuk paper) ==================================
w('## 0. Karakteristik Geometri (konteks)');
w('');
const dSafaMarwah = haversine(SAFA.lat, SAFA.lng, MARWAH.lat, MARWAH.lng);
const dUW = haversine(JAMARAT.ula.lat, JAMARAT.ula.lng, JAMARAT.wustha.lat, JAMARAT.wustha.lng);
const dWA = haversine(JAMARAT.wustha.lat, JAMARAT.wustha.lng, JAMARAT.aqabah.lat, JAMARAT.aqabah.lng);
const dUA = haversine(JAMARAT.ula.lat, JAMARAT.ula.lng, JAMARAT.aqabah.lat, JAMARAT.aqabah.lng);
J.geometry = {
  safa_marwah_m: +dSafaMarwah.toFixed(1),
  jamarat_ula_wustha_m: +dUW.toFixed(1),
  jamarat_wustha_aqabah_m: +dWA.toFixed(1),
  jamarat_ula_aqabah_m: +dUA.toFixed(1),
};
w('| Besaran | Nilai |');
w('|---|---|');
w(`| Jarak Safa–Marwah | ${dSafaMarwah.toFixed(1)} m |`);
w(`| Jarak Jamarat Ula–Wustha | ${dUW.toFixed(1)} m |`);
w(`| Jarak Jamarat Wustha–Aqabah | ${dWA.toFixed(1)} m |`);
w(`| Jarak Jamarat Ula–Aqabah | ${dUA.toFixed(1)} m |`);
w(`| Radius deteksi Jamarat | 30 m (2×radius=60 m < jarak pilar terdekat 68 m → tidak tumpang tindih) |`);
w(`| Radius zona Sa'i (Safa/Marwah) | 25 m |`);
w(`| Band radius Tawaf (default) | 10–80 m dari Ka'bah |`);
w('');

// ============ 1. HAVERSINE vs VINCENTY ======================================
w('## 1. Akurasi Haversine vs Vincenty (elipsoid WGS-84)');
w('');
R.reset(1);
function haversineTest(label: string, gen: () => [number, number, number, number], n: number) {
  let sumErr = 0, sumSq = 0, maxPct = 0, sumPct = 0, cnt = 0;
  for (let i = 0; i < n; i++) {
    const [la1, lo1, la2, lo2] = gen();
    const ref = vincenty(la1, lo1, la2, lo2);
    if (ref < 1) continue;
    const hav = haversine(la1, lo1, la2, lo2);
    const err = Math.abs(hav - ref);
    const p = (err / ref) * 100;
    sumErr += err; sumSq += err * err; sumPct += p; maxPct = Math.max(maxPct, p); cnt++;
  }
  const mae = sumErr / cnt, rmse = Math.sqrt(sumSq / cnt), meanPct = sumPct / cnt;
  w(`| ${label} | ${mae.toFixed(3)} | ${rmse.toFixed(3)} | ${meanPct.toFixed(4)} | ${maxPct.toFixed(4)} |`);
  return { mae, rmse, meanPct, maxPct };
}
w('| Skenario jarak | MAE (m) | RMSE (m) | Error rata2 (%) | Error maks (%) |');
w('|---|---|---|---|---|');
// (a) skala tawaf/sai: <500 m di sekitar Masjidil Haram
const havLokal = haversineTest('Lokal Masjidil Haram (0–0,5 km)', () => {
  const la1 = 21.42 + (R.next() - 0.5) * 0.01, lo1 = 39.826 + (R.next() - 0.5) * 0.01;
  const la2 = la1 + (R.next() - 0.5) * 0.008, lo2 = lo1 + (R.next() - 0.5) * 0.008;
  return [la1, lo1, la2, lo2];
}, 5000);
// (b) skala miqat
const havMiqat = haversineTest('Skala Miqat (10–450 km)', () => {
  const la1 = 21 + R.next() * 4, lo1 = 39 + R.next() * 2;
  const la2 = 21 + R.next() * 4, lo2 = 39 + R.next() * 2;
  return [la1, lo1, la2, lo2];
}, 5000);
J.haversine = {
  lokal: { mae: +havLokal.mae.toFixed(3), rmse: +havLokal.rmse.toFixed(3),
           meanPct: +havLokal.meanPct.toFixed(4), maxPct: +havLokal.maxPct.toFixed(4) },
  miqat: { mae: +havMiqat.mae.toFixed(3), rmse: +havMiqat.rmse.toFixed(3),
           meanPct: +havMiqat.meanPct.toFixed(4), maxPct: +havMiqat.maxPct.toFixed(4) },
};
w('');
w('*Catatan: Haversine mengasumsikan bumi bola (R=6.371 km); Vincenty memodelkan elipsoid WGS-84.*');
w('');

// ============ 2. GEOFENCE MIQAT (point-in-circle) ===========================
w("## 2. Geofence Miqat — klasifikasi 'dalam batas' (radius 1.000 m)");
w('');
w('Ground truth = jarak sebenarnya ≤ 1.000 m. Prediksi = jarak dari posisi ber-noise ≤ 1.000 m.');
w('');
w('| sigma (m) | Akurasi (%) | Presisi (%) | Recall (%) | F1 (%) | CI95 akurasi |');
w('|---|---|---|---|---|---|');
const miqatCsv = ['sigma,accuracy,precision,recall,f1,ci_lo,ci_hi'];
const N_MIQAT = 8000;
for (const sigma of SIGMAS) {
  R.reset(100 + sigma);
  const b: Bin = { tp: 0, fp: 0, tn: 0, fn: 0 };
  for (let i = 0; i < N_MIQAT; i++) {
    const m = MIQAT[i % MIQAT.length];
    // titik pada jarak sebenarnya uniform 0–2500 m, bearing acak (menekankan batas 1000 m)
    const trueDist = R.next() * 2500;
    const bearing = R.next() * 2 * Math.PI;
    const dN = trueDist * Math.cos(bearing), dE = trueDist * Math.sin(bearing);
    const lat = m.lat + dN / M_PER_DEG_LAT;
    const lng = m.lng + dE / mPerDegLng(m.lat);
    const truth = haversine(lat, lng, m.lat, m.lng) <= m.radius; // ground truth: posisi bersih
    const nz = addNoise(lat, lng, sigma);
    const pred = haversine(nz.lat, nz.lng, m.lat, m.lng) <= m.radius;
    if (pred && truth) b.tp++; else if (pred && !truth) b.fp++;
    else if (!pred && !truth) b.tn++; else b.fn++;
  }
  const mt = binMetrics(b);
  const ci = wilson95(b.tp + b.tn, N_MIQAT);
  w(`| ${sigma} | ${pct(mt.acc)} | ${pct(mt.prec)} | ${pct(mt.rec)} | ${pct(mt.f1)} | [${pct(ci.lo)}, ${pct(ci.hi)}] |`);
  miqatCsv.push(`${sigma},${pct(mt.acc)},${pct(mt.prec)},${pct(mt.rec)},${pct(mt.f1)},${pct(ci.lo)},${pct(ci.hi)}`);
  J.miqat.push({ sigma, akurasi: +pct(mt.acc), presisi: +pct(mt.prec), recall: +pct(mt.rec), f1: +pct(mt.f1), ci_lo: +pct(ci.lo), ci_hi: +pct(ci.hi) });
}
writeFileSync(join(OUT_DIR, 'miqat_accuracy.csv'), miqatCsv.join('\n'));
w('');

// ============ 3. DETEKSI ARAFAH (ray casting) ===============================
w('## 3. Deteksi Arafah — point-in-polygon (ray casting, 5 titik)');
w('');
w('Ground truth = point-in-polygon posisi bersih. Prediksi = point-in-polygon posisi ber-noise.');
w('');
w('| sigma (m) | Akurasi (%) | Presisi (%) | Recall (%) | F1 (%) | CI95 akurasi |');
w('|---|---|---|---|---|---|');
const arafahCsv = ['sigma,accuracy,precision,recall,f1,ci_lo,ci_hi'];
// bounding box poligon (dipakai juga oleh experiments/analytic.ts untuk cek analitik)
export const ARAFAH_BOX = { latMin: 21.320, latMax: 21.382, lngMin: 39.950, lngMax: 40.025 };
const N_ARAFAH = 12000;
for (const sigma of SIGMAS) {
  R.reset(200 + sigma);
  const b: Bin = { tp: 0, fp: 0, tn: 0, fn: 0 };
  for (let i = 0; i < N_ARAFAH; i++) {
    const lat = ARAFAH_BOX.latMin + R.next() * (ARAFAH_BOX.latMax - ARAFAH_BOX.latMin);
    const lng = ARAFAH_BOX.lngMin + R.next() * (ARAFAH_BOX.lngMax - ARAFAH_BOX.lngMin);
    const truth = isPointInPolygon(lat, lng, ARAFAH_BOUNDARY);
    const nz = addNoise(lat, lng, sigma);
    const pred = isPointInPolygon(nz.lat, nz.lng, ARAFAH_BOUNDARY);
    if (pred && truth) b.tp++; else if (pred && !truth) b.fp++;
    else if (!pred && !truth) b.tn++; else b.fn++;
  }
  const mt = binMetrics(b);
  const ci = wilson95(b.tp + b.tn, N_ARAFAH);
  w(`| ${sigma} | ${pct(mt.acc)} | ${pct(mt.prec)} | ${pct(mt.rec)} | ${pct(mt.f1)} | [${pct(ci.lo)}, ${pct(ci.hi)}] |`);
  arafahCsv.push(`${sigma},${pct(mt.acc)},${pct(mt.prec)},${pct(mt.rec)},${pct(mt.f1)},${pct(ci.lo)},${pct(ci.hi)}`);
  J.arafah.push({ sigma, akurasi: +pct(mt.acc), presisi: +pct(mt.prec), recall: +pct(mt.rec), f1: +pct(mt.f1), ci_lo: +pct(ci.lo), ci_hi: +pct(ci.hi) });
}
writeFileSync(join(OUT_DIR, 'arafah_accuracy.csv'), arafahCsv.join('\n'));
w('');
w('*Kesalahan terkonsentrasi di pita tepi poligon; interior/eksterior jauh selalu benar.*');
w('');

// ============ 4. PENGHITUNG TAWAF (Tabel 6) =================================
w('## 4. Penghitung Tawaf Otomatis (target = 7 putaran)');
w('');
const TAWAF_R = 25, TAWAF_DT = 3, TAWAF_STEPS_PER_LAP = 100, TAWAF_LAPS = 7;
// t0 realistis (bukan 0): basis mendekati epoch riil (produksi memakai Date.now()).
// Diinjeksikan lewat parameter ketiga update(lat,lng,now) — TIDAK memengaruhi hasil
// (debounce waktu sudah dihapus dari TawafTracker, lihat sacred-zones-core.ts) tapi
// menghindari asumsi t0=0 yang menyimpang dari kondisi produksi (temuan reviewer).
const TAWAF_T0 = 1_700_000_000_000;
// Revisi 2026-09-15 (kebijakan "tidak pernah dini"): TawafTracker sekarang
// merata-ratakan REF_SAMPLES=3 sampel pertama sebagai referensi sudut (bias
// aman-ke-belakang, lihat sacred-zones-core.ts §TawafTracker). Lintasan lama
// (mulai dingin sambil langsung berjalan, berhenti TEPAT di 2520°, tanpa
// sampel lanjutan) kehilangan ~1-2 langkah rotasi ke referensi TANPA cara
// memulihkannya — memberi under-count SISTEMATIS bahkan pada sigma=0 (bukan
// bug, konsekuensi langsung kebijakan tsb, lihat CLAUDE.md & handoff 05c).
// Path di bawah kini: (a) TAWAF_SETTLE sampel diam di titik mulai (referensi
// tak bias, sama seperti realita jamaah diam sejenak di sudut Hajar Aswad
// sebelum melangkah -- juga sesuai T1 di tawaf-direction.test.ts), dan
// (b) TAWAF_TAIL sampel diam di titik selesai (sesuai kebijakan UI "biarkan
// GPS aktif ~30 dtk setelah terasa selesai", tools.tsx) -- keduanya HANYA
// menambah realisme metodologi, TIDAK mengubah cara algoritma dievaluasi.
const TAWAF_SETTLE = 5, TAWAF_TAIL = 10;
function tawafPath(): Array<{ lat: number; lng: number; t: number; idealDeg: number }> {
  // Mulai jauh dari garis Hajar Aswad (offset setengah-langkah startBeta=271.8°),
  // tempuh tepat 7 putaran CCW penuh (arah tawaf sah — lihat sacred-zones-core.ts).
  // CCW matematis: dE = r*cos(beta), dN = r*sin(beta), beta NAIK (bukan dN=cos/dE=sin
  // seperti skema CW lama, lihat handoff 05a & gps-replay/__tests__/tawaf-direction.test.ts).
  const startBeta = 271.8;
  const total = TAWAF_LAPS * TAWAF_STEPS_PER_LAP; // 700 langkah x 3,6 deg = 2520 deg = 7 putaran
  const pts: Array<{ lat: number; lng: number; t: number; idealDeg: number }> = [];
  let t = TAWAF_T0;
  const toLatLng = (betaDeg: number) => {
    const beta = (betaDeg * Math.PI) / 180;
    const dE = TAWAF_R * Math.cos(beta), dN = TAWAF_R * Math.sin(beta);
    return { lat: KAABAH.lat + dN / M_PER_DEG_LAT, lng: KAABAH.lng + dE / mPerDegLng(KAABAH.lat) };
  };
  const push = (betaDeg: number, idealDeg: number) => {
    pts.push({ ...toLatLng(betaDeg), t, idealDeg });
    t += TAWAF_DT * 1000;
  };
  for (let i = 0; i < TAWAF_SETTLE; i++) push(startBeta, 0);
  for (let s = 1; s <= total; s++) {
    const idealDeg = s * (360 / TAWAF_STEPS_PER_LAP);
    push(startBeta + idealDeg, idealDeg);
  }
  const finalDeg = total * (360 / TAWAF_STEPS_PER_LAP); // == 2520
  for (let i = 0; i < TAWAF_TAIL; i++) push(startBeta + finalDeg, finalDeg);
  return pts;
}
w('| sigma (m) | Rata2 putaran | Akurasi tepat-7 (%) | CI95 tepat-7 | MAE | RMSE |');
w('|---|---|---|---|---|---|');
const tawafCsv = ['sigma,mean,exact7_pct,ci_lo,ci_hi,mae,rmse'];
const tawafHistCsv = ['sigma,rounds,count'];
// Kolom late_* ditambahkan DI AKHIR (2026-09-15, kebijakan tidak-pernah-dini)
// -- kolom lama tidak berubah nama/posisi.
const earlyCsv = ['sigma,early_deg_mean,early_deg_p5,early_deg_p50,early_deg_p95,early_arc_m_mean,early_arc_m_p5,early_arc_m_p50,early_arc_m_p95,n_exact7,late_deg_p50,late_deg_p95,late_arc_m_p50,late_arc_m_p95'];
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return NaN;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))));
  return sorted[idx];
}
for (const sigma of SIGMAS) {
  R.reset(300 + sigma);
  let sum = 0, exact = 0, sumErr = 0, sumSq = 0;
  const hist: Record<number, number> = {};
  const earlyDegs: number[] = []; // signed: negatif = dini, positif = terlambat (semantik lama dipertahankan)
  for (let tr = 0; tr < TRIALS; tr++) {
    const path = tawafPath();
    const tk = new TawafTracker();
    let triggerIdealDeg: number | null = null;
    let currentIdealDeg = 0;
    tk.onChange = (rounds) => { if (rounds === TAWAF_LAPS && triggerIdealDeg === null) triggerIdealDeg = currentIdealDeg; };
    for (const p of path) {
      currentIdealDeg = p.idealDeg;
      const nz = addNoise(p.lat, p.lng, sigma);
      tk.update(nz.lat, nz.lng, p.t);
    }
    const rounds = tk.getRounds();
    sum += rounds; if (rounds === TAWAF_LAPS) exact++;
    sumErr += Math.abs(rounds - TAWAF_LAPS); sumSq += (rounds - TAWAF_LAPS) ** 2;
    hist[rounds] = (hist[rounds] ?? 0) + 1;
    if (rounds === TAWAF_LAPS && triggerIdealDeg !== null) {
      // sudut TRUE (noiseless) yang sudah ditempuh saat putaran ke-7 terpicu,
      // relatif thd penyelesaian geometris (2520°). Negatif = dini (mestinya
      // tak pernah terjadi pada sigma=0 -- kebijakan tidak-pernah-dini).
      const diff = (triggerIdealDeg as number) - TAWAF_LAPS * 360;
      earlyDegs.push(diff);
    }
  }
  const mean = sum / TRIALS, mae = sumErr / TRIALS, rmse = Math.sqrt(sumSq / TRIALS);
  const ci = wilson95(exact, TRIALS);
  w(`| ${sigma} | ${mean.toFixed(2)} | ${pct(exact / TRIALS)} | [${pct(ci.lo)}, ${pct(ci.hi)}] | ${mae.toFixed(3)} | ${rmse.toFixed(3)} |`);
  tawafCsv.push(`${sigma},${mean.toFixed(2)},${pct(exact / TRIALS)},${pct(ci.lo)},${pct(ci.hi)},${mae.toFixed(3)},${rmse.toFixed(3)}`);
  J.tawaf.push({ sigma, mean: +mean.toFixed(2), exact7: +pct(exact / TRIALS), ci_lo: +pct(ci.lo), ci_hi: +pct(ci.hi), mae: +mae.toFixed(3), rmse: +rmse.toFixed(3) });

  const histObj: Record<string, number> = {};
  for (const k of Object.keys(hist).sort((a, b) => +a - +b)) {
    histObj[k] = hist[+k];
    tawafHistCsv.push(`${sigma},${k},${hist[+k]}`);
  }
  J.tawaf_histogram[String(sigma)] = histObj;

  earlyDegs.sort((a, b) => a - b);
  const arcPerDeg = (2 * Math.PI * TAWAF_R) / 360;
  const meanDeg = earlyDegs.length ? earlyDegs.reduce((a, b) => a + b, 0) / earlyDegs.length : NaN;
  const p5 = percentile(earlyDegs, 0.05), p50 = percentile(earlyDegs, 0.5), p95 = percentile(earlyDegs, 0.95);
  // Kolom late_* (ditambahkan 2026-09-15, DI AKHIR): magnitudo sisi TERLAMBAT
  // (nilai signed positif di earlyDegs) -- dilaporkan terpisah agar tak
  // tercampur dgn sisi dini saat mengambil percentile gabungan di atas.
  const lateOnly = earlyDegs.filter((d) => d > 0);
  const lateP50 = percentile(lateOnly, 0.5), lateP95 = percentile(lateOnly, 0.95);
  earlyCsv.push([
    sigma, meanDeg.toFixed(3), p5.toFixed(3), p50.toFixed(3), p95.toFixed(3),
    (meanDeg * arcPerDeg).toFixed(3), (p5 * arcPerDeg).toFixed(3), (p50 * arcPerDeg).toFixed(3), (p95 * arcPerDeg).toFixed(3),
    earlyDegs.length,
    lateP50.toFixed(3), lateP95.toFixed(3), (lateP50 * arcPerDeg).toFixed(3), (lateP95 * arcPerDeg).toFixed(3),
  ].join(','));
  J.tawaf_early_trigger.push({
    sigma, early_deg_mean: +meanDeg.toFixed(3), early_deg_p5: +p5.toFixed(3), early_deg_p50: +p50.toFixed(3), early_deg_p95: +p95.toFixed(3),
    early_arc_m_mean: +(meanDeg * arcPerDeg).toFixed(3), n_exact7: earlyDegs.length,
    late_deg_p50: +lateP50.toFixed(3), late_deg_p95: +lateP95.toFixed(3),
    late_arc_m_p50: +(lateP50 * arcPerDeg).toFixed(3), late_arc_m_p95: +(lateP95 * arcPerDeg).toFixed(3),
  });
}
writeFileSync(join(OUT_DIR, 'tawaf_accuracy.csv'), tawafCsv.join('\n'));
writeFileSync(join(OUT_DIR, 'tawaf_histogram.csv'), tawafHistCsv.join('\n'));
writeFileSync(join(OUT_DIR, 'tawaf_early_trigger.csv'), earlyCsv.join('\n'));
w('');
w(`*${TRIALS} percobaan/sigma. Lintasan melingkar CCW r=25 m, ~300 s/putaran (~0,52 m/s), sampling 3 s, t0=${TAWAF_T0}, settle ${TAWAF_SETTLE} sampel di titik mulai + tail ${TAWAF_TAIL} sampel di titik selesai (kebijakan UI "GPS aktif ≥30 dtk").*`);
w('*Pemicuan dini/terlambat: sudut/jarak-busur posisi BENAR (noiseless) saat hitungan ke-7 terpicu, relatif thd selesainya 7 putaran geometris (2520°) — negatif (`early_deg_*`) = dini (kebijakan menjamin ini TIDAK PERNAH terjadi pada sigma=0), positif (`late_deg_*`) = terlambat (aman, trade-off desain); hanya percobaan tepat-7. Lihat `results/tawaf_early_trigger.csv`.*');
w('*Histogram jumlah putaran per sigma: `results/tawaf_histogram.csv`.*');
w('');

// ============ 5. PENGHITUNG SA'I (Tabel 7) ==================================
w("## 5. Penghitung Sa'i Otomatis (target = 7 leg)");
w('');
function saiPath(): Array<{ lat: number; lng: number }> {
  const dt = 3;
  const legTime = 400 + R.next() * 80;
  const steps = Math.round(legTime / dt);
  const pts: Array<{ lat: number; lng: number }> = [];
  for (let leg = 0; leg < 7; leg++) {
    const src = leg % 2 === 0 ? SAFA : MARWAH;
    const dst = leg % 2 === 0 ? MARWAH : SAFA;
    for (let s = 0; s < steps; s++) {
      const f = s / steps;
      pts.push({ lat: src.lat + (dst.lat - src.lat) * f, lng: src.lng + (dst.lng - src.lng) * f });
    }
  }
  pts.push({ lat: MARWAH.lat, lng: MARWAH.lng });
  return pts;
}
w('| sigma (m) | Rata2 leg | Akurasi tepat-7 (%) | CI95 tepat-7 | MAE | RMSE |');
w('|---|---|---|---|---|---|');
const saiCsv = ['sigma,mean,exact7_pct,ci_lo,ci_hi,mae,rmse'];
for (const sigma of SIGMAS) {
  R.reset(400 + sigma);
  let sum = 0, exact = 0, sumErr = 0, sumSq = 0;
  for (let tr = 0; tr < TRIALS; tr++) {
    const path = saiPath();
    const tk = new SaiTracker();
    for (const p of path) {
      const nz = addNoise(p.lat, p.lng, sigma);
      tk.update(nz.lat, nz.lng);
    }
    const legs = tk.getLegs();
    sum += legs; if (legs === 7) exact++;
    sumErr += Math.abs(legs - 7); sumSq += (legs - 7) ** 2;
  }
  const mean = sum / TRIALS, mae = sumErr / TRIALS, rmse = Math.sqrt(sumSq / TRIALS);
  const ci = wilson95(exact, TRIALS);
  w(`| ${sigma} | ${mean.toFixed(2)} | ${pct(exact / TRIALS)} | [${pct(ci.lo)}, ${pct(ci.hi)}] | ${mae.toFixed(3)} | ${rmse.toFixed(3)} |`);
  saiCsv.push(`${sigma},${mean.toFixed(2)},${pct(exact / TRIALS)},${pct(ci.lo)},${pct(ci.hi)},${mae.toFixed(3)},${rmse.toFixed(3)}`);
  J.sai.push({ sigma, mean: +mean.toFixed(2), exact7: +pct(exact / TRIALS), ci_lo: +pct(ci.lo), ci_hi: +pct(ci.hi), mae: +mae.toFixed(3), rmse: +rmse.toFixed(3) });
}
writeFileSync(join(OUT_DIR, 'sai_accuracy.csv'), saiCsv.join('\n'));
w('');
w(`*${TRIALS} percobaan/sigma. Jarak Safa–Marwah ${dSafaMarwah.toFixed(0)} m, ~415–480 s/leg, sampling 3 s.*`);
w('');

// ============ 6. DETEKSI JAMARAT (3 kelas) ==================================
w('## 6. Deteksi Jamarat — identifikasi 1 dari 3 pilar (radius 30 m)');
w('');
w('Ground truth = pilar tempat jamaah berdiri (jarak ≤ 12 m dari pilar). Prediksi = jamarat terdekat dalam radius 30 m.');
w('');
w('| sigma (m) | Akurasi benar (%) | CI95 benar | Salah pilar (%) | Tak terdeteksi (%) |');
w('|---|---|---|---|---|');
const jamCsv = ['sigma,correct,ci_lo,ci_hi,wrong,none'];
const jamKeys: JamKey[] = ['ula', 'wustha', 'aqabah'];
const confAtSigma: Record<number, Record<string, Record<string, number>>> = {};
const JAM_PER_CLASS = 4000;
for (const sigma of SIGMAS) {
  R.reset(500 + sigma);
  let correct = 0, wrong = 0, none = 0, total = 0;
  const conf: Record<string, Record<string, number>> = {};
  for (const k of jamKeys) conf[k] = { ula: 0, wustha: 0, aqabah: 0, none: 0 };
  for (const truth of jamKeys) {
    const pillar = JAMARAT[truth];
    for (let i = 0; i < JAM_PER_CLASS; i++) {
      const d = R.next() * 12; // jamaah berkerumun ≤12 m dari pilar
      const bearing = R.next() * 2 * Math.PI;
      const lat = pillar.lat + (d * Math.cos(bearing)) / M_PER_DEG_LAT;
      const lng = pillar.lng + (d * Math.sin(bearing)) / mPerDegLng(pillar.lat);
      const nz = addNoise(lat, lng, sigma);
      const pred = detectNearestJamarat(nz.lat, nz.lng);
      total++;
      conf[truth][pred?.key ?? 'none']++;
      if (pred === null) none++; else if (pred.key === truth) correct++; else wrong++;
    }
  }
  confAtSigma[sigma] = conf;
  const ci = wilson95(correct, total);
  w(`| ${sigma} | ${pct(correct / total)} | [${pct(ci.lo)}, ${pct(ci.hi)}] | ${pct(wrong / total)} | ${pct(none / total)} |`);
  jamCsv.push(`${sigma},${pct(correct / total)},${pct(ci.lo)},${pct(ci.hi)},${pct(wrong / total)},${pct(none / total)}`);
  J.jamarat.push({ sigma, benar: +pct(correct / total), ci_lo: +pct(ci.lo), ci_hi: +pct(ci.hi), salahPilar: +pct(wrong / total), takTerdeteksi: +pct(none / total) });
}
writeFileSync(join(OUT_DIR, 'jamarat_accuracy.csv'), jamCsv.join('\n'));
w('');
const CM_SIGMA = 15;
J.jamarat_confusion_sigma15 = confAtSigma[CM_SIGMA];
w(`### Confusion matrix Jamarat pada sigma = ${CM_SIGMA} m`);
w('');
w('| Sebenarnya \\ Prediksi | Ula | Wustha | Aqabah | Tak terdeteksi |');
w('|---|---|---|---|---|');
for (const k of jamKeys) {
  const c = confAtSigma[CM_SIGMA][k];
  w(`| **${JAMARAT[k].name}** | ${c.ula} | ${c.wustha} | ${c.aqabah} | ${c.none} |`);
}
w('');
w('*Pilar terpisah 68–144 m > 2×radius (60 m) → nyaris tidak ada salah-pilar. Degradasi di sigma besar didominasi "tak terdeteksi": noise mendorong posisi keluar radius 30 m.*');
w('');

// ============ 7. R8: SKENARIO TAWAF (r x mode x sigma x skenario) ===========
w('## 7. Skenario Tawaf tambahan (R8) — radius edar, mode, skenario mulai/diam');
w('');
w('Ringkas di `results/tawaf_scenarios.csv` (500 percobaan/sel; lihat file eksperimen untuk definisi skenario I/II/III).');
w('*Catatan kebijakan "tidak pernah dini" (2026-09-15): Skenario II (mulai dingin sambil langsung berjalan, TANPA diam di awal) SENGAJA dipertahankan sbg kasus adversarial — rata2 putaran WAJAR ~6 (bukan 7) pada sigma rendah karena referensi awal (rata-rata 3 sampel pertama) kehilangan sedikit rotasi yang tak bisa dipulihkan tanpa gerak/diam lanjutan pasca-selesai. Ini bukan bug, melainkan konsekuensi langsung dari jaminan "tidak pernah dini" — dilaporkan apa adanya (lihat `results/tawaf_scenarios.csv`, scenario=II). Skenario I & III sudah disesuaikan (settle/tail) agar merepresentasikan penggunaan wajar sesuai kebijakan UI.*');
w('');
const scenarioResult = runTawafScenarios({ R, addNoise, OUT_DIR });
w(scenarioResult.summaryMd);

// ============ 8. R9: SKENARIO SA'I TITIK BALIK ===============================
w("## 8. Skenario Sa'i tambahan (R9) — offset titik balik & lateral");
w('');
w('Ringkas di `results/sai_scenarios.csv` (500 percobaan/sel).');
w('');
const saiScenarioResult = runSaiScenarios({ R, addNoise, OUT_DIR });
w(saiScenarioResult.summaryMd);

// ============ 9. R6: MODEL DERAU (AR1, Gauss-Markov, bias) ==================
w('## 9. Perbandingan model derau (R6) — iid vs AR(1) vs Gauss-Markov vs bias');
w('');
w('Ringkas di `results/noise_models.csv` (500 percobaan/sel; jamarat 4.000/kelas seperti eksperimen utama).');
w('');
const noiseModelResult = runNoiseModels({ R, OUT_DIR });
w(noiseModelResult.summaryMd);

// ============ 10. R4: CEK ANALITIK & KURVA BATAS =============================
w('## 10. Cek analitik vs Monte Carlo (R4)');
w('');
w('Ringkas di `results/analytic_check.csv` dan `results/boundary_error_curve.csv`.');
w('');
const analyticResult = runAnalyticChecks({
  R, addNoise, OUT_DIR,
  miqatMc: J.miqat, arafahMc: J.arafah, jamaratMc: J.jamarat,
  arafahBox: ARAFAH_BOX,
});
w(analyticResult.summaryMd);

// ============ RINGKASAN =====================================================
w('## Ringkasan & Temuan');
w('');
w('- **Haversine**: galat terhadap elipsoid WGS-84 sangat kecil (< 0,5%), memadai untuk skala meter.');
w('- **Sa\'i**: paling tahan noise — pemisahan geometris Safa–Marwah (≈415 m) ≫ error GPS.');
w('- **Geofence Miqat & Arafah**: kesalahan hanya di pita tepi selebar ~sigma; akurasi menurun landai, sesuai prediksi analitik Φ(−d/σ) (§10).');
w('- **Tawaf**: sensitif pada sigma besar (radius kecil 25 m); skema sudut kumulatif CCW menerapkan kebijakan "tidak pernah dini" (referensi awal rata-rata sirkular + margin=0, tanpa toleransi positif) — pemicuan TIDAK PERNAH mendahului 360k° (0 m dini pada sigma=0), dengan trade-off sedikit KETERLAMBATAN dan penurunan kecil proporsi tepat-7 di sigma rendah (§4) — lihat §7 untuk sensitivitas radius/mode/skenario.');
w('- **Jamarat**: pemisahan pilar (68–144 m) memadai → salah-pilar hampir nol; kerentanan justru "tak terdeteksi" saat sigma besar (noise keluar radius 30 m), konsisten dengan model Rice analitik (§10).');
w('');
w(`*Dibangun dari analisis kode Mabrur. Seed=${SEED}. CSV per algoritma tersimpan di \`docs/accuracy-test/results/\`.*`);

Object.assign(J, {
  tawaf_scenarios_meta: scenarioResult.meta,
  sai_scenarios_meta: saiScenarioResult.meta,
  noise_models_meta: noiseModelResult.meta,
  analytic_meta: analyticResult.meta,
});

writeFileSync(join(OUT_DIR, 'summary.md'), lines.join('\n'));
writeFileSync(join(OUT_DIR, 'monte_carlo_results.json'), JSON.stringify(J, null, 2) + '\n');
console.log('\n[OK] Ringkasan -> docs/accuracy-test/results/summary.md + CSV + monte_carlo_results.json.');
