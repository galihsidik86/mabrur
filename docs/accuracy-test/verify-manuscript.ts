/*
 * Verifikasi hasil simulasi terhadap angka naskah jurnal (Tabel 3-9).
 *
 *   npm run simulate            (run.ts lalu script ini)
 *   npx tsx docs/accuracy-test/verify-manuscript.ts
 *
 * Masukan : results/monte_carlo_results.json (ditulis run.ts)
 * Keluaran: results/TABLES.md          — tabel format naskah (desimal koma)
 *           results/MANUSCRIPT_DIFF.md — laporan per-sel COCOK/BEDA
 * Exit code 1 bila ada sel BEDA. Angka naskah di bawah adalah PEMBANDING,
 * bukan target penyetelan — jangan pernah mengubah kode simulasi agar cocok.
 */
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const DIR = join(__dirname, 'results');
const TOL = 0.01; // |kode - naskah| < 0,01 => COCOK; sel bilangan bulat: sama persis

// ==================== ANGKA ACUAN NASKAH (Tabel 3-9) ====================

const NASKAH = {
  geometry: { safa_marwah_m: 419.0, jamarat_ula_wustha_m: 76.0, jamarat_wustha_aqabah_m: 68.2, jamarat_ula_aqabah_m: 144.0 },
  haversine: {
    lokal: { mae: 0.649, rmse: 0.811, meanPct: 0.2, maxPct: 0.4267 },
    miqat: { mae: 521.533, rmse: 675.987, meanPct: 0.2654, maxPct: 0.427 },
  },
  miqat: [
    { sigma: 0, akurasi: 100, presisi: 100, recall: 100, f1: 100 },
    { sigma: 1, akurasi: 100, presisi: 100, recall: 100, f1: 100 },
    { sigma: 3, akurasi: 99.92, presisi: 99.87, recall: 99.94, f1: 99.91 },
    { sigma: 5, akurasi: 99.81, presisi: 99.68, recall: 99.84, f1: 99.76 },
    { sigma: 10, akurasi: 99.69, presisi: 99.59, recall: 99.62, f1: 99.61 },
    { sigma: 15, akurasi: 99.45, presisi: 99.49, recall: 99.11, f1: 99.3 },
  ],
  arafah: [
    { sigma: 0, akurasi: 100, presisi: 100, recall: 100, f1: 100 },
    { sigma: 1, akurasi: 99.98, presisi: 100, recall: 99.96, f1: 99.98 },
    { sigma: 3, akurasi: 99.95, presisi: 99.99, recall: 99.93, f1: 99.96 },
    { sigma: 5, akurasi: 99.84, presisi: 99.82, recall: 99.9, f1: 99.86 },
    { sigma: 10, akurasi: 99.63, presisi: 99.68, recall: 99.68, f1: 99.68 },
    { sigma: 15, akurasi: 99.44, presisi: 99.48, recall: 99.55, f1: 99.52 },
  ],
  tawaf: [
    { sigma: 0, mean: 7, exact7: 100, mae: 0, rmse: 0 },
    { sigma: 1, mean: 7, exact7: 100, mae: 0, rmse: 0 },
    { sigma: 3, mean: 7, exact7: 100, mae: 0, rmse: 0 },
    { sigma: 5, mean: 7, exact7: 100, mae: 0, rmse: 0 },
    { sigma: 10, mean: 7, exact7: 100, mae: 0, rmse: 0 },
    { sigma: 15, mean: 7.31, exact7: 72.67, mae: 0.313, rmse: 0.632 },
  ],
  sai: [0, 1, 3, 5, 10, 15].map((sigma) => ({ sigma, mean: 7, exact7: 100, mae: 0, rmse: 0 })),
  jamarat: [
    { sigma: 0, benar: 100, salahPilar: 0, takTerdeteksi: 0 },
    { sigma: 1, benar: 100, salahPilar: 0, takTerdeteksi: 0 },
    { sigma: 3, benar: 100, salahPilar: 0, takTerdeteksi: 0 },
    { sigma: 5, benar: 100, salahPilar: 0, takTerdeteksi: 0 },
    { sigma: 10, benar: 97.31, salahPilar: 0.03, takTerdeteksi: 2.67 },
    { sigma: 15, benar: 83.53, salahPilar: 0.32, takTerdeteksi: 16.15 },
  ],
  jamarat_confusion_sigma15: {
    ula: { ula: 3328, wustha: 4, aqabah: 0, none: 668 },
    wustha: { ula: 2, wustha: 3364, aqabah: 18, none: 616 },
    aqabah: { ula: 0, wustha: 14, aqabah: 3332, none: 654 },
  },
};

// ==================== MUAT HASIL KODE ====================

const K = JSON.parse(readFileSync(join(DIR, 'monte_carlo_results.json'), 'utf8'));

// ==================== PEMBANDINGAN ====================

