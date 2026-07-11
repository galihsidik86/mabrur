/*
 * Grafik validasi lapangan -> PNG @2x via playwright (pola charts.js).
 * Per trace: (1) lintasan mentah vs referensi terhalus, (2) histogram residual
 * + kurva Gaussian + Q-Q, (3) ACF. Token & palet sama dengan charts.js
 * (tervalidasi CVD; teks memakai token tinta, bukan warna seri).
 */
import { chromium } from 'playwright';
import type { EnuPoint, Residual } from './transform';
import type { NoiseCharacterization } from './characterize';

const INK = '#0b0b0b', INK2 = '#52514e', MUTED = '#898781';
const GRID = '#e1e0d9', BASE = '#c3c2b7', SURFACE = '#ffffff';
const C1 = '#2a78d6', C2 = '#1baf7a'; // slot 1-2 palet tervalidasi

export interface TraceFigureInput {
  name: string;           // slug trace (nama file tanpa ekstensi)
  raw: EnuPoint[];
  smooth: EnuPoint[];
  residuals: Residual[];  // sudah dipangkas tepi (core)
  chr: NoiseCharacterization;
}

const fmt = (v: number, d = 1) => v.toFixed(d).replace('.', ',');

interface Scale { px: (v: number) => number; py: (v: number) => number; }
function makeScale(
  xDom: [number, number], yDom: [number, number],
  mL: number, mT: number, pw: number, ph: number,
): Scale {
  return {
    px: (v) => mL + ((v - xDom[0]) / (xDom[1] - xDom[0] || 1)) * pw,
    py: (v) => mT + (1 - (v - yDom[0]) / (yDom[1] - yDom[0] || 1)) * ph,
  };
}

function axisFrame(s: Scale, xDom: [number, number], yDom: [number, number],
                   mL: number, mT: number, pw: number, ph: number,
                   xTicks: number[], yTicks: number[], xTitle: string, yTitle: string,
                   tickDec = 0): string {
  let out = '';
  for (const t of yTicks) {
    out += `<line x1="${mL}" y1="${s.py(t)}" x2="${mL + pw}" y2="${s.py(t)}" stroke="${GRID}" stroke-width="1"/>`;
    out += `<text x="${mL - 7}" y="${s.py(t) + 3.5}" text-anchor="end" class="tick">${fmt(t, tickDec)}</text>`;
  }
  out += `<line x1="${mL}" y1="${mT}" x2="${mL}" y2="${mT + ph}" stroke="${BASE}"/>`;
  out += `<line x1="${mL}" y1="${mT + ph}" x2="${mL + pw}" y2="${mT + ph}" stroke="${BASE}"/>`;
  for (const t of xTicks) {
    out += `<text x="${s.px(t)}" y="${mT + ph + 16}" text-anchor="middle" class="tick">${fmt(t, tickDec)}</text>`;
  }
  out += `<text x="${mL + pw / 2}" y="${mT + ph + 34}" text-anchor="middle" class="axis">${xTitle}</text>`;
  out += `<text transform="translate(${mL - 45} ${mT + ph / 2}) rotate(-90)" text-anchor="middle" class="axis">${yTitle}</text>`;
  return out;
}

function niceTicks(lo: number, hi: number, n = 5): number[] {
  const span = hi - lo || 1;
  const step = 10 ** Math.floor(Math.log10(span / n));
  const mult = [1, 2, 5, 10].find((m) => span / (step * m) <= n + 1) ?? 10;
  const st = step * mult;
  const start = Math.ceil(lo / st) * st;
  const out: number[] = [];
  for (let v = start; v <= hi + 1e-9; v += st) out.push(+v.toFixed(10));
  return out;
}

