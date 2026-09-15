/*
 * R9 — Skenario Sa'i tambahan: sensitivitas titik balik (jamaah berhenti SEBELUM
 * mencapai Safa/Marwah persis) & pergeseran lateral koridor, terhadap noise GPS.
 *
 * Geometri (bidang tangen lokal berpusat di SAFA, proyeksi ekuirektangular —
 * memadai untuk skala koridor ~377 m, koordinat OSM revisi 2026-09-15):
 *   u = vektor satuan SAFA->MARWAH (arah koridor)
 *   v = vektor satuan tegak lurus u (diputar 90° CCW: v=(-u_N, u_E)); SISI
 *       (kiri/kanan koridor) yang dipilih arbitrer — hanya BESAR pergeseran
 *       yang relevan bagi radius deteksi (isotropik, tidak bergantung sisi).
 *   Titik balik sisi-Safa   = SAFA   + o·u + l·v   (berhenti o m SEBELUM Safa,
 *                                                    diukur sepanjang koridor)
 *   Titik balik sisi-Marwah = SAFA + (Lc-o)·u + l·v (berhenti o m SEBELUM Marwah)
 *   dengan Lc = panjang koridor (≈377 m, dihitung dari koordinat SAFA/MARWAH).
 * Titik mulai (sebelum leg pertama) SAMA DENGAN titik balik sisi-Safa (jadi ikut
 * bergeser oleh o & l, sesuai instruksi "termasuk titik mulai di sisi Safa").
 * Jarak dari titik balik ke pilar sebenarnya = sqrt(o^2 + l^2); SaiTracker hanya
 * mendeteksi zona dalam radius 25 m dari SAFA/MARWAH (sacred-zones-core.ts) —
 * jika sqrt(o^2+l^2) > 25 m, zona TIDAK PERNAH terdeteksi walau tanpa noise
 * (kasus batas yang disengaja untuk menguji kegagalan pendekatan berbasis zona).
 *
 * 7 leg berselang-seling (Safa-stop -> Marwah-stop -> ... , 7 leg, mulai &
 * berakhir di sisi berlawanan seperti Sa'i asli). Lama leg acak 400–480 dtk
 * (sama seperti saiPath() utama di run.ts), sampling 3 dtk.
 */
import { writeFileSync } from 'fs';
import { join } from 'path';
import { SAFA, MARWAH, M_PER_DEG_LAT, mPerDegLng, SaiTracker, Rng } from '../sim-core';
import { wilson95 } from '../stats';

export interface SaiScenarioCtx {
  R: Rng;
  addNoise: (lat: number, lng: number, sigma: number) => { lat: number; lng: number };
  OUT_DIR: string;
}

const O_VALUES = [0, 10, 20, 25, 30];
const L_VALUES = [0, 10, 20];
const SIGMAS = [0, 1, 3, 5, 10, 15];
const N_TRIALS = 500;
const DT = 3;
const OFFSET_BASE = 20_000_000;

// Vektor koridor lokal (meter), pusat proyeksi = SAFA.
const dEsm = (MARWAH.lng - SAFA.lng) * mPerDegLng(SAFA.lat);
const dNsm = (MARWAH.lat - SAFA.lat) * M_PER_DEG_LAT;
const Lc = Math.hypot(dEsm, dNsm);
const uE = dEsm / Lc, uN = dNsm / Lc;
const vE = -uN, vN = uE; // tegak lurus, satuan

function localToLatLng(dE: number, dN: number): { lat: number; lng: number } {
  return { lat: SAFA.lat + dN / M_PER_DEG_LAT, lng: SAFA.lng + dE / mPerDegLng(SAFA.lat) };
}

function turnPoint(arcLen: number, l: number): { lat: number; lng: number } {
  const dE = arcLen * uE + l * vE;
  const dN = arcLen * uN + l * vN;
  return localToLatLng(dE, dN);
}

/** Dipakai ulang oleh experiments/noise-models.ts (R6, Sa'i o=0/20, l=0). */
export function saiTurnPoints(o: number, l: number): { safaPt: { lat: number; lng: number }; marwahPt: { lat: number; lng: number } } {
  return { safaPt: turnPoint(o, l), marwahPt: turnPoint(Lc - o, l) };
}