interface Cell { tabel: string; sel: string; kode: number; naskah: number; exact: boolean; }
const cells: Cell[] = [];
function cmp(tabel: string, sel: string, kode: number, naskah: number, exact = false) {
  cells.push({ tabel, sel, kode, naskah, exact });
}

// Tabel 2 (geometri — bonus di luar acuan A-F, tercantum di naskah)
for (const k of Object.keys(NASKAH.geometry) as Array<keyof typeof NASKAH.geometry>) {
  cmp('Tabel 2 (geometri)', k, K.geometry[k], NASKAH.geometry[k]);
}
// Tabel 3 (haversine)
for (const scen of ['lokal', 'miqat'] as const) {
  for (const m of ['mae', 'rmse', 'meanPct', 'maxPct'] as const) {
    cmp('Tabel 3 (Haversine)', `${scen}.${m}`, K.haversine[scen][m], NASKAH.haversine[scen][m]);
  }
}
// Tabel 4-5 (miqat, arafah)
for (const [tabel, key] of [['Tabel 4 (Miqat)', 'miqat'], ['Tabel 5 (Arafah)', 'arafah']] as const) {
  NASKAH[key].forEach((row, i) => {
    for (const m of ['akurasi', 'presisi', 'recall', 'f1'] as const) {
      cmp(tabel, `sigma=${row.sigma} ${m}`, K[key][i][m], row[m]);
    }
  });
}
// Tabel 6-7 (tawaf, sai)
for (const [tabel, key] of [['Tabel 6 (Tawaf)', 'tawaf'], ["Tabel 7 (Sa'i)", 'sai']] as const) {
  NASKAH[key].forEach((row, i) => {
    for (const m of ['mean', 'exact7', 'mae', 'rmse'] as const) {
      cmp(tabel, `sigma=${row.sigma} ${m}`, K[key][i][m], row[m]);
    }
  });
}
// Tabel 8 (jamarat)
NASKAH.jamarat.forEach((row, i) => {
  for (const m of ['benar', 'salahPilar', 'takTerdeteksi'] as const) {
    cmp('Tabel 8 (Jamarat)', `sigma=${row.sigma} ${m}`, K.jamarat[i][m], row[m]);
  }
});
// Tabel 9 (confusion matrix, bilangan bulat -> sama persis)
for (const truth of ['ula', 'wustha', 'aqabah'] as const) {
  for (const pred of ['ula', 'wustha', 'aqabah', 'none'] as const) {
    cmp('Tabel 9 (Confusion)', `${truth}->${pred}`,
      K.jamarat_confusion_sigma15[truth][pred], NASKAH.jamarat_confusion_sigma15[truth][pred], true);
  }
}

const beda = cells.filter((c) =>
  c.exact ? c.kode !== c.naskah : Math.abs(c.kode - c.naskah) >= TOL);

// ==================== TABLES.md (format naskah, desimal koma) ====================

const id = (v: number, dec?: number) =>
  (dec !== undefined ? v.toFixed(dec) : String(v)).replace('.', ',');