// ---------- Fig 1: lintasan mentah vs referensi terhalus (bidang E-N) ----------
function figTrack(inp: TraceFigureInput): string {
  const W = 880, H = 560, mL = 62, mT = 40, mR = 24, mB = 58;
  const pw = W - mL - mR, ph = H - mT - mB;
  const all = [...inp.raw, ...inp.smooth];
  const eLo = Math.min(...all.map((p) => p.e)), eHi = Math.max(...all.map((p) => p.e));
  const nLo = Math.min(...all.map((p) => p.n)), nHi = Math.max(...all.map((p) => p.n));
  const pad = 10;
  const s = makeScale([eLo - pad, eHi + pad], [nLo - pad, nHi + pad], mL, mT, pw, ph);
  let g = axisFrame(s, [eLo, eHi], [nLo, nHi], mL, mT, pw, ph,
    niceTicks(eLo, eHi), niceTicks(nLo, nHi), 'East (m)', 'North (m)');
  const path = (pts: EnuPoint[]) => pts.map((p, i) => `${i ? 'L' : 'M'} ${s.px(p.e)} ${s.py(p.n)}`).join(' ');
  g += `<path d="${path(inp.raw)}" fill="none" stroke="${C1}" stroke-width="1.5" stroke-linejoin="round" opacity="0.85"/>`;
  g += `<path d="${path(inp.smooth)}" fill="none" stroke="${C2}" stroke-width="2.5" stroke-linejoin="round"/>`;
  const legend = `<div class="legend">
    <span class="chip"><svg width="24" height="10"><line x1="0" y1="5" x2="24" y2="5" stroke="${C1}" stroke-width="1.5"/></svg><span>Titik GPS mentah</span></span>
    <span class="chip"><svg width="24" height="10"><line x1="0" y1="5" x2="24" y2="5" stroke="${C2}" stroke-width="2.5"/></svg><span>Referensi terhalus (MA-11)</span></span>
  </div>`;
  return `<div class="fig" id="field-${inp.name}-track">${legend}<svg width="${W}" height="${H}">${g}</svg></div>`;
}

// ---------- Fig 2: histogram residual + kurva Gaussian + Q-Q ----------
function figHist(inp: TraceFigureInput): string {
  const W = 880, H = 480;
  const values = [...inp.residuals.map((r) => r.dE), ...inp.residuals.map((r) => r.dN)];
  const sigma = inp.chr.sigmaEffective;
  const lim = Math.max(4 * sigma, Math.max(...values.map(Math.abs)) * 1.05);
  const BINS = 41;
  const bw = (2 * lim) / BINS;
  const counts = new Array(BINS).fill(0);
  for (const v of values) {
    const b = Math.floor((v + lim) / bw);
    if (b >= 0 && b < BINS) counts[b]++;
  }
  const density = counts.map((c) => c / (values.length * bw));
  const gaussPeak = 1 / (sigma * Math.sqrt(2 * Math.PI));
  const yMax = Math.max(...density, gaussPeak) * 1.12;

  // panel kiri: histogram (0..W1), panel kanan: Q-Q
  const mL = 58, mT = 40, mB = 56, W1 = 520;
  const pw = W1 - mL - 16, ph = H - mT - mB;
  const s = makeScale([-lim, lim], [0, yMax], mL, mT, pw, ph);
  let g = axisFrame(s, [-lim, lim], [0, yMax], mL, mT, pw, ph,
    niceTicks(-lim, lim, 5), [], 'Residual (m)', 'Kepadatan');
  // bar histogram: tipis, celah permukaan 2px, ujung-data membulat 2px
  const barW = Math.max(2, pw / BINS - 2);
  for (let i = 0; i < BINS; i++) {
    if (density[i] === 0) continue;
    const x = s.px(-lim + i * bw) + 1;
    const y = s.py(density[i]);
    const h = s.py(0) - y;
    g += `<rect x="${x}" y="${y}" width="${barW}" height="${h}" rx="2" fill="${C1}" opacity="0.75"/>`;
  }
  // kurva Gaussian dengan sigma efektif
  const pts: string[] = [];
  for (let i = 0; i <= 120; i++) {
    const x = -lim + (2 * lim * i) / 120;
    const y = gaussPeak * Math.exp(-(x * x) / (2 * sigma * sigma));
    pts.push(`${i ? 'L' : 'M'} ${s.px(x)} ${s.py(y)}`);
  }
  g += `<path d="${pts.join(' ')}" fill="none" stroke="${INK}" stroke-width="2" stroke-dasharray="none"/>`;
  g += `<text x="${mL + 8}" y="${mT + 14}" class="note">σ_efektif = ${fmt(sigma, 2)} m · JB p(E)=${inp.chr.east.jbPValue.toExponential(1)} p(N)=${inp.chr.north.jbPValue.toExponential(1)}</text>`;

  // Q-Q sumbu E (panel kanan)
  const mL2 = W1 + 46, pw2 = W - mL2 - 22;
  const qq = inp.chr.qq.east;
  const qlo = Math.min(...qq.flat()), qhi = Math.max(...qq.flat());
  const s2 = makeScale([qlo, qhi], [qlo, qhi], mL2, mT, pw2, ph);
  g += axisFrame(s2, [qlo, qhi], [qlo, qhi], mL2, mT, pw2, ph,
    niceTicks(qlo, qhi, 4), niceTicks(qlo, qhi, 4), 'Kuantil normal (m)', 'Kuantil empiris (m)');
  g += `<line x1="${s2.px(qlo)}" y1="${s2.py(qlo)}" x2="${s2.px(qhi)}" y2="${s2.py(qhi)}" stroke="${BASE}" stroke-width="1.5"/>`;
  for (const [th, em] of qq) {
    g += `<circle cx="${s2.px(th)}" cy="${s2.py(em)}" r="2.6" fill="${C2}" stroke="${SURFACE}" stroke-width="1"/>`;
  }
  g += `<text x="${mL2 + 6}" y="${mT + 14}" class="note">Q–Q sumbu East</text>`;
  return `<div class="fig" id="field-${inp.name}-hist"><svg width="${W}" height="${H}">${g}</svg></div>`;
}

