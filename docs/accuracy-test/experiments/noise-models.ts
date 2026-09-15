/*
 * R6 — Perbandingan model derau GPS: iid (dasar) vs AR(1) per-sumbu berdasarkan
 * data lapangan vs Gauss-Markov (konstanta waktu) vs bias konstan + iid.
 *
 * Semua model dikalibrasi ke sigma MARGINAL yang sama (Var stasioner = sigma^2)
 * agar perbandingan adil — hanya STRUKTUR KORELASI TEMPORAL yang berbeda:
 *   - iid          : draw independen tiap sampel (addNoise biasa).
 *   - ar1_field    : AR(1) per sumbu (Timur, Utara terpisah), rho_3s = rho_1s^3,
 *                    rho_1s dibaca dari results/field_characterization.json
 *                    (rata-rata lag-1 ACF antar semua trace GPX lapangan yang
 *                    ada, sampling asli 1 Hz — lihat CLAUDE.md "Field-validation
 *                    pipeline"). rho_1s^3 karena eksperimen ini sampling 3 dtk =
 *                    3 langkah @ 1 Hz. Timur & Utara punya rho BERBEDA (data
 *                    lapangan: E≈0,63 N≈0,53 pada 1 Hz) — dipertahankan per-sumbu
 *                    (bukan dirata-rata) karena non-isotropik secara nyata.
 *   - gm30 / gm120 : Gauss-Markov isotropik (rho sama kedua sumbu), rho=exp(-3/tau),
 *                    tau={30,120} dtk — dua konstanta waktu berbeda dari data lapangan.
 *   - bias5 / bias10: offset KONSTAN per percobaan (besar b={5,10} m, arah acak
 *                    seragam [0,2pi) sekali per percobaan) + noise iid sigma di atasnya.
 *
 * Diterapkan ke: Tawaf skenario III r=25 (default & adaptif, dari
 * experiments/tawaf-scenarios.ts), Sa'i (o=0,l=0 dan o=20,l=0, dari
 * experiments/sai-scenarios.ts), Jamarat (HANYA iid vs bias — posisi statis,
 * model temporal AR1/GM tidak relevan utk satu titik tunggal tanpa lintasan).
 * sigma in {3,5,10,15}; 500 percobaan (jamarat 4.000/kelas, konsisten dgn §6).
 */
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import {
  KAABAH, M_PER_DEG_LAT, mPerDegLng, TawafTracker, SaiTracker, JAMARAT, detectNearestJamarat, Rng,
} from '../sim-core';
import { makeAR1, gaussMarkovRho, wilson95 } from '../stats';
import { pathStallStartEnd, LAPS } from './tawaf-scenarios';
import { saiTurnPoints } from './sai-scenarios';

export interface NoiseModelCtx {
  R: Rng;
  OUT_DIR: string;
}

const SIGMAS = [3, 5, 10, 15];
const N_TRIALS = 500;
const JAM_PER_CLASS = 4000;
const OFFSET_BASE = 30_000_000;

// ---------- baca korelasi lag-1 dari data lapangan (bukan hardcode) ----------
function readFieldRho1(outDir: string): { east: number; north: number } {
  const path = join(outDir, 'field_characterization.json');
  const raw = JSON.parse(readFileSync(path, 'utf8')) as {
    traces: Record<string, { chr: { east: { lag1: number }; north: { lag1: number } } }>;
  };
  const traces = Object.values(raw.traces);
  const east = traces.reduce((a, t) => a + t.chr.east.lag1, 0) / traces.length;
  const north = traces.reduce((a, t) => a + t.chr.north.lag1, 0) / traces.length;
  return { east, north };
}

// ---------- model derau: factory per-percobaan (state AR1/bias baru tiap trial) ----------
type NoiseFn = (lat: number, lng: number) => { lat: number; lng: number };
type ModelFactory = (sigma: number, gauss: () => number, uniform: () => number) => NoiseFn;

function offsetLatLng(lat: number, lng: number, dEast: number, dNorth: number) {
  return { lat: lat + dNorth / M_PER_DEG_LAT, lng: lng + dEast / mPerDegLng(lat) };
}

const modelIid: ModelFactory = (sigma, gauss) => (lat, lng) => {
  if (sigma === 0) return { lat, lng };
  return offsetLatLng(lat, lng, gauss() * sigma, gauss() * sigma);
};

function modelAr1(rhoE: number, rhoN: number): ModelFactory {
  return (sigma, gauss) => {
    const nextE = makeAR1(rhoE, sigma, gauss);
    const nextN = makeAR1(rhoN, sigma, gauss);
    return (lat, lng) => offsetLatLng(lat, lng, nextE(), nextN());
  };
}