const T: string[] = [];
T.push('# Tabel Hasil Simulasi (format naskah)');
T.push('');
T.push(`> Dihasilkan otomatis oleh \`verify-manuscript.ts\` dari \`monte_carlo_results.json\` (seed=${K.meta.seed}).`);
T.push('');
T.push('**Tabel 3.** Galat Haversine dibandingkan dengan Model Elipsoid Vincenty');
T.push('');
T.push('| Skenario jarak | MAE (m) | RMSE (m) | Error rata-rata (%) | Error maks (%) |');
T.push('|---|---|---|---|---|');
T.push(`| Lokal Masjidil Haram (0–0,5 km) | ${id(K.haversine.lokal.mae, 3)} | ${id(K.haversine.lokal.rmse, 3)} | ${id(K.haversine.lokal.meanPct, 4)} | ${id(K.haversine.lokal.maxPct, 4)} |`);
T.push(`| Skala Miqat (10–450 km) | ${id(K.haversine.miqat.mae, 3)} | ${id(K.haversine.miqat.rmse, 3)} | ${id(K.haversine.miqat.meanPct, 4)} | ${id(K.haversine.miqat.maxPct, 4)} |`);
T.push('');
for (const [judul, key] of [
  ['**Tabel 4.** Akurasi Klasifikasi Geofence Miqat (Radius Deteksi 1.000 m)', 'miqat'],
  ['**Tabel 5.** Akurasi Klasifikasi Poligon Wilayah Arafah (Ray Casting)', 'arafah'],
] as const) {
  T.push(judul); T.push('');
  T.push('| σ (m) | Akurasi (%) | Presisi (%) | Recall (%) | F1 (%) |');
  T.push('|---|---|---|---|---|');
  for (const r of K[key]) T.push(`| ${r.sigma} | ${id(r.akurasi, 2)} | ${id(r.presisi, 2)} | ${id(r.recall, 2)} | ${id(r.f1, 2)} |`);
  T.push('');
}
for (const [judul, key, satuan] of [
  ['**Tabel 6.** Performa Akurasi Penghitung Putaran Tawaf (Target = 7 Putaran)', 'tawaf', 'putaran'],
  ["**Tabel 7.** Performa Akurasi Penghitung Lintasan Sa'i (Target = 7 Lintasan)", 'sai', 'lintasan'],
] as const) {
  T.push(judul); T.push('');
  T.push(`| σ (m) | Rata-rata ${satuan} | Akurasi tepat-7 (%) | MAE | RMSE |`);
  T.push('|---|---|---|---|---|');
  for (const r of K[key]) T.push(`| ${r.sigma} | ${id(r.mean, 2)} | ${id(r.exact7, 2)} | ${id(r.mae, 3)} | ${id(r.rmse, 3)} |`);
  T.push('');
}
T.push('**Tabel 8.** Akurasi Identifikasi Pilar Jamarat (Klasifikasi Spasial Multi-Kelas)');
T.push('');
T.push('| σ (m) | Akurasi benar (%) | Salah pilar (%) | Tak terdeteksi (%) |');
T.push('|---|---|---|---|');
for (const r of K.jamarat) T.push(`| ${r.sigma} | ${id(r.benar, 2)} | ${id(r.salahPilar, 2)} | ${id(r.takTerdeteksi, 2)} |`);
T.push('');
T.push('**Tabel 9.** Confusion Matrix Klasifikasi Jamarat pada Tingkat Derau Ekstrem (σ = 15 m)');
T.push('');
T.push('| Sebenarnya \\ Prediksi | Ula | Wustha | Aqabah | Tak terdeteksi |');
T.push('|---|---|---|---|---|');
for (const truth of ['ula', 'wustha', 'aqabah'] as const) {
  const c = K.jamarat_confusion_sigma15[truth];
  const nama = { ula: 'Ula', wustha: 'Wustha', aqabah: 'Aqabah' }[truth];
  T.push(`| **${nama}** | ${c.ula} | ${c.wustha} | ${c.aqabah} | ${c.none} |`);
}
T.push('');
writeFileSync(join(DIR, 'TABLES.md'), T.join('\n') + '\n');

// ==================== MANUSCRIPT_DIFF.md ====================

const D: string[] = [];
D.push('# Laporan Verifikasi: Hasil Kode vs Angka Naskah');
D.push('');
D.push(`- Toleransi sel desimal: |kode − naskah| < ${id(TOL)} (sel bilangan bulat: harus sama persis)`);
D.push(`- Seed: mulberry32(${K.meta.seed}) | sigma: {${(K.meta.sigmas_m as number[]).join(', ')}} m`);
D.push(`- Total sel dibandingkan: ${cells.length} | COCOK: ${cells.length - beda.length} | BEDA: ${beda.length}`);
D.push('');
D.push(`## ${beda.length === 0 ? 'STATUS: SEMUA COCOK ✔' : 'STATUS: ADA PERBEDAAN ✘'}`);
D.push('');
if (beda.length > 0) {
  D.push('| Tabel | Sel | Nilai kode | Nilai naskah | Selisih |');
  D.push('|---|---|---|---|---|');
  for (const c of beda) {
    D.push(`| ${c.tabel} | ${c.sel} | ${id(c.kode)} | ${id(c.naskah)} | ${id(Math.abs(c.kode - c.naskah), 4)} |`);
  }
  D.push('');
  D.push('> Telusuri penyebab (versi kode? seed? jumlah sampel? platform?) sebelum menyimpulkan.');
  D.push('> JANGAN mengubah kode simulasi untuk memaksa kecocokan.');
  D.push('');
}
D.push('## Rincian per tabel');
D.push('');
let cur = '';
for (const c of cells) {
  if (c.tabel !== cur) {
    cur = c.tabel;
    D.push(`### ${cur}`);
    D.push('');
    D.push('| Sel | Kode | Naskah | Status |');
    D.push('|---|---|---|---|');
  }
  const ok = c.exact ? c.kode === c.naskah : Math.abs(c.kode - c.naskah) < TOL;
  D.push(`| ${c.sel} | ${id(c.kode)} | ${id(c.naskah)} | ${ok ? 'COCOK' : '**BEDA**'} |`);
  if (cells[cells.indexOf(c) + 1]?.tabel !== cur) D.push('');
}
writeFileSync(join(DIR, 'MANUSCRIPT_DIFF.md'), D.join('\n') + '\n');

// ==================== KONSOL ====================

console.log(`Verifikasi naskah: ${cells.length} sel | COCOK ${cells.length - beda.length} | BEDA ${beda.length}`);
if (beda.length > 0) {
  for (const c of beda) console.log(`  BEDA  ${c.tabel} ${c.sel}: kode=${c.kode} naskah=${c.naskah}`);
  console.log('-> results/MANUSCRIPT_DIFF.md untuk rincian. Exit 1.');
  process.exit(1);
}
console.log('-> results/TABLES.md + results/MANUSCRIPT_DIFF.md ditulis. SEMUA COCOK.');
