/*
 * Validasi GPS — upload trace GPX/CSV, analisis langsung di browser.
 * Memakai modul pipeline riset (docs/accuracy-test/gps-replay) dan algoritma
 * PRODUKSI (apps/mobile/src/services/sacred-zones-core) via impor langsung —
 * tidak ada duplikasi logika, tidak ada endpoint server.
 */
import { useState, useCallback, useEffect } from 'react';
import { api } from '../api';
import { parseTraceFile, splitSegments, ParseReport } from '../../../../docs/accuracy-test/gps-replay/parser';
import {
  toLocalENU, smoothPath, extractResiduals, EnuPoint, Residual,
} from '../../../../docs/accuracy-test/gps-replay/transform';
import { characterize, NoiseCharacterization } from '../../../../docs/accuracy-test/gps-replay/characterize';
import { replayAll, TraceReplayResults } from '../../../../docs/accuracy-test/gps-replay/replay';
import mc from '../../../../docs/accuracy-test/results/monte_carlo_results.json';

// ==================== token desain ====================
const C = {
  primary: '#8B2E2E', bg: '#F5F1E8', card: '#FFFFFF', border: '#ECE5D8',
  text: '#1F1B16', muted: '#8C6B4A', faint: '#B89A7A',
  green: '#4A7C3A', greenLight: '#DCEBD3', gold: '#D4A437', goldLight: '#FAEFC9',
  danger: '#C44536',
};
// token grafik (palet tervalidasi — sama dengan charts.js riset)
const V = { ink: '#0b0b0b', ink2: '#52514e', muted: '#898781', grid: '#e1e0d9', base: '#c3c2b7', s1: '#2a78d6', s2: '#1baf7a' };

const idn = (v: number, d = 2) => v.toFixed(d).replace('.', ',');

interface TraceAnalysis {
  file: string;
  parse: ParseReport;
  enu: EnuPoint[];
  smooth: EnuPoint[];
  residuals: Residual[];
  chr: NoiseCharacterization;
  replay: TraceReplayResults;
  accMean: number | null;
  segInfo: string | null;
  error?: undefined;
}
interface TraceError { file: string; error: string; }
type Item = TraceAnalysis | TraceError;

function analyze(file: string, content: string, parseAs?: string): Item {
  try {
    const parse = parseTraceFile(parseAs ?? file, content);
    const segments = splitSegments(parse.points);
    const seg = segments.reduce((a, b) => (b.length > a.length ? b : a));
    const segInfo = segments.length > 1
      ? `${segments.length} segmen (loncatan >60 dtk) — dipakai segmen terpanjang: ${seg.length}/${parse.points.length} titik`
      : null;
    const { enu } = toLocalENU(seg);
    const chr = characterize(enu);
    const smooth = smoothPath(enu);
    const resAll = extractResiduals(enu, smooth);
    const residuals = resAll.slice(chr.trimmed, resAll.length - chr.trimmed);
    const replay = replayAll(enu, residuals);
    const accs = parse.points.map((p) => p.acc).filter((a): a is number => a !== null);
    const accMean = accs.length ? accs.reduce((a, b) => a + b, 0) / accs.length : null;
    return { file, parse, enu, smooth, residuals, chr, replay, accMean, segInfo };
  } catch (e) {
    return { file, error: e instanceof Error ? e.message : 'Kesalahan tidak dikenal' };
  }
}

// ==================== grafik SVG ====================

function ticks(lo: number, hi: number, n = 5): number[] {
  const span = hi - lo || 1;
  const step = 10 ** Math.floor(Math.log10(span / n));
  const mult = [1, 2, 5, 10].find((m) => span / (step * m) <= n + 1) ?? 10;
  const st = step * mult;
  const out: number[] = [];
  for (let v = Math.ceil(lo / st) * st; v <= hi + 1e-9; v += st) out.push(+v.toFixed(10));
  return out;
}

