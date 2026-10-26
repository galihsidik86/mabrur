// Logika murni Dokumentasi di HP (tanpa impor Expo) — dites dari server/tests/documentation-core.test.ts.

export type AlbumItem = {
  id: string;
  taken_at: string;
  schedule_id: string | null;
  schedule_title: string | null;
};

export type AlbumSection<T> = { key: string; title: string; data: T[] };

// Foto dikompres di HP sebelum diunggah (hemat kuota data & kuota rombongan).
export const PHOTO_MAX_SIDE = 1920;
export const PHOTO_QUALITY = 0.8;
export const THUMB_MAX_SIDE = 480;
export const THUMB_QUALITY = 0.7;
export const MAX_PICK = 10;

// Video (keputusan 2026-10-25): maks 60 detik, dikompres ke 720p (sisi panjang 1280) ~1,5 Mbps ≈ 12 MB/menit.
// Batas server: 60 dtk (+1 dtk kelonggaran) & 40 MB — lihat server/src/services/media-core.ts.
export const VIDEO_MAX_DURATION_MS = 60_000;
export const VIDEO_MAX_SIDE = 1280;
export const VIDEO_BITRATE = 1_500_000;
export const MAX_VIDEO_BYTES = 40 * 1024 * 1024;
// Kamera sering mencatat 60,3 dtk untuk rekaman berbatas 60 dtk; tetap di bawah kelonggaran server.
const DURATION_TOLERANCE_MS = 500;

// Setelah sekian kali gagal sementara (5xx/timeout) berturut-turut, tandai gagal agar terlihat di layar.
export const MAX_UPLOAD_ATTEMPTS = 10;

const RETRY_BASE_MS = 30_000;
const RETRY_MAX_MS = 30 * 60_000;

// Batas waktu satu unggahan: minimal 3 menit; video besar diberi waktu dengan asumsi sinyal lemah (~32 KB/dtk),
// dibatasi 14 menit (server memutus permintaan di 15 menit).
const MIN_UPLOAD_TIMEOUT_MS = 3 * 60_000;
const MAX_UPLOAD_TIMEOUT_MS = 14 * 60_000;
const SLOW_LINK_BYTES_PER_SEC = 32 * 1024;

export function uploadTimeoutMs(bytes: number): number {
  const needed = (bytes / SLOW_LINK_BYTES_PER_SEC) * 1000;
  return Math.round(Math.min(MAX_UPLOAD_TIMEOUT_MS, Math.max(MIN_UPLOAD_TIMEOUT_MS, needed)));
}

// Durasi tidak diketahui (null) tidak ditolak di HP: server tetap membatasi ukuran berkas.
export function isVideoTooLong(durationMs: number | null): boolean {
  return durationMs != null && durationMs > VIDEO_MAX_DURATION_MS + DURATION_TOLERANCE_MS;
}

