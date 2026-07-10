/*
 * Grafik akurasi-vs-sigma untuk paper jurnal (Angle A).
 * Baca 5 CSV di results/, render SVG via playwright -> PNG @2x di results/figures/.
 *
 *   node docs/accuracy-test/charts.js
 *
 * Desain: line chart 2px, marker beda-bentuk per seri (aman CVD & cetak grayscale),
 * palet kategorikal tervalidasi (validate_palette.js: PASS, CVD dE 24,2),
 * teks memakai token tinta (bukan warna seri), grid hairline solid.
 * Tanpa judul di dalam gambar — caption disediakan di figures/captions.md.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const RESULTS = path.join(__dirname, 'results');
const OUT = path.join(RESULTS, 'figures');
fs.mkdirSync(OUT, { recursive: true });

// ---------- data ----------
function readCsv(name) {
  const [head, ...rows] = fs.readFileSync(path.join(RESULTS, name), 'utf8').trim().split('\n');
  const cols = head.split(',');
  return rows.map((r) => {
    const v = r.split(',').map(Number);
    return Object.fromEntries(cols.map((c, i) => [c, v[i]]));
  });
}
const miqat = readCsv('miqat_accuracy.csv');
const arafah = readCsv('arafah_accuracy.csv');
const tawaf = readCsv('tawaf_accuracy.csv');
const sai = readCsv('sai_accuracy.csv');
const jamarat = readCsv('jamarat_accuracy.csv');

// ---------- token desain (palet tervalidasi, permukaan putih = halaman jurnal) ----------
const INK = '#0b0b0b', INK2 = '#52514e', MUTED = '#898781';
const GRID = '#e1e0d9', BASE = '#c3c2b7', SURFACE = '#ffffff';
const C = ['#2a78d6', '#1baf7a', '#eda100', '#008300', '#4a3aa7']; // slot 1-5

// angka gaya Indonesia: koma desimal
const fmt = (v) => (Number.isInteger(v) ? String(v) : v.toFixed(2).replace('.', ','));

// ---------- primitif SVG ----------
const MARKERS = ['circle', 'square', 'triangle', 'diamond', 'tridown'];
function marker(shape, x, y, color) {
  const ring = `fill="${color}" stroke="${SURFACE}" stroke-width="2"`;
  switch (shape) {
    case 'square': return `<rect x="${x - 4}" y="${y - 4}" width="8" height="8" ${ring}/>`;
    case 'triangle': return `<path d="M ${x} ${y - 5.2} L ${x + 4.8} ${y + 3.6} L ${x - 4.8} ${y + 3.6} Z" ${ring}/>`;
    case 'diamond': return `<path d="M ${x} ${y - 5.6} L ${x + 5.6} ${y} L ${x} ${y + 5.6} L ${x - 5.6} ${y} Z" ${ring}/>`;
    case 'tridown': return `<path d="M ${x} ${y + 5.2} L ${x + 4.8} ${y - 3.6} L ${x - 4.8} ${y - 3.6} Z" ${ring}/>`;
    default: return `<circle cx="${x}" cy="${y}" r="4.6" ${ring}/>`;
  }
}
function legendChip(label, color, shape) {
  const svg = `<svg width="26" height="14" viewBox="0 0 26 14">
    <line x1="1" y1="7" x2="25" y2="7" stroke="${color}" stroke-width="2"/>${marker(shape, 13, 7, color)}</svg>`;
  return `<span class="chip">${svg}<span>${label}</span></span>`;
}

/**
 * Render satu figure line-chart.
 * series: [{ label, color, shape, points: [{x,y}] }]
 * yDomain [min,max], yTicks [], endLabels: 'name+value' | 'value' | null
 */
