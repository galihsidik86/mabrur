/*
 * R4 — Cek analitik vs Monte Carlo, dan kurva batas geofence lingkaran.
 *
 * (a) analytic_check.csv — bandingkan galat klasifikasi hasil MC (sudah dihitung
 *     run.ts §2/§3/§6) dengan formula analitik pendekatan "pita batas":
 *
 *     Miqat (lingkaran R=1000 m, sampel jarak-sebenarnya seragam pada [0,2500] m
 *     — lihat §2): fraksi salah-klasifikasi ≈ E[|noise radial|] / rentang sampel
 *                = 0,7979·sigma / 2500   (0,7979 = sqrt(2/pi) = E|N(0,1)|)
 *
 *     Arafah (poligon, sampel seragam pada kotak — lihat §3): fraksi salah
 *     ≈ 0,7979·sigma · keliling_poligon / luas_kotak_sampel
 *     (analog 1D di atas, diperluas ke kepadatan seragam 2D: pita selebar
 *     0,7979·sigma mengelilingi batas sepanjang keliling).
 *
 *     Jamarat "tak terdeteksi" (radius 30 m, offset jarak-sebenarnya d~U(0,12) m
 *     dari pilar — lihat §6): magnitudo posisi ber-noise |posisi_bersih+noise|
 *     berdistribusi Rice(nu=d, sigma). P(tak terdeteksi | d) = 1 - CDF_Rice(30; d, sigma).
 *     Dirata-ratakan atas d~U(0,12) via integrasi numerik (Simpson, stats.ts).
 *
 * (b) boundary_error_curve.csv — geofence lingkaran R=1000 m (pusat = Miqat
 *     Dzulhulaifah, sembarang, radius representatif Miqat), jarak bertanda
 *     d = jarak_sebenarnya - R (negatif = di dalam), d in {-50,...,50} step 5,
 *     sigma in {3,5,10,15}, 20.000 sampel/sel. Karena R >> sigma, kurvatur
 *     lingkaran diabaikan secara lokal (radial noise ~ proyeksi 1D dari noise
 *     isotropik N(0,sigma) x N(0,sigma) yang dirotasi ke basis radial/tangensial
 *     — rotasi mempertahankan marginal Gaussian iid, jadi komponen radial TETAP
 *     N(0,sigma) persis, bukan hanya aproksimasi) -> P(salah) analitik =
 *     Phi(-|d|/sigma) TERLEPAS dari R (untuk R>>sigma; error kurvatur O(sigma^2/R)
 *     dapat diabaikan pada R=1000, sigma<=15). d99 (jarak agar P(salah)<=1%) =
 *     2,326·sigma (Phi^-1(0,99)=2,326).
 */
import { writeFileSync } from 'fs';
import { join } from 'path';
import { ARAFAH_BOUNDARY, haversine, M_PER_DEG_LAT, mPerDegLng, Rng } from '../sim-core';
import { riceCdf, simpson, polygonPerimeterMeters, boxAreaM2, normalCdf, idDecimal } from '../stats';

export interface AnalyticCtx {
  R: Rng;
  addNoise: (lat: number, lng: number, sigma: number) => { lat: number; lng: number };
  OUT_DIR: string;
  miqatMc: Array<{ sigma: number; akurasi: number }>;
  arafahMc: Array<{ sigma: number; akurasi: number }>;
  jamaratMc: Array<{ sigma: number; takTerdeteksi: number }>;
  arafahBox: { latMin: number; latMax: number; lngMin: number; lngMax: number };
}

const SQRT_2_OVER_PI = 0.7978845608; // E|N(0,1)|
const D99_Z = 2.326348; // Phi^-1(0.99)
const OFFSET_BASE = 40_000_000;

function jamaratUndetectedAnalytic(sigma: number): number {
  if (sigma === 0) return 0; // d<=12<30 -> selalu terdeteksi tanpa noise
  const meanOverD = simpson((d) => 1 - riceCdf(30, d, sigma), 0, 12, 24) / 12;
  return meanOverD;
}