function Frame({ w, h, mL, mT, pw, ph, xDom, yDom, xTitle, yTitle, dec = 0 }: {
  w: number; h: number; mL: number; mT: number; pw: number; ph: number;
  xDom: [number, number]; yDom: [number, number]; xTitle: string; yTitle: string; dec?: number;
}) {
  const px = (v: number) => mL + ((v - xDom[0]) / (xDom[1] - xDom[0] || 1)) * pw;
  const py = (v: number) => mT + (1 - (v - yDom[0]) / (yDom[1] - yDom[0] || 1)) * ph;
  return (
    <g>
      {ticks(yDom[0], yDom[1]).map((t) => (
        <g key={`y${t}`}>
          <line x1={mL} y1={py(t)} x2={mL + pw} y2={py(t)} stroke={V.grid} strokeWidth={1} />
          <text x={mL - 6} y={py(t) + 3.5} textAnchor="end" fontSize={10} fill={V.muted}>{idn(t, dec)}</text>
        </g>
      ))}
      <line x1={mL} y1={mT} x2={mL} y2={mT + ph} stroke={V.base} />
      <line x1={mL} y1={mT + ph} x2={mL + pw} y2={mT + ph} stroke={V.base} />
      {ticks(xDom[0], xDom[1]).map((t) => (
        <text key={`x${t}`} x={px(t)} y={mT + ph + 14} textAnchor="middle" fontSize={10} fill={V.muted}>{idn(t, dec)}</text>
      ))}
      <text x={mL + pw / 2} y={h - 6} textAnchor="middle" fontSize={11} fill={V.ink2}>{xTitle}</text>
      <text transform={`translate(${mL - 40} ${mT + ph / 2}) rotate(-90)`} textAnchor="middle" fontSize={11} fill={V.ink2}>{yTitle}</text>
    </g>
  );
}

