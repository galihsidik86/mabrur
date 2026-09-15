/*
 * R8 — Skenario Tawaf tambahan: sensitivitas radius edar, mode (default/adaptif),
 * dan pola mulai/selesai/diam, terhadap noise GPS.
 *
 * Tiga skenario lintasan (CCW, arah tawaf sah — lihat sacred-zones-core.ts):
 *   I.   Ideal: mulai jauh dari garis Hajar Aswad (startBeta=271,8°, sama seperti
 *        Tabel 6 utama di run.ts), 7 putaran penuh, + settle/tail (lihat revisi
 *        2026-09-15 di bawah).
 *   II.  Mulai & selesai TEPAT di garis yang sama (startBeta=0°), 7 putaran penuh,
 *        TANPA diam di awal (kasus adversarial "mulai dingin sambil langsung
 *        berjalan" — SENGAJA dipertahankan, lihat revisi 2026-09-15).
 *   III. Seperti II, tapi diam 30 dtk (10 sampel @ 3 dtk) di titik awal SEBELUM
 *        bergerak, dan 30 dtk di titik akhir SETELAH selesai (mis. jamaah berhenti
 *        untuk istilam sebelum/sesudah). Pola identik dengan
 *        `circlePathStallStartEnd` di gps-replay/__tests__/tawaf-direction.test.ts
 *        (terbukti menghasilkan tepat 7 tanpa debounce apa pun pada kondisi bersih).
 *
 * Revisi 2026-09-15 (kebijakan "tidak pernah dini", lihat sacred-zones-core.ts
 * §TawafTracker & handoff 05c): TawafTracker kini merata-ratakan REF_SAMPLES=3
 * sampel pertama sbg referensi (bias aman-ke-belakang) — lintasan yang mulai
 * DINGIN sambil LANGSUNG bergerak kehilangan ~1-2 langkah rotasi ke referensi
 * TANPA cara memulihkannya bila tak ada gerak/diam lanjutan pasca-selesai,
 * memberi UNDER-COUNT SISTEMATIS (bukan bug) bahkan pada sigma=0.
 *   - Skenario I: ditambah settle (diam SETTLE_SAMPLES sampel di titik mulai,
 *     menghilangkan kehilangan referensi) + tail (diam STALL_SAMPLES sampel di
 *     titik selesai, sesuai kebijakan UI "GPS aktif ≥30 dtk") — konsisten dgn
 *     perbaikan yg sama di Tabel 6 utama (run.ts).
 *   - Skenario II: SENGAJA dipertahankan TANPA settle di awal (ciri pembedanya
 *     dari III) — hanya ditambah tail (diam STALL_SAMPLES di titik selesai,
 *     minimum kebijakan UI). Karena tail berupa DIAM (bukan gerak lanjutan),
 *     ia TIDAK memulihkan kehilangan referensi awal pada sigma rendah (diam =
 *     delta≈0, tak ada rotasi baru untuk "mengejar" ambang) — skenario ini
 *     WAJAR & DIHARAPKAN menghasilkan rata2 ≈6 (bukan 7) pada sigma rendah,
 *     dilaporkan apa adanya (TIDAK disembunyikan) sebagai ilustrasi konsekuensi
 *     kebijakan "tidak pernah dini" utk kasus mulai-dingin-tanpa-jeda.
 *   - Skenario III: sudah punya settle DI KEDUA ujung sejak awal, tidak berubah.
 *
 * Untuk setiap skenario x radius x mode x sigma: 500 percobaan, RNG offset base
 * TERPISAH dari eksperimen lain (10.000.000+) agar tidak pernah beririsan dengan
 * offset Tabel 6 (300+sigma) maupun eksperimen R9/R6/R4 lain.
 */
import { writeFileSync } from 'fs';
import { join } from 'path';
import { KAABAH, M_PER_DEG_LAT, mPerDegLng, TawafTracker, Rng } from '../sim-core';
import { wilson95 } from '../stats';

export interface TawafScenarioCtx {
  R: Rng;
  addNoise: (lat: number, lng: number, sigma: number) => { lat: number; lng: number };
  OUT_DIR: string;
}

export interface Point { lat: number; lng: number; t: number; idealDeg: number; }

export const DT = 3; // detik/sampel
export const STEPS_PER_LAP = 100; // -> 3,6 deg/langkah, ~300 dtk/putaran nominal
export const LAPS = 7;
export const T0 = 1_700_000_000_000;
export const STALL_SAMPLES = 10; // 10 x 3 dtk = 30 dtk
export const SETTLE_SAMPLES = 5; // > REF_SAMPLES produksi (3) -- referensi awal tak bias