function modelBias(b: number): ModelFactory {
  return (sigma, gauss, uniform) => {
    const theta = uniform() * 2 * Math.PI;
    const biasE = b * Math.cos(theta), biasN = b * Math.sin(theta);
    return (lat, lng) => offsetLatLng(lat, lng, biasE + gauss() * sigma, biasN + gauss() * sigma);
  };
}

export function runNoiseModels(ctx: NoiseModelCtx) {
  const { R, OUT_DIR } = ctx;
  const fieldRho1 = readFieldRho1(OUT_DIR);
  const rho3sE = fieldRho1.east ** 3, rho3sN = fieldRho1.north ** 3;

  const models: Array<{ key: string; label: string; factory: ModelFactory }> = [
    { key: 'iid', label: 'iid (dasar)', factory: modelIid },
    { key: 'ar1_field', label: `AR(1) lapangan (rho3s E=${rho3sE.toFixed(3)}, N=${rho3sN.toFixed(3)})`, factory: modelAr1(rho3sE, rho3sN) },
    { key: 'gm30', label: 'Gauss-Markov tau=30s', factory: modelAr1(gaussMarkovRho(3, 30), gaussMarkovRho(3, 30)) },
    { key: 'gm120', label: 'Gauss-Markov tau=120s', factory: modelAr1(gaussMarkovRho(3, 120), gaussMarkovRho(3, 120)) },
    { key: 'bias5', label: 'Bias 5 m + iid', factory: modelBias(5) },
    { key: 'bias10', label: 'Bias 10 m + iid', factory: modelBias(10) },
  ];
  const jamaratModels = models.filter((m) => m.key === 'iid' || m.key === 'bias5' || m.key === 'bias10');

  const csv = ['target,model,sigma,n,metric,value'];
  let cellIdx = 0;
  const push = (target: string, model: string, sigma: number, n: number, metric: string, value: number) => {
    csv.push(`${target},${model},${sigma},${n},${metric},${value}`);
  };

  // ---------- Tawaf skenario III r=25, default & adaptif ----------
  for (const mode of [{ key: 'default', adaptive: false }, { key: 'adaptif', adaptive: true }]) {
    for (const model of models) {
      for (const sigma of SIGMAS) {
        R.reset(OFFSET_BASE + cellIdx * 97); cellIdx++;
        let exact = 0, sum = 0, sumAbsErr = 0;
        for (let tr = 0; tr < N_TRIALS; tr++) {
          const path = pathStallStartEnd(25);
          const noiseFn = model.factory(sigma, () => R.gauss(), () => R.next());
          const tk = new TawafTracker({ adaptive: mode.adaptive });
          for (const p of path) {
            const nz = noiseFn(p.lat, p.lng);
            tk.update(nz.lat, nz.lng, p.t);
          }
          const rounds = tk.getRounds();
          sum += rounds; if (rounds === LAPS) exact++;
          sumAbsErr += Math.abs(rounds - LAPS);
        }
        const target = `tawaf_III_r25_${mode.key}`;
        push(target, model.key, sigma, N_TRIALS, 'exact7_pct', +((exact / N_TRIALS) * 100).toFixed(2));
        push(target, model.key, sigma, N_TRIALS, 'mean', +(sum / N_TRIALS).toFixed(3));
        push(target, model.key, sigma, N_TRIALS, 'mae', +(sumAbsErr / N_TRIALS).toFixed(3));
        const ci = wilson95(exact, N_TRIALS);
        push(target, model.key, sigma, N_TRIALS, 'ci_lo', +(ci.lo * 100).toFixed(2));
        push(target, model.key, sigma, N_TRIALS, 'ci_hi', +(ci.hi * 100).toFixed(2));
      }
    }
  }

  // ---------- Sa'i o=0,l=0 dan o=20,l=0 ----------
  for (const o of [0, 20]) {
    const { safaPt, marwahPt } = saiTurnPoints(o, 0);
    for (const model of models) {
      for (const sigma of SIGMAS) {
        R.reset(OFFSET_BASE + cellIdx * 97); cellIdx++;
        let exact = 0, sum = 0, sumAbsErr = 0;
        for (let tr = 0; tr < N_TRIALS; tr++) {
          const noiseFn = model.factory(sigma, () => R.gauss(), () => R.next());
          const tk = new SaiTracker();
          for (let leg = 0; leg < 7; leg++) {
            const src = leg % 2 === 0 ? safaPt : marwahPt;
            const dst = leg % 2 === 0 ? marwahPt : safaPt;
            const legTime = 400 + R.next() * 80;
            const steps = Math.max(1, Math.round(legTime / 3));
            for (let s = 0; s < steps; s++) {
              const f = s / steps;
              const nz = noiseFn(src.lat + (dst.lat - src.lat) * f, src.lng + (dst.lng - src.lng) * f);
              tk.update(nz.lat, nz.lng);
            }
          }
          const legs = tk.getLegs();
          sum += legs; if (legs === 7) exact++;
          sumAbsErr += Math.abs(legs - 7);
        }
        const target = `sai_o${o}_l0`;
        push(target, model.key, sigma, N_TRIALS, 'exact7_pct', +((exact / N_TRIALS) * 100).toFixed(2));
        push(target, model.key, sigma, N_TRIALS, 'mean', +(sum / N_TRIALS).toFixed(3));
        push(target, model.key, sigma, N_TRIALS, 'mae', +(sumAbsErr / N_TRIALS).toFixed(3));
        const ci = wilson95(exact, N_TRIALS);
        push(target, model.key, sigma, N_TRIALS, 'ci_lo', +(ci.lo * 100).toFixed(2));
        push(target, model.key, sigma, N_TRIALS, 'ci_hi', +(ci.hi * 100).toFixed(2));
      }
    }
  }

  // ---------- Jamarat: iid vs bias (titik statis) ----------
  const jamKeys = ['ula', 'wustha', 'aqabah'] as const;
  for (const model of jamaratModels) {
    for (const sigma of SIGMAS) {
      R.reset(OFFSET_BASE + cellIdx * 97); cellIdx++;
      let correct = 0, wrong = 0, none = 0, total = 0;
      for (const truth of jamKeys) {
        const pillar = JAMARAT[truth];
        for (let i = 0; i < JAM_PER_CLASS; i++) {
          const d = R.next() * 12;
          const bearing = R.next() * 2 * Math.PI;
          const lat = pillar.lat + (d * Math.cos(bearing)) / M_PER_DEG_LAT;
          const lng = pillar.lng + (d * Math.sin(bearing)) / mPerDegLng(pillar.lat);
          const noiseFn = model.factory(sigma, () => R.gauss(), () => R.next());
          const nz = noiseFn(lat, lng);
          const pred = detectNearestJamarat(nz.lat, nz.lng);
          total++;
          if (pred === null) none++; else if (pred.key === truth) correct++; else wrong++;
        }
      }
      const target = 'jamarat';
      push(target, model.key, sigma, total, 'benar', +((correct / total) * 100).toFixed(2));
      push(target, model.key, sigma, total, 'salahPilar', +((wrong / total) * 100).toFixed(2));
      push(target, model.key, sigma, total, 'takTerdeteksi', +((none / total) * 100).toFixed(2));
    }
  }

  writeFileSync(join(OUT_DIR, 'noise_models.csv'), csv.join('\n'));

  const md: string[] = [];
  md.push('| Target | Model | sigma | Metrik | Nilai |');
  md.push('|---|---|---|---|---|');
  // ambil baris sigma=10 utk target x model kunci secara terprogram dari csv yang sudah ditulis
  const parsed = csv.slice(1).map((r) => {
    const [target, model, sigma, n, metric, value] = r.split(',');
    return { target, model, sigma: +sigma, n: +n, metric, value: +value };
  });
  for (const target of ['tawaf_III_r25_adaptif', 'sai_o0_l0']) {
    for (const model of ['iid', 'ar1_field', 'bias10']) {
      const row = parsed.find((p) => p.target === target && p.model === model && p.sigma === 10 && p.metric === 'exact7_pct');
      if (row) md.push(`| ${target} | ${model} | 10 | exact7_pct | ${row.value} |`);
    }
  }
  for (const model of ['iid', 'bias10']) {
    const row = parsed.find((p) => p.target === 'jamarat' && p.model === model && p.sigma === 10 && p.metric === 'takTerdeteksi');
    if (row) md.push(`| jamarat | ${model} | 10 | takTerdeteksi | ${row.value} |`);
  }
  md.push('');
  md.push(`*rho_1s lapangan (rata-rata antar trace, field_characterization.json): E=${fieldRho1.east.toFixed(4)}, N=${fieldRho1.north.toFixed(4)} -> rho_3s = rho_1s^3: E=${rho3sE.toFixed(4)}, N=${rho3sN.toFixed(4)}.*`);
  md.push(`*${models.length} model x {tawaf III r25 default+adaptif, sai o0/o20} x ${SIGMAS.length} sigma, + ${jamaratModels.length} model x jamarat x ${SIGMAS.length} sigma = ${cellIdx} sel, ${N_TRIALS} percobaan/sel (jamarat ${JAM_PER_CLASS}/kelas) -> \`results/noise_models.csv\`.*`);

  return {
    summaryMd: md.join('\n'),
    meta: {
      models: models.map((m) => m.key), sigmas: SIGMAS, trials: N_TRIALS,
      field_rho1: fieldRho1, rho3s: { east: rho3sE, north: rho3sN }, cells: cellIdx,
    },
  };
}
