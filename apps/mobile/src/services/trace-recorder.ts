/*
 * Perekam trace GPS untuk validasi lapangan (riset).
 *
 * Merekam via expo-location — STACK YANG SAMA dengan deteksi ritual produksi
 * (watchSacredLocation memakai Accuracy.BestForNavigation). Perbedaan yang
 * disengaja untuk kelengkapan data: timeInterval 1000 ms dan distanceInterval 0
 * (tanpa penyaringan jarak), agar derau saat diam ikut terekam.
 *
 * Penyimpanan: SQLite terpisah (gps-traces.db) — tidak menyentuh data aplikasi.
 * Ekspor: GPX 1.1 dengan <accuracy> per titik, dibagikan via share sheet,
 * kemudian ditaruh di field_logs/ repo dan diproses `npm run replay`.
 */
import * as Location from 'expo-location';
import * as SQLite from 'expo-sqlite';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Device from 'expo-device';
import { api } from './api';

export interface TraceSession {
  id: number;
  label: string;
  started_at: number;   // epoch ms
  ended_at: number | null;
  point_count: number;
  uploaded_at: number | null;
}

export interface LivePoint {
  t: number; lat: number; lon: number; acc: number | null;
}

let db: SQLite.SQLiteDatabase | null = null;

async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  db = await SQLite.openDatabaseAsync('gps-traces.db');
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      label TEXT NOT NULL,
      started_at INTEGER NOT NULL,
      ended_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS points (
      session_id INTEGER NOT NULL,
      t INTEGER NOT NULL,
      lat REAL NOT NULL,
      lon REAL NOT NULL,
      acc REAL
    );
    CREATE INDEX IF NOT EXISTS idx_points_session ON points(session_id);
  `);
  // kolom baru untuk DB yang sudah ada di perangkat (abaikan bila sudah ada)
  try { await db.execAsync('ALTER TABLE sessions ADD COLUMN uploaded_at INTEGER'); } catch { /* sudah ada */ }
  return db;
}

// ==================== PEREKAMAN ====================

let sub: Location.LocationSubscription | null = null;
let activeSessionId: number | null = null;

export function isRecording(): boolean { return activeSessionId !== null; }

export async function startRecording(
  label: string,
  onPoint: (p: LivePoint, count: number) => void,
): Promise<number> {
  if (activeSessionId !== null) throw new Error('Perekaman lain masih berjalan');
  const d = await getDb();
  const res = await d.runAsync(
    'INSERT INTO sessions (label, started_at) VALUES (?, ?)', label, Date.now(),
  );
  activeSessionId = res.lastInsertRowId;
  let count = 0;

  sub = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.BestForNavigation, // sama dengan watchSacredLocation
      timeInterval: 1000,
      distanceInterval: 0, // rekam semua titik, termasuk saat diam
    },
    (loc) => {
      const p: LivePoint = {
        t: loc.timestamp,
        lat: loc.coords.latitude,
        lon: loc.coords.longitude,
        acc: loc.coords.accuracy,
      };
      count++;
      const sid = activeSessionId;
      if (sid !== null) {
        d.runAsync('INSERT INTO points (session_id, t, lat, lon, acc) VALUES (?, ?, ?, ?, ?)',
          sid, p.t, p.lat, p.lon, p.acc).catch(() => {});
      }
      onPoint(p, count);
    },
  );
  return activeSessionId;
}

export async function stopRecording(): Promise<void> {
  sub?.remove();
  sub = null;
  if (activeSessionId !== null) {
    const d = await getDb();
    await d.runAsync('UPDATE sessions SET ended_at = ? WHERE id = ?', Date.now(), activeSessionId);
    activeSessionId = null;
  }
}

// ==================== SESI ====================

export async function listSessions(): Promise<TraceSession[]> {
  const d = await getDb();
  return d.getAllAsync<TraceSession>(`
    SELECT s.id, s.label, s.started_at, s.ended_at, s.uploaded_at,
           (SELECT COUNT(*) FROM points p WHERE p.session_id = s.id) AS point_count
    FROM sessions s ORDER BY s.started_at DESC
  `);
}

export async function deleteSession(id: number): Promise<void> {
  const d = await getDb();
  await d.runAsync('DELETE FROM points WHERE session_id = ?', id);
  await d.runAsync('DELETE FROM sessions WHERE id = ?', id);
}

// ==================== EKSPOR GPX ====================

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'trace';
}

export async function buildGpx(sessionId: number): Promise<{ filename: string; gpx: string }> {
  const d = await getDb();
  const session = await d.getFirstAsync<TraceSession>(
    'SELECT * FROM sessions WHERE id = ?', sessionId,
  );
  if (!session) throw new Error('Sesi tidak ditemukan');
  const pts = await d.getAllAsync<{ t: number; lat: number; lon: number; acc: number | null }>(
    'SELECT t, lat, lon, acc FROM points WHERE session_id = ? ORDER BY t', sessionId,
  );
  if (pts.length === 0) throw new Error('Sesi tidak memiliki titik');

  const trkpts = pts.map((p) => {
    const accTag = p.acc != null ? `<extensions><accuracy>${p.acc.toFixed(1)}</accuracy></extensions>` : '';
    return `  <trkpt lat="${p.lat.toFixed(7)}" lon="${p.lon.toFixed(7)}"><time>${new Date(p.t).toISOString()}</time>${accTag}</trkpt>`;
  });
  const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Mabrur Field Recorder (expo-location BestForNavigation, 1 s)">
 <trk><name>${session.label}</name><trkseg>
${trkpts.join('\n')}
 </trkseg></trk>
</gpx>
`;
  const date = new Date(session.started_at).toISOString().slice(0, 10);
  return { filename: `mabrur-${slug(session.label)}-${date}.gpx`, gpx };
}

/** Unggah sesi ke server (tabel gps_trace_sessions) agar bisa dianalisis dari admin. */
export async function uploadSession(sessionId: number): Promise<void> {
  const d = await getDb();
  const session = await d.getFirstAsync<TraceSession>(
    'SELECT * FROM sessions WHERE id = ?', sessionId,
  );
  if (!session) throw new Error('Sesi tidak ditemukan');
  const points = await d.getAllAsync<{ t: number; lat: number; lon: number; acc: number | null }>(
    'SELECT t, lat, lon, acc FROM points WHERE session_id = ? ORDER BY t', sessionId,
  );
  if (points.length < 10) throw new Error('Sesi terlalu pendek untuk diunggah (< 10 titik)');
  await api.uploadGpsTrace({
    label: session.label,
    started_at: session.started_at,
    ended_at: session.ended_at,
    device: [Device.manufacturer, Device.modelName].filter(Boolean).join(' ') || undefined,
    points,
  });
  await d.runAsync('UPDATE sessions SET uploaded_at = ? WHERE id = ?', Date.now(), sessionId);
}

export async function exportSession(sessionId: number): Promise<void> {
  const { filename, gpx } = await buildGpx(sessionId);
  const file = new File(Paths.cache, filename);
  if (file.exists) file.delete();
  file.write(gpx);
  if (!(await Sharing.isAvailableAsync())) throw new Error('Share sheet tidak tersedia di perangkat ini');
  await Sharing.shareAsync(file.uri, { mimeType: 'application/gpx+xml', dialogTitle: filename });
}
