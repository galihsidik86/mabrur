/*
 * Perakit results/FIELD_VALIDATION.md — per trace: ringkasan parse,
 * karakterisasi derau, hasil replay, dan banding side-by-side dengan prediksi
 * simulasi Monte Carlo pada sigma efektif terdekat (monte_carlo_results.json).
 */
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { ParseReport } from './parser';
import type { NoiseCharacterization } from './characterize';
import type { TraceReplayResults } from './replay';

export interface TraceReportInput {
  name: string;
  file: string;
  parse: ParseReport;
  chr: NoiseCharacterization;
  replay: TraceReplayResults;
  figures: string[]; // nama file PNG
}

const id = (v: number, d = 2) => v.toFixed(d).replace('.', ',');

interface McRow { sigma: number; [k: string]: number; }
function nearestSigmaRow(rows: McRow[], sigmaEff: number): McRow {
  return rows.reduce((a, b) => (Math.abs(b.sigma - sigmaEff) < Math.abs(a.sigma - sigmaEff) ? b : a));
}

export function buildFieldReport(traces: TraceReportInput[], demo: boolean, resultsDir: string): string {
  const mc = JSON.parse(readFileSync(join(resultsDir, 'monte_carlo_results.json'), 'utf8'));
  const L: string[] = [];

  L.push('# Validasi Lapangan — Replay Trace GPS ke Algoritma Produksi');
  L.push('');
  if (demo) {
    L.push('> ⚠️ **DATA DEMO SINTETIS.** Laporan ini dihasilkan dari fixture pembuktian pipeline,');
    L.push('> BUKAN dari rekaman GPS lapangan. **Dilarang mengutip angka laporan ini di naskah.**');
    L.push('> Rekam trace riil (lihat `field_logs/README.md`), lalu jalankan ulang `npm run replay`.');
    L.push('');
  }
  L.push(`Trace diproses: ${traces.length}. Algoritma dipanggil langsung dari modul produksi`);
  L.push('`apps/mobile/src/services/sacred-zones-core.ts` (bukan salinan). Metodologi & asumsi');
  L.push('georeferensi ulang: `gps-replay/README.md`.');
  L.push('');

  for (const t of traces) {
    L.push(`## Trace: \`${t.file}\``);
    L.push('');
    // --- parse summary ---
    const p = t.parse;
    const accInfo = p.accuracyAvailable
      ? `tersedia (sumber: ${p.accuracySource}${p.accuracySource === 'hdop' ? ' — proksi, bukan meter sejati' : ''})`
      : 'tidak tersedia';
    L.push(`Titik: ${p.points.length} | dibuang: ${p.dropped.invalid} tak valid, ${p.dropped.duplicate} duplikat | ` +
      `loncatan waktu >10 dtk: ${p.gaps.length} | akurasi pelaporan perangkat: ${accInfo}`);
    L.push('');
    // --- karakterisasi ---
    const c = t.chr;
    L.push('### Karakterisasi derau empiris');
    L.push('');
    L.push('| Besaran | East | North |');
    L.push('|---|---|---|');
    L.push(`| σ per sumbu (m) | ${id(c.east.sigma)} | ${id(c.north.sigma)} |`);
    L.push(`| Skewness | ${id(c.east.skewness, 3)} | ${id(c.north.skewness, 3)} |`);
    L.push(`| Kurtosis (excess) | ${id(c.east.kurtosisExcess, 3)} | ${id(c.north.kurtosisExcess, 3)} |`);
    L.push(`| Jarque–Bera (p) | ${c.east.jbPValue.toExponential(2)} | ${c.north.jbPValue.toExponential(2)} |`);
    L.push(`| ACF lag-1 ρ | ${id(c.east.lag1, 3)} | ${id(c.north.lag1, 3)} |`);
    L.push(`| Lag dekorrelasi (ρ<0,2) | ${c.east.decorrelationLag} | ${c.north.decorrelationLag} |`);
    L.push('');
    L.push(`σ efektif (setara σ per-sumbu simulasi): **${id(c.sigmaEffective)} m** | ` +
      `rasio isotropi σE/σN: ${id(c.isotropyRatio)} | galat radial rata-rata: ${id(c.sigmaRadialMean)} m`);
    L.push('');
    L.push(`**Vonis vs asumsi simulasi (Gaussian isotropik i.i.d.):** ${c.verdict}`);
    L.push('');
    // --- replay vs MC ---
    const near = {
      miqat: nearestSigmaRow(mc.miqat, c.sigmaEffective),
      arafah: nearestSigmaRow(mc.arafah, c.sigmaEffective),
      tawaf: nearestSigmaRow(mc.tawaf, c.sigmaEffective),
      sai: nearestSigmaRow(mc.sai, c.sigmaEffective),
      jamarat: nearestSigmaRow(mc.jamarat, c.sigmaEffective),
    };
    const r = t.replay;
    L.push(`### Hasil replay vs prediksi simulasi (baris MC terdekat: σ = ${near.miqat.sigma} m)`);
    L.push('');
    L.push('| Algoritma | Metrik | Lapangan (replay) | Simulasi (MC) |');
    L.push('|---|---|---|---|');
    L.push(`| Geofence Miqat | Akurasi (%) | ${id(r.miqat.acc)} | ${id(near.miqat.akurasi)} |`);
    L.push(`| Geofence Miqat | F1 (%) | ${id(r.miqat.f1)} | ${id(near.miqat.f1)} |`);
    L.push(`| Deteksi Arafah | Akurasi (%) | ${id(r.arafah.acc)} | ${id(near.arafah.akurasi)} |`);
    L.push(`| Deteksi Arafah | F1 (%) | ${id(r.arafah.f1)} | ${id(near.arafah.f1)} |`);
    L.push(`| Tawaf | Putaran terdeteksi (truth 7) | ${r.tawaf.predictedRounds} | rata-rata ${id(near.tawaf.mean)} |`);
    L.push(`| Sa'i | Leg terdeteksi (truth ${r.sai.truthLegs}) | ${r.sai.predictedLegs} | tepat-7: ${id(near.sai.exact7)}% |`);
    L.push(`| Jamarat | Benar (%) | ${id(r.jamarat.benar)} | ${id(near.jamarat.benar)} |`);
    L.push(`| Jamarat | Salah pilar (%) | ${id(r.jamarat.salahPilar)} | ${id(near.jamarat.salahPilar)} |`);
    L.push(`| Jamarat | Tak terdeteksi (%) | ${id(r.jamarat.takTerdeteksi)} | ${id(near.jamarat.takTerdeteksi)} |`);
    L.push('');
    // catatan per algoritma
    const notes: string[] = [];
    if (!r.sai.applicable) notes.push("Sa'i: trace bukan bolak-balik (leg < 50 m) — hasil 0/0 valid tapi tidak informatif.");
    else notes.push(`Sa'i: skala pemetaan s = ${id(r.sai.scale)} (leg aktual ${id(r.sai.legLengthM, 0)} m → koridor 419 m; derau ikut terskala).`);
    if (r.tawaf.residualTiled) notes.push(`Tawaf: deret residual (${r.tawaf.residualSamplesUsed} sampel 3 dtk) lebih pendek dari 700 — diulang (tiling), pola berulang tercatat sebagai keterbatasan.`);
    notes.push(`Klasifikasi (miqat/arafah/jamarat): ${'25'} penempatan deterministik melintasi batas; total sampel miqat ${r.miqat.total}, arafah ${r.arafah.total}, jamarat ${r.jamarat.totalTruthDetected}.`);
    L.push(notes.map((n) => `- ${n}`).join('\n'));
    L.push('');
    // gambar
    L.push('### Gambar');
    L.push('');
    for (const f of t.figures) L.push(`![${f}](figures/${f})`);
    L.push('');
  }

  L.push('---');
  L.push('');
  L.push('## Interpretasi lintas-trace');
  L.push('');
  L.push('Kolom "Simulasi (MC)" adalah prediksi model Gaussian i.i.d. pada σ efektif terdekat.');
  L.push('Selisih Lapangan vs Simulasi yang besar pada trace dengan autokorelasi/lonjakan tinggi');
  L.push('menunjukkan batas validitas model derau naskah — laporkan apa adanya di bab pembahasan/keterbatasan.');
  L.push('');
  L.push('**Dua peringatan pembacaan (wajib dipahami sebelum membandingkan angka):**');
  L.push('');
  L.push('1. **Kepadatan sampel berbeda.** Penempatan replay sengaja memusatkan seluruh titik pada');
  L.push('   pita sempit melintasi batas (±50 m; jamarat ±15 m), sedangkan simulasi MC menyebar titik');
  L.push('   merata di area jauh lebih luas. Akurasi replay karenanya SELALU lebih rendah dari MC pada');
  L.push('   σ yang sama — itu artefak desain penempatan, bukan bukti algoritma memburuk di lapangan.');
  L.push('   Bandingkan antar-trace replay (relatif), bukan replay vs MC secara absolut.');
  L.push('2. **σ efektif bisa terestimasi rendah pada derau berkorelasi kuat.** Komponen galat');
  L.push('   berfrekuensi rendah (autokorelasi tinggi, mis. multipath berkelanjutan) ikut terserap ke');
  L.push('   referensi terhalus sehingga tampak sebagai "jalur", bukan "derau". σ efektif dan ρ lag-1');
  L.push('   yang dilaporkan adalah batas bawah; lihat lag dekorrelasi untuk indikasi korelasi tersisa.');
  L.push('');
  return L.join('\n') + '\n';
}

export function writeFieldReport(traces: TraceReportInput[], demo: boolean, resultsDir: string): string {
  const md = buildFieldReport(traces, demo, resultsDir);
  const out = join(resultsDir, 'FIELD_VALIDATION.md');
  writeFileSync(out, md);
  return out;
}