function figure({ id, series, yDomain, yTicks, yTitle, endLabels }) {
  const W = 880, H = 500;
  const mL = 62, mR = endLabels === 'name+value' ? 150 : endLabels === 'value' ? 70 : 28;
  const mT = 18, mB = 54;
  const pw = W - mL - mR, ph = H - mT - mB;
  const X_MAX = 15;
  const px = (x) => mL + (x / X_MAX) * pw;
  const py = (y) => mT + 12 + (1 - (y - yDomain[0]) / (yDomain[1] - yDomain[0])) * (ph - 12); // 12px padding atas: marker di nilai maks tidak terpotong

  let s = '';
  // grid horizontal hairline + tick y
  for (const t of yTicks) {
    s += `<line x1="${mL}" y1="${py(t)}" x2="${mL + pw}" y2="${py(t)}" stroke="${GRID}" stroke-width="1"/>`;
    s += `<text x="${mL - 8}" y="${py(t) + 3.5}" text-anchor="end" class="tick">${fmt(t)}</text>`;
  }
  // sumbu
  s += `<line x1="${mL}" y1="${mT}" x2="${mL}" y2="${mT + ph}" stroke="${BASE}" stroke-width="1"/>`;
  s += `<line x1="${mL}" y1="${mT + ph}" x2="${mL + pw}" y2="${mT + ph}" stroke="${BASE}" stroke-width="1"/>`;
  // tick x pada nilai sigma data
  for (const t of [0, 1, 3, 5, 10, 15]) {
    s += `<line x1="${px(t)}" y1="${mT + ph}" x2="${px(t)}" y2="${mT + ph + 4}" stroke="${BASE}" stroke-width="1"/>`;
    s += `<text x="${px(t)}" y="${mT + ph + 18}" text-anchor="middle" class="tick">${t}</text>`;
  }
  // judul sumbu (token tinta sekunder)
  s += `<text x="${mL + pw / 2}" y="${H - 12}" text-anchor="middle" class="axis">σ galat GPS (m)</text>`;
  s += `<text transform="translate(14 ${mT + ph / 2}) rotate(-90)" text-anchor="middle" class="axis">${yTitle}</text>`;

  // garis + marker
  for (const sr of series) {
    const d = sr.points.map((p, i) => `${i ? 'L' : 'M'} ${px(p.x)} ${py(p.y)}`).join(' ');
    s += `<path d="${d}" fill="none" stroke="${sr.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
    for (const p of sr.points) s += marker(sr.shape, px(p.x), py(p.y), sr.color);
  }

  // label ujung: teks tinta, anti-tabrakan + leader line bila digeser
  if (endLabels) {
    const items = series.map((sr) => {
      const last = sr.points[sr.points.length - 1];
      const text = endLabels === 'name+value' ? `${sr.label} ${fmt(last.y)}` : fmt(last.y);
      return { yLine: py(last.y), yLabel: py(last.y), text };
    }).sort((a, b) => a.yLine - b.yLine);
    const GAP = 15;
    for (let i = 1; i < items.length; i++) {
      if (items[i].yLabel - items[i - 1].yLabel < GAP) items[i].yLabel = items[i - 1].yLabel + GAP;
    }
    const xEnd = px(X_MAX);
    for (const it of items) {
      if (Math.abs(it.yLabel - it.yLine) > 2) {
        s += `<line x1="${xEnd + 6}" y1="${it.yLine}" x2="${xEnd + 16}" y2="${it.yLabel}" stroke="${BASE}" stroke-width="1"/>`;
      }
      s += `<text x="${xEnd + 19}" y="${it.yLabel + 3.5}" class="endlbl">${it.text}</text>`;
    }
  }

  const legend = series.length >= 2
    ? `<div class="legend">${series.map((sr) => legendChip(sr.label, sr.color, sr.shape)).join('')}</div>`
    : '';
  return `<div class="fig" id="${id}">${legend}
    <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${s}</svg></div>`;
}

// ---------- definisi 6 figure ----------
const pts = (rows, col) => rows.map((r) => ({ x: r.sigma, y: r[col] }));
const metricSeries = (rows) => [
  { label: 'Akurasi', color: C[0], shape: MARKERS[0], points: pts(rows, 'accuracy') },
  { label: 'Presisi', color: C[1], shape: MARKERS[1], points: pts(rows, 'precision') },
  { label: 'Recall', color: C[2], shape: MARKERS[2], points: pts(rows, 'recall') },
  { label: 'F1', color: C[3], shape: MARKERS[3], points: pts(rows, 'f1') },
];
const range = (a, b, step) => { const r = []; for (let v = a; v <= b + 1e-9; v += step) r.push(+v.toFixed(2)); return r; };

const figures = [
  figure({
    id: 'fig1-gabungan',
    series: [
      { label: 'Geofence Miqat', color: C[0], shape: MARKERS[0], points: pts(miqat, 'accuracy') },
      { label: 'Deteksi Arafah', color: C[1], shape: MARKERS[1], points: pts(arafah, 'accuracy') },
      { label: 'Tawaf (tepat-7)', color: C[2], shape: MARKERS[2], points: pts(tawaf, 'exact7_pct') },
      { label: "Sa'i (tepat-7)", color: C[3], shape: MARKERS[3], points: pts(sai, 'exact7_pct') },
      { label: 'Jamarat (benar)', color: C[4], shape: MARKERS[4], points: pts(jamarat, 'correct') },
    ],
    yDomain: [70, 100], yTicks: range(70, 100, 5), yTitle: 'Akurasi (%)', endLabels: 'name+value',
  }),
  figure({ id: 'fig2-miqat-metrik', series: metricSeries(miqat), yDomain: [99, 100], yTicks: range(99, 100, 0.2), yTitle: 'Nilai metrik (%)', endLabels: null }),
  figure({ id: 'fig3-arafah-metrik', series: metricSeries(arafah), yDomain: [99, 100], yTicks: range(99, 100, 0.2), yTitle: 'Nilai metrik (%)', endLabels: null }),
  // Tawaf & Sa'i: satu seri (tanpa legenda), skala-y identik agar bisa dibandingkan berdampingan
  figure({ id: 'fig4-tawaf', series: [{ label: 'Tawaf', color: C[0], shape: MARKERS[0], points: pts(tawaf, 'exact7_pct') }], yDomain: [70, 100], yTicks: range(70, 100, 5), yTitle: 'Akurasi tepat-7 (%)', endLabels: 'value' }),
  figure({ id: 'fig5-sai', series: [{ label: "Sa'i", color: C[0], shape: MARKERS[0], points: pts(sai, 'exact7_pct') }], yDomain: [70, 100], yTicks: range(70, 100, 5), yTitle: 'Akurasi tepat-7 (%)', endLabels: 'value' }),
  figure({
    id: 'fig6-jamarat-hasil',
    series: [
      { label: 'Identifikasi benar', color: C[0], shape: MARKERS[0], points: pts(jamarat, 'correct') },
      { label: 'Salah pilar', color: C[1], shape: MARKERS[1], points: pts(jamarat, 'wrong') },
      { label: 'Tak terdeteksi', color: C[2], shape: MARKERS[2], points: pts(jamarat, 'none') },
    ],
    yDomain: [0, 100], yTicks: range(0, 100, 20), yTitle: 'Persentase sampel (%)', endLabels: 'value',
  }),
];

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  body { margin: 0; background: #f0f0f0; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; }
  .fig { background: ${SURFACE}; width: 912px; padding: 16px; margin: 12px; box-sizing: border-box; }
  .legend { display: flex; gap: 18px; flex-wrap: wrap; padding: 2px 4px 10px 58px; }
  .chip { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: ${INK}; }
  .tick { font-size: 11px; fill: ${MUTED}; font-variant-numeric: tabular-nums; }
  .axis { font-size: 12.5px; fill: ${INK2}; }
  .endlbl { font-size: 11.5px; fill: ${INK2}; font-variant-numeric: tabular-nums; }
  text { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; }
</style></head><body>${figures.join('\n')}</body></html>`;

// ---------- render PNG @2x ----------
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1000, height: 800 }, deviceScaleFactor: 2 });
  await page.setContent(html, { waitUntil: 'load' });
  for (const el of await page.$$('.fig')) {
    const id = await el.getAttribute('id');
    await el.screenshot({ path: path.join(OUT, `${id}.png`) });
    console.log(`${id}.png`);
  }
  await browser.close();
  console.log(`\n[OK] ${figures.length} PNG @2x -> ${path.relative(process.cwd(), OUT)}`);
})();