function pointAt(r: number, betaDeg: number): { lat: number; lng: number } {
  const beta = (betaDeg * Math.PI) / 180;
  const dE = r * Math.cos(beta), dN = r * Math.sin(beta);
  return { lat: KAABAH.lat + dN / M_PER_DEG_LAT, lng: KAABAH.lng + dE / mPerDegLng(KAABAH.lat) };
}

// I. Ideal: settle di titik mulai (referensi tak bias) + tail diam di titik
// selesai (kebijakan UI "GPS aktif >=30 dtk") -- lihat catatan revisi di atas.
function pathIdeal(r: number): Point[] {
  const startBeta = 271.8;
  const total = LAPS * STEPS_PER_LAP;
  const pts: Point[] = [];
  let t = T0;
  const push = (betaDeg: number, idealDeg: number) => { pts.push({ ...pointAt(r, betaDeg), t, idealDeg }); t += DT * 1000; };
  for (let i = 0; i < SETTLE_SAMPLES; i++) push(startBeta, 0);
  for (let s = 1; s <= total; s++) { const d = s * (360 / STEPS_PER_LAP); push(startBeta + d, d); }
  const finalDeg = total * (360 / STEPS_PER_LAP);
  for (let i = 0; i < STALL_SAMPLES; i++) push(startBeta + finalDeg, finalDeg);
  return pts;
}

// II. Mulai=selesai (beta=0), TANPA settle di awal (kasus adversarial, SENGAJA
// dipertahankan) + tail diam di titik selesai (minimum kebijakan UI). Lihat
// catatan revisi 2026-09-15 di atas: tail berupa DIAM tidak memulihkan
// kehilangan referensi awal pada sigma rendah -- hasil ~6 di sana WAJAR.
function pathSameStartEnd(r: number): Point[] {
  const total = LAPS * STEPS_PER_LAP;
  const pts: Point[] = [];
  let t = T0;
  const push = (betaDeg: number, idealDeg: number) => { pts.push({ ...pointAt(r, betaDeg), t, idealDeg }); t += DT * 1000; };
  for (let s = 0; s <= total; s++) { const d = s * (360 / STEPS_PER_LAP); push(d, d); } // s=total kembali TEPAT ke titik awal (0 deg mod 360)
  const finalDeg = total * (360 / STEPS_PER_LAP);
  for (let i = 0; i < STALL_SAMPLES; i++) push(finalDeg, finalDeg);
  return pts;
}

// Dipakai ulang oleh experiments/noise-models.ts (skenario III r=25, R6) — satu
// sumber definisi geometri, hindari dua salinan yang bisa berbeda diam-diam.
export function pathStallStartEnd(r: number): Point[] {
  const pts: Point[] = [];
  let t = T0;
  const push = (betaDeg: number, idealDeg: number) => { pts.push({ ...pointAt(r, betaDeg), t, idealDeg }); t += DT * 1000; };
  for (let i = 0; i < STALL_SAMPLES; i++) push(0, 0);
  const total = LAPS * STEPS_PER_LAP;
  for (let s = 1; s <= total; s++) { const d = s * (360 / STEPS_PER_LAP); push(d, d); }
  const finalDeg = total * (360 / STEPS_PER_LAP); // == start (mod 360)
  for (let i = 1; i < STALL_SAMPLES; i++) push(finalDeg, finalDeg);
  return pts;
}

const SCENARIOS: Array<{ key: string; label: string; gen: (r: number) => Point[] }> = [
  { key: 'I', label: 'Ideal (mulai jauh dari garis)', gen: pathIdeal },
  { key: 'II', label: 'Mulai=selesai, tanpa diam', gen: pathSameStartEnd },
  { key: 'III', label: 'Mulai=selesai, diam 30 dtk di awal+akhir', gen: pathStallStartEnd },
];
const RADII = [12, 15, 25, 40, 60];
const MODES: Array<{ key: string; adaptive: boolean }> = [{ key: 'default', adaptive: false }, { key: 'adaptif', adaptive: true }];
const SIGMAS = [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 15];
const N_TRIALS = 500;
const OFFSET_BASE = 10_000_000;