export function runAnalyticChecks(ctx: AnalyticCtx) {
  const { R, OUT_DIR, miqatMc, arafahMc, jamaratMc, arafahBox } = ctx;

  // ---------- (a) analytic_check.csv ----------
  const perimeterArafah = polygonPerimeterMeters(ARAFAH_BOUNDARY, haversine);
  const areaArafahBox = boxAreaM2(
    arafahBox.latMin, arafahBox.latMax, arafahBox.lngMin, arafahBox.lngMax,
    M_PER_DEG_LAT, mPerDegLng,
  );

  const acRows: Array<{ metric: string; sigma: number; mc_pct: number; analytic_pct: number; diff_abs_pct: number }> = [];
  for (const row of miqatMc) {
    const mcErr = 100 - row.akurasi;
    const analyticErr = row.sigma === 0 ? 0 : (SQRT_2_OVER_PI * row.sigma / 2500) * 100;
    acRows.push({ metric: 'miqat_error_rate', sigma: row.sigma, mc_pct: +mcErr.toFixed(3), analytic_pct: +analyticErr.toFixed(3), diff_abs_pct: +Math.abs(mcErr - analyticErr).toFixed(3) });
  }
  for (const row of arafahMc) {
    const mcErr = 100 - row.akurasi;
    const analyticErr = row.sigma === 0 ? 0 : (SQRT_2_OVER_PI * row.sigma * perimeterArafah / areaArafahBox) * 100;
    acRows.push({ metric: 'arafah_error_rate', sigma: row.sigma, mc_pct: +mcErr.toFixed(3), analytic_pct: +analyticErr.toFixed(3), diff_abs_pct: +Math.abs(mcErr - analyticErr).toFixed(3) });
  }
  for (const row of jamaratMc) {
    const analyticPct = jamaratUndetectedAnalytic(row.sigma) * 100;
    acRows.push({ metric: 'jamarat_undetected', sigma: row.sigma, mc_pct: +row.takTerdeteksi.toFixed(3), analytic_pct: +analyticPct.toFixed(3), diff_abs_pct: +Math.abs(row.takTerdeteksi - analyticPct).toFixed(3) });
  }
  const acCsv = ['metric,sigma,mc_pct,analytic_pct,diff_abs_pct', ...acRows.map((r) => `${r.metric},${r.sigma},${r.mc_pct},${r.analytic_pct},${r.diff_abs_pct}`)];
  writeFileSync(join(OUT_DIR, 'analytic_check.csv'), acCsv.join('\n'));

  // ---------- (b) boundary_error_curve.csv ----------
  // CATATAN METODE: dihitung dalam bidang lokal East/North (meter), BUKAN via
  // lat/lng+haversine. Diagnostik awal (placement equirectangular lalu ukur
  // via haversine) menunjukkan bias SISTEMATIK ~1,1-1,4 m antara jarak nominal
  // & jarak haversine aktual pada R=1000 m (artefak proyeksi equirectangular,
  // BUKAN properti geofence) — signifikan relatif thd sigma kecil (3 m) dan
  // merusak validasi pada d=0 (P(salah) MC ~35% alih-alih ~50% yang diharapkan
  // teoretis). Formula analitik Phi(-|d|/sigma) SENDIRI berasumsi bidang datar
  // lokal & noise Gaussian isotropik 2D — jadi MC yang memvalidasinya harus
  // memakai geometri Euclidean 2D yang SAMA (tanpa artefak proyeksi lat/lng),
  // bukan geodesic. RNG (gauss()) tetap sumber yang sama (R.gauss()) demi
  // konsistensi reproduktifitas dgn eksperimen lain.
  const RADIUS = 1000;
  const D_VALUES: number[] = [];
  for (let d = -50; d <= 50; d += 5) D_VALUES.push(d);
  const SIGMAS_B = [3, 5, 10, 15];
  const N_PER_CELL = 20000;
  const bcCsv = ['d,sigma,n,mc_wrong_pct,analytic_wrong_pct,d99_m'];
  let cellIdx = 0;
  for (const d of D_VALUES) {
    for (const sigma of SIGMAS_B) {
      R.reset(OFFSET_BASE + cellIdx * 53); cellIdx++;
      const trueDist = RADIUS + d;
      const truth = trueDist <= RADIUS;
      let wrong = 0;
      for (let i = 0; i < N_PER_CELL; i++) {
        const bearing = R.next() * 2 * Math.PI;
        const px = trueDist * Math.cos(bearing), py = trueDist * Math.sin(bearing);
        const dE = R.gauss() * sigma, dN = R.gauss() * sigma;
        const predDist = Math.hypot(px + dE, py + dN);
        const pred = predDist <= RADIUS;
        if (pred !== truth) wrong++;
      }
      const mcPct = (wrong / N_PER_CELL) * 100;
      const analyticPct = (1 - normalCdf(Math.abs(d) / sigma)) * 100;
      const d99 = D99_Z * sigma;
      bcCsv.push(`${d},${sigma},${N_PER_CELL},${mcPct.toFixed(3)},${analyticPct.toFixed(3)},${d99.toFixed(3)}`);
    }
  }
  writeFileSync(join(OUT_DIR, 'boundary_error_curve.csv'), bcCsv.join('\n'));

  // ---------- ringkasan markdown ----------
  const md: string[] = [];
  md.push('**Analitik vs MC (subset):**');
  md.push('');
  md.push('| Metrik | sigma | MC (%) | Analitik (%) | Selisih |');
  md.push('|---|---|---|---|---|');
  for (const r of acRows.filter((x) => [5, 10, 15].includes(x.sigma))) {
    md.push(`| ${r.metric} | ${r.sigma} | ${idDecimal(r.mc_pct, 3)} | ${idDecimal(r.analytic_pct, 3)} | ${idDecimal(r.diff_abs_pct, 3)} |`);
  }
  md.push('');
  md.push('**Kurva batas (subset d=0, sigma-lihat):**');
  md.push('');
  md.push('| d (m) | sigma | P(salah) MC (%) | Phi(-\\|d\\|/sigma) (%) | d99 (m) |');
  md.push('|---|---|---|---|---|');
  for (const line of bcCsv.slice(1)) {
    const [d, sigma] = line.split(',').map(Number);
    if (d === 0 || d === -20 || d === 20) {
      const [, , , mc, an, d99] = line.split(',');
      md.push(`| ${d} | ${sigma} | ${mc} | ${an} | ${d99} |`);
    }
  }
  md.push('');
  md.push(`*Keliling poligon Arafah = ${perimeterArafah.toFixed(1)} m; luas kotak sampel = ${(areaArafahBox / 1e6).toFixed(3)} km². Kurva batas lengkap (${D_VALUES.length} d x ${SIGMAS_B.length} sigma, ${N_PER_CELL} sampel/sel) -> \`results/boundary_error_curve.csv\`.*`);

  return {
    summaryMd: md.join('\n'),
    meta: {
      perimeter_arafah_m: +perimeterArafah.toFixed(1), area_arafah_box_m2: +areaArafahBox.toFixed(1),
      boundary_d_values: D_VALUES, boundary_sigmas: SIGMAS_B, boundary_n_per_cell: N_PER_CELL,
    },
  };
}