// Label durasi di album: "0:45", "1:00". Tidak diketahui → ''.
export function formatDuration(durationMs: number | null): string {
  if (!durationMs || durationMs <= 0) return '';
  const total = Math.round(durationMs / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

const EXT_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
};

// Ekstensi berkas unduhan (galeri HP & aplikasi tujuan berbagi mengenali jenis dari ekstensi).
export function fileExtensionFor(mime: string): string {
  return EXT_BY_MIME[mime] ?? 'jpg';
}

// UUID v4 sebagai kunci idempoten unggahan (client_uuid). Tidak perlu kriptografis: cukup unik per pengguna.
export function makeUuidV4(random: () => number = Math.random): string {
  const hex = Array.from({ length: 32 }, () => Math.floor(random() * 16));
  hex[12] = 4;
  hex[16] = (hex[16] & 0x3) | 0x8;
  const s = hex.map((n) => n.toString(16)).join('');
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}

// Ukuran baru dengan sisi terpanjang ≤ maxSide; tidak pernah memperbesar.
export function fitWithin(width: number, height: number, maxSide: number): { width: number; height: number } {
  if (width <= 0 || height <= 0) return { width: maxSide, height: maxSide };
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

// Jeda coba ulang unggahan: 30 dtk, 1 mnt, 2 mnt, … maks 30 mnt.
export function retryDelayMs(attempts: number): number {
  return Math.min(RETRY_BASE_MS * 2 ** Math.max(0, attempts), RETRY_MAX_MS);
}

// Status HTTP yang tidak akan berhasil walau dicoba ulang (data/izin salah, kuota penuh).
export function isPermanentFailure(status: number): boolean {
  return status === 400 || status === 403 || status === 404 || status === 413 || status === 415;
}

// Tanggal lokal HP (YYYY-MM-DD), bukan UTC — foto subuh di Makkah tetap masuk hari yang benar.
export function localDayKey(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// Album per hari, hari terbaru dulu; urutan foto di dalam hari mengikuti input (server: terbaru dulu).
export function groupByDay<T extends AlbumItem>(items: readonly T[], formatDay: (key: string) => string): AlbumSection<T>[] {
  const map = new Map<string, T[]>();
  for (const it of items) {
    const key = localDayKey(it.taken_at);
    const list = map.get(key);
    if (list) list.push(it);
    else map.set(key, [it]);
  }
  return [...map.entries()]
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([key, data]) => ({ key, title: formatDay(key), data }));
}

// Album per kegiatan (menu Jadwal). Foto tanpa kegiatan dikumpulkan di bagian terakhir.
export function groupBySchedule<T extends AlbumItem>(items: readonly T[], otherTitle: string): AlbumSection<T>[] {
  const map = new Map<string, { title: string; latest: number; data: T[] }>();
  const others: T[] = [];
  for (const it of items) {
    if (!it.schedule_id) { others.push(it); continue; }
    const at = new Date(it.taken_at).getTime();
    const entry = map.get(it.schedule_id);
    if (entry) {
      entry.data.push(it);
      entry.latest = Math.max(entry.latest, at);
    } else {
      map.set(it.schedule_id, { title: it.schedule_title ?? otherTitle, latest: at, data: [it] });
    }
  }
  const sections: AlbumSection<T>[] = [...map.entries()]
    .sort(([, a], [, b]) => b.latest - a.latest)
    .map(([key, v]) => ({ key, title: v.title, data: v.data }));
  if (others.length) sections.push({ key: 'other', title: otherTitle, data: others });
  return sections;
}

// Baris grid: potong list jadi kelompok berisi `size`.
export function chunk<T>(items: readonly T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) rows.push(items.slice(i, i + size));
  return rows;
}

// Kegiatan bawaan saat mengunggah: yang sedang berlangsung, atau yang dimulai paling dekat sebelum sekarang
// (dalam 12 jam). Tidak ada → null (pengunggah bisa memilih sendiri).
export function suggestSchedule<T extends { id: string; start_time: string; end_time?: string | null }>(
  schedules: readonly T[],
  now: Date,
  windowMs = 12 * 60 * 60_000,
): string | null {
  const t = now.getTime();
  let best: { id: string; start: number } | null = null;
  for (const s of schedules) {
    const start = new Date(s.start_time).getTime();
    if (Number.isNaN(start) || start > t) continue;
    const end = s.end_time ? new Date(s.end_time).getTime() : Number.NaN;
    if (!Number.isNaN(end) && t <= end) return s.id;
    if (t - start <= windowMs && (!best || start > best.start)) best = { id: s.id, start };
  }
  return best?.id ?? null;
}

// "1,2 GB" / "350 MB" dengan desimal koma (Indonesia) atau titik (English).
export function formatBytes(bytes: number, decimalSep = ','): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let v = Math.max(0, bytes);
  let i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  const text = i === 0 || v >= 100 ? String(Math.round(v)) : v.toFixed(1).replace('.', decimalSep);
  return `${text} ${units[i]}`;
}

// EXIF DateTimeOriginal "YYYY:MM:DD HH:MM:SS" = jam lokal kamera tanpa zona → ISO (anggap zona HP).
export function parseExifDate(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const m = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(raw.trim());
  if (!m) return null;
  const [y, mo, d, h, mi, s] = m.slice(1).map(Number);
  const date = new Date(y, mo - 1, d, h, mi, s);
  if (Number.isNaN(date.getTime()) || date.getMonth() !== mo - 1 || y < 2000) return null;
  return date.toISOString();
}

// Waktu kedaluwarsa (detik epoch) dari access token JWT; rusak → null.
export function jwtExpiry(token: string): number | null {
  const part = token.split('.')[1];
  if (!part) return null;
  try {
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=');
    const payload = JSON.parse(atob(b64)) as { exp?: unknown };
    return typeof payload.exp === 'number' ? payload.exp : null;
  } catch {
    return null;
  }
}