// ---------- Fig 3: ACF residual ----------
function figAcf(inp: TraceFigureInput): string {
  const W = 880, H = 420, mL = 58, mT = 30, mR = 24, mB = 56;
  const pw = W - mL - mR, ph = H - mT - mB;
  const lags = inp.chr.east.acf.length;
  const s = makeScale([0, lags + 1], [-0.3, 1], mL, mT, pw, ph);
  let g = axisFrame(s, [0, lags], [-0.3, 1], mL, mT, pw, ph,
    niceTicks(0, lags, 6), [-0.2, 0, 0.2, 0.4, 0.6, 0.8, 1], 'Lag (sampel)', 'Autokorelasi ρ', 1);
  g += `<line x1="${mL}" y1="${s.py(0.2)}" x2="${mL + pw}" y2="${s.py(0.2)}" stroke="${MUTED}" stroke-width="1" stroke-dasharray="4 3"/>`;
  g += `<text x="${mL + pw - 4}" y="${s.py(0.2) - 5}" text-anchor="end" class="note">ambang i.i.d. praktis ρ=0,2</text>`;
  const series = [
    { xs: inp.chr.east.acf, color: C1, label: 'East' },
    { xs: inp.chr.north.acf, color: C2, label: 'North' },
  ];
  for (const sr of series) {
    const d = sr.xs.map((v, i) => `${i ? 'L' : 'M'} ${s.px(i + 1)} ${s.py(v)}`).join(' ');
    g += `<path d="${d}" fill="none" stroke="${sr.color}" stroke-width="2" stroke-linejoin="round"/>`;
    sr.xs.forEach((v, i) => {
      g += `<circle cx="${s.px(i + 1)}" cy="${s.py(v)}" r="3.6" fill="${sr.color}" stroke="${SURFACE}" stroke-width="2"/>`;
    });
  }
  const legend = `<div class="legend">${series.map((sr) =>
    `<span class="chip"><svg width="24" height="10"><line x1="0" y1="5" x2="24" y2="5" stroke="${sr.color}" stroke-width="2"/><circle cx="12" cy="5" r="3" fill="${sr.color}"/></svg><span>${sr.label}</span></span>`).join('')}
  </div>`;
  return `<div class="fig" id="field-${inp.name}-acf">${legend}<svg width="${W}" height="${H}">${g}</svg></div>`;
}

// ---------- render ----------

export async function renderFieldFigures(inputs: TraceFigureInput[], outDir: string): Promise<string[]> {
  const figs = inputs.flatMap((inp) => [figTrack(inp), figHist(inp), figAcf(inp)]);
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    body { margin: 0; background: #f0f0f0; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; }
    .fig { background: ${SURFACE}; width: 912px; padding: 14px; margin: 10px; box-sizing: border-box; }
    .legend { display: flex; gap: 16px; padding: 2px 4px 8px 54px; }
    .chip { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: ${INK}; }
    .tick { font-size: 10.5px; fill: ${MUTED}; font-variant-numeric: tabular-nums; }
    .axis { font-size: 12px; fill: ${INK2}; }
    .note { font-size: 10.5px; fill: ${INK2}; }
    text { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; }
  </style></head><body>${figs.join('\n')}</body></html>`;

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1000, height: 800 }, deviceScaleFactor: 2 });
  await page.setContent(html, { waitUntil: 'load' });
  const written: string[] = [];
  for (const el of await page.$$('.fig')) {
    const id = await el.getAttribute('id');
    const file = `${outDir}/${id}.png`;
    await el.screenshot({ path: file });
    written.push(`${id}.png`);
  }
  await browser.close();
  return written;
}