export function runTawafScenarios(ctx: TawafScenarioCtx) {
  const { R, addNoise, OUT_DIR } = ctx;
  // Kolom late_deg_mean ditambahkan DI AKHIR (2026-09-15, kebijakan
  // tidak-pernah-dini) -- kolom lama tidak berubah nama/posisi/makna.
  const csv = ['scenario,mode,r,sigma,n,exact7_pct,ci_lo,ci_hi,mean,mae,early_deg_mean,late_deg_mean'];
  const rows: Array<Record<string, number | string>> = [];
  let cellIdx = 0;

  for (const scen of SCENARIOS) {
    for (const [rIdx, r] of RADII.entries()) {
      for (const [modeIdx, mode] of MODES.entries()) {
        for (const [sigIdx, sigma] of SIGMAS.entries()) {
          const offset = OFFSET_BASE + cellIdx * 97; // 97: coprime step, jarak antar sel cukup lebar
          cellIdx++;
          R.reset(offset);
          let exact = 0, sumRounds = 0, sumAbsErr = 0;
          // signed: negatif = dini (early), positif = terlambat (late, aman) --
          // dipisah di bawah utk kolom early_deg_mean/late_deg_mean terpisah.
          const diffDegs: number[] = [];
          for (let tr = 0; tr < N_TRIALS; tr++) {
            const path = scen.gen(r);
            const tk = new TawafTracker({ adaptive: mode.adaptive });
            let triggerIdealDeg: number | null = null;
            let currentIdealDeg = 0;
            tk.onChange = (rounds) => { if (rounds === LAPS && triggerIdealDeg === null) triggerIdealDeg = currentIdealDeg; };
            for (const p of path) {
              currentIdealDeg = p.idealDeg;
              const nz = addNoise(p.lat, p.lng, sigma);
              tk.update(nz.lat, nz.lng, p.t);
            }
            const rounds = tk.getRounds();
            sumRounds += rounds;
            sumAbsErr += Math.abs(rounds - LAPS);
            if (rounds === LAPS) {
              exact++;
              if (triggerIdealDeg !== null) {
                diffDegs.push((triggerIdealDeg as number) - LAPS * 360);
              }
            }
          }
          const mean = sumRounds / N_TRIALS;
          const mae = sumAbsErr / N_TRIALS;
          const exact7Pct = (exact / N_TRIALS) * 100;
          const ci = wilson95(exact, N_TRIALS);
          const earlyOnly = diffDegs.filter((d) => d < 0);
          const lateOnly = diffDegs.filter((d) => d > 0);
          const earlyMean = earlyOnly.length ? earlyOnly.reduce((a, b) => a + b, 0) / earlyOnly.length : NaN;
          const lateMean = lateOnly.length ? lateOnly.reduce((a, b) => a + b, 0) / lateOnly.length : NaN;
          csv.push([
            scen.key, mode.key, r, sigma, N_TRIALS, exact7Pct.toFixed(2),
            (ci.lo * 100).toFixed(2), (ci.hi * 100).toFixed(2), mean.toFixed(3), mae.toFixed(3),
            Number.isNaN(earlyMean) ? '' : earlyMean.toFixed(3),
            Number.isNaN(lateMean) ? '' : lateMean.toFixed(3),
          ].join(','));
          rows.push({
            scenario: scen.key, mode: mode.key, r, sigma, n: N_TRIALS,
            exact7_pct: +exact7Pct.toFixed(2), ci_lo: +(ci.lo * 100).toFixed(2), ci_hi: +(ci.hi * 100).toFixed(2),
            mean: +mean.toFixed(3), mae: +mae.toFixed(3),
          });
          void rIdx; void modeIdx; void sigIdx;
        }
      }
    }
  }

  writeFileSync(join(OUT_DIR, 'tawaf_scenarios.csv'), csv.join('\n'));

  // Ringkasan markdown: subset terarah (skenario III, r=25 & r=12, mode adaptif, sigma 5/10/15)
  // — daftar lengkap 330 sel ada di CSV, bukan di summary.md (terlalu panjang utk ditampilkan).
  const md: string[] = [];
  md.push('| Skenario | Mode | r (m) | sigma | Tepat-7 (%) | CI95 | Rata2 putaran | MAE |');
  md.push('|---|---|---|---|---|---|---|---|');
  for (const r of [25, 12]) {
    for (const sigma of [5, 10, 15]) {
      const row = rows.find((x) => x.scenario === 'III' && x.mode === 'adaptif' && x.r === r && x.sigma === sigma);
      if (row) md.push(`| III | adaptif | ${r} | ${sigma} | ${row.exact7_pct} | [${row.ci_lo}, ${row.ci_hi}] | ${row.mean} | ${row.mae} |`);
    }
  }
  md.push('');
  md.push(`*${SCENARIOS.length} skenario × ${RADII.length} radius × ${MODES.length} mode × ${SIGMAS.length} sigma = ${cellIdx} sel, ${N_TRIALS} percobaan/sel -> \`results/tawaf_scenarios.csv\` (daftar lengkap).*`);

  return {
    summaryMd: md.join('\n'),
    meta: { scenarios: SCENARIOS.map((s) => s.key), radii: RADII, modes: MODES.map((m) => m.key), sigmas: SIGMAS, trials: N_TRIALS, cells: cellIdx },
  };
}
