/*
 * CLI pipeline gps-replay.
 *
 *   npm run replay            -> proses field_logs/*.{gpx,csv} (data riil)
 *   npm run replay -- --demo  -> proses fixtures/ DEMO sintetis (uji pipeline)
 *
 * Alur per berkas: parse -> segmen terpanjang -> ENU -> karakterisasi derau ->
 * replay 6 algoritma (modul produksi) -> grafik PNG -> FIELD_VALIDATION.md.
 */
import { readdirSync, readFileSync, existsSync, writeFileSync } from 'fs';
import { join, basename } from 'path';
import { parseTraceFile, splitSegments } from './parser';
import { toLocalENU, smoothPath, extractResiduals } from './transform';
import { characterize } from './characterize';
import { replayAll } from './replay';
import { renderFieldFigures, TraceFigureInput } from './charts-field';
import { writeFieldReport, TraceReportInput } from './report';

const HERE = __dirname;
const REPO = join(HERE, '..', '..', '..');
const RESULTS = join(HERE, '..', 'results');
const FIGDIR = join(RESULTS, 'figures');

async function main() {
  const demo = process.argv.includes('--demo');
  const srcDir = demo ? join(HERE, 'fixtures') : join(REPO, 'field_logs');

  if (!existsSync(srcDir)) {
    console.log(`Direktori ${srcDir} tidak ditemukan.`);
    console.log('Rekam trace GPS (GPX/CSV) lalu taruh di field_logs/ — lihat field_logs/README.md.');
    console.log('Untuk menguji pipeline tanpa data riil: npm run replay -- --demo');
    return;
  }
  const files = readdirSync(srcDir).filter((f) => /\.(gpx|csv)$/i.test(f));
  if (files.length === 0) {
    console.log(`Tidak ada berkas .gpx/.csv di ${srcDir}.`);
    console.log('Rekam trace GPS berjalan kaki (lihat field_logs/README.md), lalu jalankan ulang.');
    if (!demo) console.log('Untuk menguji pipeline tanpa data riil: npm run replay -- --demo');
    return;
  }
  if (demo) console.log('=== MODE DEMO: fixture sintetis — hasil TIDAK untuk naskah ===\n');

  const reports: TraceReportInput[] = [];
  const figInputs: TraceFigureInput[] = [];
  const charJson: Record<string, unknown> = {};

  for (const file of files) {
    const name = basename(file).replace(/\.(gpx|csv)$/i, '');
    console.log(`[${file}]`);
    const parse = parseTraceFile(file, readFileSync(join(srcDir, file), 'utf8'));
    const segments = splitSegments(parse.points);
    const seg = segments.reduce((a, b) => (b.length > a.length ? b : a));
    if (segments.length > 1) {
      console.log(`  ${segments.length} segmen (loncatan >60 dtk); dipakai segmen terpanjang: ${seg.length}/${parse.points.length} titik`);
    }
    const { enu } = toLocalENU(seg);
    const chr = characterize(enu);
    console.log(`  titik=${enu.length} sigmaEff=${chr.sigmaEffective.toFixed(2)} m lag1(E)=${chr.east.lag1.toFixed(2)} ` +
      `isotropi=${chr.isotropyRatio.toFixed(2)}`);

    const smooth = smoothPath(enu);
    const residualsAll = extractResiduals(enu, smooth);
    const half = chr.trimmed;
    const residuals = residualsAll.slice(half, residualsAll.length - half);

    const replay = replayAll(enu, residuals);
    console.log(`  replay: tawaf ${replay.tawaf.predictedRounds}/7 | sa'i ${replay.sai.predictedLegs}/${replay.sai.truthLegs} | ` +
      `miqat acc ${replay.miqat.acc}% | arafah acc ${replay.arafah.acc}% | jamarat benar ${replay.jamarat.benar}%`);

    const figures = [`field-${name}-track.png`, `field-${name}-hist.png`, `field-${name}-acf.png`];
    reports.push({ name, file, parse, chr, replay, figures });
    figInputs.push({ name, raw: enu, smooth, residuals, chr });
    charJson[name] = { file, chr: { ...chr, qq: undefined }, replay };
  }

  console.log('\nMerender grafik...');
  const written = await renderFieldFigures(figInputs, FIGDIR);
  console.log(`  ${written.length} PNG -> results/figures/`);

  writeFileSync(join(RESULTS, 'field_characterization.json'), JSON.stringify({ demo, traces: charJson }, null, 2) + '\n');
  const out = writeFieldReport(reports, demo, RESULTS);
  console.log(`\n[OK] Laporan -> ${out}`);
  if (demo) console.log('=== INGAT: hasil DEMO — jangan dikutip di naskah ===');
}

main().catch((e) => { console.error('GAGAL:', e.message); process.exit(1); });