function TrackChart({ a }: { a: TraceAnalysis }) {
  const w = 560, h = 380, mL = 56, mT = 16, pw = w - mL - 20, ph = h - mT - 46;
  const all = [...a.enu, ...a.smooth];
  const eLo = Math.min(...all.map((p) => p.e)) - 8, eHi = Math.max(...all.map((p) => p.e)) + 8;
  const nLo = Math.min(...all.map((p) => p.n)) - 8, nHi = Math.max(...all.map((p) => p.n)) + 8;
  const px = (v: number) => mL + ((v - eLo) / (eHi - eLo || 1)) * pw;
  const py = (v: number) => mT + (1 - (v - nLo) / (nHi - nLo || 1)) * ph;
  const path = (pts: EnuPoint[]) => pts.map((p, i) => `${i ? 'L' : 'M'} ${px(p.e)} ${py(p.n)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%' }}>
      <Frame w={w} h={h} mL={mL} mT={mT} pw={pw} ph={ph} xDom={[eLo, eHi]} yDom={[nLo, nHi]} xTitle="East (m)" yTitle="North (m)" />
      <path d={path(a.enu)} fill="none" stroke={V.s1} strokeWidth={1.4} strokeLinejoin="round" opacity={0.85} />
      <path d={path(a.smooth)} fill="none" stroke={V.s2} strokeWidth={2.4} strokeLinejoin="round" />
    </svg>
  );
}

function HistChart({ a }: { a: TraceAnalysis }) {
  const w = 560, h = 380, mL = 56, mT = 16, pw = w - mL - 20, ph = h - mT - 46;
  const values = [...a.residuals.map((r) => r.dE), ...a.residuals.map((r) => r.dN)];
  const sigma = a.chr.sigmaEffective || 1e-6;
  const lim = Math.max(4 * sigma, Math.max(...values.map(Math.abs)) * 1.05);
  const BINS = 35, bw = (2 * lim) / BINS;
  const counts = new Array(BINS).fill(0);
  for (const v of values) { const b = Math.floor((v + lim) / bw); if (b >= 0 && b < BINS) counts[b]++; }
  const dens = counts.map((c) => c / (values.length * bw));
  const peak = 1 / (sigma * Math.sqrt(2 * Math.PI));
  const yMax = Math.max(...dens, peak) * 1.12;
  const px = (v: number) => mL + ((v + lim) / (2 * lim)) * pw;
  const py = (v: number) => mT + (1 - v / yMax) * ph;
  const gauss: string[] = [];
  for (let i = 0; i <= 100; i++) {
    const x = -lim + (2 * lim * i) / 100;
    gauss.push(`${i ? 'L' : 'M'} ${px(x)} ${py(peak * Math.exp(-(x * x) / (2 * sigma * sigma)))}`);
  }
  const barW = Math.max(2, pw / BINS - 2);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%' }}>
      <Frame w={w} h={h} mL={mL} mT={mT} pw={pw} ph={ph} xDom={[-lim, lim]} yDom={[0, yMax]} xTitle="Residual (m)" yTitle="Kepadatan" />
      {dens.map((d, i) => d > 0 && (
        <rect key={i} x={px(-lim + i * bw) + 1} y={py(d)} width={barW} height={py(0) - py(d)} rx={2} fill={V.s1} opacity={0.75} />
      ))}
      <path d={gauss.join(' ')} fill="none" stroke={V.ink} strokeWidth={2} />
      <text x={mL + 6} y={mT + 12} fontSize={10.5} fill={V.ink2}>
        σ efektif = {idn(sigma)} m · Gaussian sebagai pembanding
      </text>
    </svg>
  );
}

function AcfChart({ a }: { a: TraceAnalysis }) {
  const w = 560, h = 320, mL = 56, mT = 14, pw = w - mL - 20, ph = h - mT - 46;
  const lags = a.chr.east.acf.length;
  const px = (v: number) => mL + (v / (lags + 1)) * pw;
  const py = (v: number) => mT + (1 - (v + 0.3) / 1.3) * ph;
  const series = [
    { xs: a.chr.east.acf, color: V.s1, label: 'East' },
    { xs: a.chr.north.acf, color: V.s2, label: 'North' },
  ];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%' }}>
      <Frame w={w} h={h} mL={mL} mT={mT} pw={pw} ph={ph} xDom={[0, lags]} yDom={[-0.3, 1]} xTitle="Lag (sampel)" yTitle="Autokorelasi ρ" dec={1} />
      <line x1={mL} y1={py(0.2)} x2={mL + pw} y2={py(0.2)} stroke={V.muted} strokeWidth={1} strokeDasharray="4 3" />
      <text x={mL + pw - 4} y={py(0.2) - 4} textAnchor="end" fontSize={9.5} fill={V.ink2}>ambang i.i.d. praktis ρ=0,2</text>
      {series.map((s) => (
        <g key={s.label}>
          <path
            d={s.xs.map((v, i) => `${i ? 'L' : 'M'} ${px(i + 1)} ${py(v)}`).join(' ')}
            fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round"
          />
          {s.xs.map((v, i) => (
            <circle key={i} cx={px(i + 1)} cy={py(v)} r={3.2} fill={s.color} stroke="#fff" strokeWidth={1.6} />
          ))}
        </g>
      ))}
    </svg>
  );
}

function Legend({ items }: { items: Array<{ color: string; label: string; thick?: boolean }> }) {
  return (
    <div style={{ display: 'flex', gap: 16, fontSize: 12, color: V.ink, padding: '2px 0 6px' }}>
      {items.map((it) => (
        <span key={it.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 20, height: it.thick ? 3 : 2, background: it.color, display: 'inline-block' }} />
          {it.label}
        </span>
      ))}
    </div>
  );
}

// ==================== tabel hasil ====================

type McRow = { sigma: number } & Record<string, number>;
function nearest(rows: McRow[], s: number): McRow {
  return rows.reduce((a, b) => (Math.abs(b.sigma - s) < Math.abs(a.sigma - s) ? b : a));
}

const th: React.CSSProperties = { textAlign: 'left', padding: '7px 10px', fontSize: 11, color: C.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, borderBottom: `1px solid ${C.border}` };
const td: React.CSSProperties = { padding: '7px 10px', fontSize: 13, color: C.text, borderBottom: `1px solid ${C.border}` };

function ReplayTable({ a }: { a: TraceAnalysis }) {
  const s = a.chr.sigmaEffective;
  const n = {
    miqat: nearest(mc.miqat as McRow[], s), arafah: nearest(mc.arafah as McRow[], s),
    tawaf: nearest(mc.tawaf as McRow[], s), sai: nearest(mc.sai as McRow[], s),
    jamarat: nearest(mc.jamarat as McRow[], s),
  };
  const r = a.replay;
  const rows: Array<[string, string, string, string]> = [
    ['Geofence Miqat', 'Akurasi (%)', idn(r.miqat.acc), idn(n.miqat.akurasi)],
    ['Geofence Miqat', 'F1 (%)', idn(r.miqat.f1), idn(n.miqat.f1)],
    ['Deteksi Arafah', 'Akurasi (%)', idn(r.arafah.acc), idn(n.arafah.akurasi)],
    ['Deteksi Arafah', 'F1 (%)', idn(r.arafah.f1), idn(n.arafah.f1)],
    ['Tawaf', 'Putaran (truth 7)', String(r.tawaf.predictedRounds), `rata-rata ${idn(n.tawaf.mean)}`],
    ["Sa'i", `Leg (truth ${r.sai.truthLegs})`, String(r.sai.predictedLegs), `tepat-7: ${idn(n.sai.exact7)}%`],
    ['Jamarat', 'Benar (%)', idn(r.jamarat.benar), idn(n.jamarat.benar)],
    ['Jamarat', 'Salah pilar (%)', idn(r.jamarat.salahPilar), idn(n.jamarat.salahPilar)],
    ['Jamarat', 'Tak terdeteksi (%)', idn(r.jamarat.takTerdeteksi), idn(n.jamarat.takTerdeteksi)],
  ];
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead><tr>
        <th style={th}>Algoritma</th><th style={th}>Metrik</th>
        <th style={th}>Lapangan (replay)</th>
        <th style={{ ...th, textTransform: 'none' }}>SIMULASI MC (σ = {n.miqat.sigma} m)</th>
      </tr></thead>
      <tbody>{rows.map((row, i) => (
        <tr key={i}>{row.map((cell, j) => <td key={j} style={{ ...td, fontWeight: j === 0 ? 600 : 400 }}>{cell}</td>)}</tr>
      ))}</tbody>
    </table>
  );
}

function CharTable({ chr }: { chr: NoiseCharacterization }) {
  const rows: Array<[string, string, string]> = [
    ['σ per sumbu (m)', idn(chr.east.sigma), idn(chr.north.sigma)],
    ['Skewness', idn(chr.east.skewness, 3), idn(chr.north.skewness, 3)],
    ['Kurtosis (excess)', idn(chr.east.kurtosisExcess, 3), idn(chr.north.kurtosisExcess, 3)],
    ['Jarque–Bera (p)', chr.east.jbPValue.toExponential(2), chr.north.jbPValue.toExponential(2)],
    ['ACF lag-1 ρ', idn(chr.east.lag1, 3), idn(chr.north.lag1, 3)],
    ['Lag dekorrelasi (ρ<0,2)', String(chr.east.decorrelationLag), String(chr.north.decorrelationLag)],
  ];
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead><tr><th style={th}>Besaran</th><th style={th}>East</th><th style={th}>North</th></tr></thead>
      <tbody>{rows.map((r, i) => (
        <tr key={i}>{r.map((c, j) => <td key={j} style={{ ...td, fontWeight: j === 0 ? 600 : 400 }}>{c}</td>)}</tr>
      ))}</tbody>
    </table>
  );
}

// ==================== komponen halaman ====================

const card: React.CSSProperties = { background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20 };
const h3: React.CSSProperties = { fontSize: 13, fontWeight: 800, color: C.text, margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: 0.5 };

function TraceCard({ a }: { a: TraceAnalysis }) {
  const badVerdict = !a.chr.verdict.startsWith('Konsisten');
  return (
    <div style={{ ...card, marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: 17, fontWeight: 800, color: C.text, margin: 0 }}>{a.file}</h2>
        <span style={{ fontSize: 12, color: C.muted }}>
          {a.parse.points.length} titik · {a.parse.dropped.invalid} tak valid · {a.parse.dropped.duplicate} duplikat · {a.parse.gaps.length} loncatan &gt;10 dtk
        </span>
      </div>
      {a.segInfo && <div style={{ fontSize: 12, color: C.gold, marginTop: 4 }}>{a.segInfo}</div>}

      {/* sorotan angka */}
      <div style={{ display: 'flex', gap: 12, marginTop: 14, flexWrap: 'wrap' }}>
        {[
          ['σ efektif', `${idn(a.chr.sigmaEffective)} m`],
          ['Akurasi perangkat (rata-rata)', a.accMean !== null ? `${idn(a.accMean, 1)} m` : '—'],
          ['Isotropi σE/σN', idn(a.chr.isotropyRatio)],
          ['ρ lag-1 (maks)', idn(Math.max(a.chr.east.lag1, a.chr.north.lag1), 2)],
        ].map(([label, val]) => (
          <div key={label} style={{ background: C.bg, borderRadius: 10, padding: '10px 16px', minWidth: 130 }}>
            <div style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>{label}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: C.text, marginTop: 2 }}>{val}</div>
          </div>
        ))}
      </div>

      <div style={{
        marginTop: 12, padding: '10px 14px', borderRadius: 10, fontSize: 12.5, lineHeight: 1.5,
        background: badVerdict ? C.goldLight : C.greenLight,
        color: badVerdict ? '#7A5A10' : '#2E5424',
      }}>
        <b>Vonis vs asumsi simulasi (Gaussian isotropik i.i.d.):</b> {a.chr.verdict}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 20, marginTop: 18 }}>
        <div>
          <h3 style={h3}>Karakterisasi derau</h3>
          <CharTable chr={a.chr} />
        </div>
        <div>
          <h3 style={h3}>Replay vs simulasi</h3>
          <ReplayTable a={a} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 20, marginTop: 18 }}>
        <div>
          <h3 style={h3}>Lintasan (bidang E–N)</h3>
          <Legend items={[{ color: V.s1, label: 'Titik GPS mentah' }, { color: V.s2, label: 'Referensi terhalus (MA-11)', thick: true }]} />
          <TrackChart a={a} />
        </div>
        <div>
          <h3 style={h3}>Histogram residual vs Gaussian</h3>
          <HistChart a={a} />
        </div>
        <div>
          <h3 style={h3}>Autokorelasi residual</h3>
          <Legend items={[{ color: V.s1, label: 'East' }, { color: V.s2, label: 'North' }]} />
          <AcfChart a={a} />
        </div>
      </div>
    </div>
  );
}

// ==================== sesi dari perangkat (server) ====================

interface ServerTrace {
  id: string; label: string; started_at: number; ended_at: number | null;
  point_count: number; device: string | null; created_at: string; user_name: string | null;
}
interface ServerPoint { t: number; lat: number; lon: number; acc: number | null; }

/** Susun GPX dari titik server → lewat parser yang sama dengan berkas unggahan
 *  (satu jalur kode untuk validasi/dedup/segmen). */
function pointsToGpx(label: string, points: ServerPoint[]): string {
  const pts = points.map((p) => {
    const acc = p.acc != null ? `<extensions><accuracy>${p.acc}</accuracy></extensions>` : '';
    return `<trkpt lat="${p.lat}" lon="${p.lon}"><time>${new Date(p.t).toISOString()}</time>${acc}</trkpt>`;
  });
  return `<gpx version="1.1"><trk><name>${label}</name><trkseg>${pts.join('')}</trkseg></trk></gpx>`;
}

export default function GpsValidation() {
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [traces, setTraces] = useState<ServerTrace[] | null>(null);
  const [traceErr, setTraceErr] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const loadTraces = useCallback(() => {
    api<ServerTrace[]>('/gps-traces')
      .then(setTraces)
      .catch((e) => setTraceErr(e instanceof Error ? e.message : 'Server tidak terjangkau'));
  }, []);
  useEffect(loadTraces, [loadTraces]);

  const analyzeServerTrace = async (t: ServerTrace) => {
    setLoadingId(t.id);
    try {
      const detail = await api<ServerTrace & { points: ServerPoint[] }>(`/gps-traces/${t.id}`);
      const name = `${t.label} — ${t.user_name ?? 'tanpa nama'} (${new Date(Number(t.started_at)).toLocaleString('id-ID')})`;
      setItems((prev) => [analyze(name, pointsToGpx(t.label, detail.points), 'server.gpx'), ...prev]);
    } catch (e) {
      setItems((prev) => [{ file: t.label, error: e instanceof Error ? e.message : 'Gagal memuat' }, ...prev]);
    } finally { setLoadingId(null); }
  };

  const deleteServerTrace = async (t: ServerTrace) => {
    if (!window.confirm(`Hapus sesi "${t.label}" dari server?`)) return;
    await api(`/gps-traces/${t.id}`, { method: 'DELETE' });
    loadTraces();
  };

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    setBusy(true);
    const results: Item[] = [];
    for (const f of Array.from(files)) {
      const text = await f.text();
      results.push(analyze(f.name, text));
    }
    setItems((prev) => [...results, ...prev]);
    setBusy(false);
  }, []);

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: C.text, margin: '0 0 4px' }}>Validasi GPS</h1>
      <p style={{ fontSize: 13, color: C.muted, margin: '0 0 20px', maxWidth: 720 }}>
        Unggah trace GPX/CSV dari Perekam GPS aplikasi (atau perekam lain). Analisis berjalan di browser
        memakai algoritma produksi yang sama dengan aplikasi jamaah — karakterisasi derau, replay 6 algoritma,
        dan perbandingan dengan prediksi simulasi Monte Carlo. Hasil resmi untuk naskah tetap lewat
        <code style={{ margin: '0 4px' }}>npm run replay</code> agar tercatat di repo.
      </p>

      <label
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files); }}
        style={{
          display: 'block', border: `2px dashed ${drag ? C.primary : C.faint}`, borderRadius: 14,
          padding: '34px 20px', textAlign: 'center', cursor: 'pointer', marginBottom: 24,
          background: drag ? '#FBF2EE' : C.card, transition: 'all .15s',
        }}
      >
        <input
          type="file" accept=".gpx,.csv" multiple style={{ display: 'none' }}
          onChange={(e) => { if (e.target.files?.length) handleFiles(e.target.files); e.target.value = ''; }}
        />
        <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>
          {busy ? 'Menganalisis…' : 'Klik atau seret berkas GPX/CSV ke sini'}
        </div>
        <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>Bisa beberapa berkas sekaligus · data tidak dikirim ke server</div>
      </label>

      {/* sesi yang diunggah petugas dari aplikasi */}
      <div style={{ ...card, marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ ...h3, margin: 0 }}>Rekaman dari perangkat</h3>
          <button onClick={loadTraces} style={{
            background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 8,
            padding: '5px 12px', fontSize: 12, fontWeight: 600, color: C.muted, cursor: 'pointer',
          }}>Muat ulang</button>
        </div>
        {traceErr && <div style={{ fontSize: 12.5, color: C.muted, marginTop: 10 }}>
          Tidak bisa memuat daftar dari server ({traceErr}) — unggah berkas manual tetap bisa dipakai.
        </div>}
        {traces && traces.length === 0 && (
          <div style={{ fontSize: 12.5, color: C.muted, marginTop: 10 }}>
            Belum ada rekaman terunggah. Di aplikasi: Alat Ibadah → Perekam GPS → ikon awan pada sesi.
          </div>
        )}
        {traces && traces.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8 }}>
            <thead><tr>
              <th style={th}>Label</th><th style={th}>Petugas</th><th style={th}>Waktu</th>
              <th style={th}>Titik</th><th style={th}>Perangkat</th><th style={th}></th>
            </tr></thead>
            <tbody>{traces.map((t) => (
              <tr key={t.id}>
                <td style={{ ...td, fontWeight: 600 }}>{t.label}</td>
                <td style={td}>{t.user_name ?? '—'}</td>
                <td style={td}>{new Date(Number(t.started_at)).toLocaleString('id-ID')}</td>
                <td style={td}>{t.point_count}</td>
                <td style={td}>{t.device ?? '—'}</td>
                <td style={{ ...td, whiteSpace: 'nowrap', textAlign: 'right' }}>
                  <button onClick={() => analyzeServerTrace(t)} disabled={loadingId === t.id} style={{
                    background: C.primary, color: '#fff', border: 'none', borderRadius: 8,
                    padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    opacity: loadingId === t.id ? 0.6 : 1,
                  }}>{loadingId === t.id ? 'Memuat…' : 'Analisis'}</button>
                  <button onClick={() => deleteServerTrace(t)} style={{
                    background: 'transparent', color: C.danger, border: `1px solid ${C.border}`,
                    borderRadius: 8, padding: '6px 10px', fontSize: 12, fontWeight: 600,
                    cursor: 'pointer', marginLeft: 6,
                  }}>Hapus</button>
                </td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>

      {items.map((it, i) => it.error !== undefined ? (
        <div key={i} style={{ ...card, marginBottom: 20, borderColor: C.danger }}>
          <b style={{ color: C.danger }}>{it.file}</b>
          <div style={{ fontSize: 13, color: C.text, marginTop: 4 }}>Gagal dianalisis: {it.error}</div>
        </div>
      ) : (
        <TraceCard key={i} a={it} />
      ))}
    </div>
  );
}