export function runSaiScenarios(ctx: SaiScenarioCtx) {
  const { R, addNoise, OUT_DIR } = ctx;
  const csv = ['o,l,sigma,n,exact7_pct,ci_lo,ci_hi,mean,mae'];
  const rows: Array<Record<string, number>> = [];
  let cellIdx = 0;

  for (const o of O_VALUES) {
    for (const l of L_VALUES) {
      const safaPt = turnPoint(o, l);
      const marwahPt = turnPoint(Lc - o, l);
      for (const sigma of SIGMAS) {
        const offset = OFFSET_BASE + cellIdx * 131;
        cellIdx++;
        R.reset(offset);
        let exact = 0, sum = 0, sumAbsErr = 0;
        for (let tr = 0; tr < N_TRIALS; tr++) {
          const tk = new SaiTracker();
          for (let leg = 0; leg < 7; leg++) {
            const src = leg % 2 === 0 ? safaPt : marwahPt;
            const dst = leg % 2 === 0 ? marwahPt : safaPt;
            const legTime = 400 + R.next() * 80;
            const steps = Math.max(1, Math.round(legTime / DT));
            for (let s = 0; s < steps; s++) {
              const f = s / steps;
              const lat = src.lat + (dst.lat - src.lat) * f;
              const lng = src.lng + (dst.lng - src.lng) * f;
              const nz = addNoise(lat, lng, sigma);
              tk.update(nz.lat, nz.lng);
            }
          }
          // titik akhir tepat di titik balik terakhir (tanpa noise tambahan; konsisten dgn saiPath() utama)
          const finalPt = 6 % 2 === 0 ? marwahPt : safaPt; // leg index 6 (leg ke-7) src=safaPt(genap) dst=marwahPt
          const nzFinal = addNoise(finalPt.lat, finalPt.lng, sigma);
          tk.update(nzFinal.lat, nzFinal.lng);
          const legs = tk.getLegs();
          sum += legs; if (legs === 7) exact++;
          sumAbsErr += Math.abs(legs - 7);
        }
        const mean = sum / N_TRIALS, mae = sumAbsErr / N_TRIALS;
        const exact7Pct = (exact / N_TRIALS) * 100;
        const ci = wilson95(exact, N_TRIALS);
        csv.push([o, l, sigma, N_TRIALS, exact7Pct.toFixed(2), (ci.lo * 100).toFixed(2), (ci.hi * 100).toFixed(2), mean.toFixed(3), mae.toFixed(3)].join(','));
        rows.push({ o, l, sigma, exact7_pct: +exact7Pct.toFixed(2), ci_lo: +(ci.lo * 100).toFixed(2), ci_hi: +(ci.hi * 100).toFixed(2), mean: +mean.toFixed(3), mae: +mae.toFixed(3) });
      }
    }
  }

  writeFileSync(join(OUT_DIR, 'sai_scenarios.csv'), csv.join('\n'));

  const md: string[] = [];
  md.push('| o (m) | l (m) | sigma | Tepat-7 (%) | CI95 | Rata2 leg | MAE |');
  md.push('|---|---|---|---|---|---|---|');
  for (const o of [0, 20, 25, 30]) {
    for (const sigma of [5, 15]) {
      const row = rows.find((x) => x.o === o && x.l === 0 && x.sigma === sigma);
      if (row) md.push(`| ${o} | 0 | ${sigma} | ${row.exact7_pct} | [${row.ci_lo}, ${row.ci_hi}] | ${row.mean} | ${row.mae} |`);
    }
  }
  md.push('');
  md.push(`*Jarak-lurus SAFA-MARWAH terpakai (Lc) = ${Lc.toFixed(1)} m. sqrt(o²+l²) > 25 m → zona tidak pernah terdeteksi (lihat kolom exact7_pct=0 pada baris terkait di CSV).*`);
  md.push(`*${O_VALUES.length} o × ${L_VALUES.length} l × ${SIGMAS.length} sigma = ${cellIdx} sel, ${N_TRIALS} percobaan/sel -> \`results/sai_scenarios.csv\` (daftar lengkap).*`);

  return {
    summaryMd: md.join('\n'),
    meta: { o_values: O_VALUES, l_values: L_VALUES, sigmas: SIGMAS, trials: N_TRIALS, cells: cellIdx, corridor_length_m: +Lc.toFixed(1) },
  };
}
