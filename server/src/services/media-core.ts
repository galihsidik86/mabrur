// Logika murni Dokumentasi rombongan (tanpa DB/FS) — dites di tests/media-core.test.ts.
// Keputusan produk (2026-10-24): kuota 2 GB per rombongan, masa simpan 180 hari sejak diunggah,
// jamaah & muthawwif boleh mengunggah; unggahan muthawwif ditandai "resmi".

export const MEDIA_QUOTA_BYTES = 2 * 1024 * 1024 * 1024;
export const MEDIA_RETENTION_DAYS = 180;
// HP mengompres foto ke sisi panjang 1920 px (~0,3–0,6 MB); batas ini pengaman (body foto ditampung di RAM).
export const MAX_PHOTO_BYTES = 4 * 1024 * 1024;
export const MAX_THUMB_BYTES = 512 * 1024;
// Video (keputusan 2026-10-25): maks 60 detik, dikompres HP ke 720p ~1,5 Mbps (≈12 MB/menit).
// Batas byte ini pengaman bila kompresi di HP gagal/dilewati; body video di-stream ke disk, bukan RAM.
export const MAX_VIDEO_DURATION_MS = 60_000;
export const MAX_VIDEO_BYTES = 40 * 1024 * 1024;
// HP membulatkan durasi berbeda-beda (mis. 60,4 dtk dari rekaman 60 dtk) → beri sedikit kelonggaran.
const DURATION_TOLERANCE_MS = 1_000;
export const MAX_CAPTION_LENGTH = 200;
// Jam HP boleh sedikit maju; lebih dari ini dianggap salah → pakai waktu server.
const MAX_FUTURE_SKEW_MS = 24 * 60 * 60 * 1000;

export type ImageMime = 'image/jpeg' | 'image/png' | 'image/webp';
export type VideoMime = 'video/mp4' | 'video/quicktime';
export type MediaMime = ImageMime | VideoMime;
export type MediaKind = 'photo' | 'video';

const EXT: Record<MediaMime, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
};

// Brand utama kotak 'ftyp' yang diterima sebagai video MP4 (keluaran kamera Android/iOS & kompresor).
const MP4_BRANDS = new Set(['isom', 'iso2', 'iso4', 'iso5', 'iso6', 'mp41', 'mp42', 'avc1', 'M4V ', 'MSNV', 'dash']);

// Jenis berkas ditentukan dari isi (magic bytes), bukan dari Content-Type kiriman klien.
export function sniffImage(buf: Buffer): ImageMime | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'image/png';
  }
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    return 'image/webp';
  }
  return null;
}

// MP4/MOV diawali kotak 'ftyp' di byte 4–8, diikuti brand utama (byte 8–12).
export function sniffVideo(buf: Buffer): VideoMime | null {
  if (buf.length < 12 || buf.toString('ascii', 4, 8) !== 'ftyp') return null;
  const brand = buf.toString('ascii', 8, 12);
  if (brand === 'qt  ') return 'video/quicktime';
  return MP4_BRANDS.has(brand) ? 'video/mp4' : null;
}

export function sniffMedia(buf: Buffer): { kind: MediaKind; mime: MediaMime } | null {
  const image = sniffImage(buf);
  if (image) return { kind: 'photo', mime: image };
  const video = sniffVideo(buf);
  return video ? { kind: 'video', mime: video } : null;
}

// Jalur unggah dipilih dari Content-Type: video di-stream ke disk, foto ditampung di RAM (kecil).
// Jenis sebenarnya tetap diperiksa dari isi berkas setelah diterima.
export function uploadKindFor(contentType: string | undefined): MediaKind {
  return (contentType ?? '').trim().toLowerCase().startsWith('video/') ? 'video' : 'photo';
}

// Durasi video dari HP (ms). Kosong/tidak valid → null; jelas melebihi batas → RangeError (ditolak 400).
// Server tidak mengurai video, jadi batas keras tetap MAX_VIDEO_BYTES.
export function normalizeDurationMs(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n > MAX_VIDEO_DURATION_MS + DURATION_TOLERANCE_MS) {
    throw new RangeError(`Durasi video maksimal ${MAX_VIDEO_DURATION_MS / 1000} detik`);
  }
  return Math.round(n);
}

export function extensionFor(mime: MediaMime): string {
  return EXT[mime];
}

export function mimeFromFileName(name: string): MediaMime | null {
  const ext = name.slice(name.lastIndexOf('.') + 1).toLowerCase();
  const hit = (Object.keys(EXT) as MediaMime[]).find((m) => EXT[m] === ext);
  return hit ?? null;
}

export function expiresAt(from: Date, days = MEDIA_RETENTION_DAYS): Date {
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
}

export function exceedsQuota(usedBytes: number, incomingBytes: number, quota = MEDIA_QUOTA_BYTES): boolean {
  return usedBytes + incomingBytes > quota;
}

// Waktu foto dari HP (EXIF/jam HP). Tidak valid atau terlalu jauh di masa depan → waktu server.
export function normalizeTakenAt(raw: string | undefined, now: Date): Date {
  if (!raw) return now;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return now;
  if (d.getTime() - now.getTime() > MAX_FUTURE_SKEW_MS) return now;
  return d;
}

export type MediaActor = {
  userId: string;
  role: 'admin' | 'muthawwif' | 'jamaah';
  // Peran di rombongan media tersebut (null = bukan anggota aktif).
  groupRole: 'muthawwif' | 'jamaah' | null;
};

// Pengunggah boleh menghapus unggahannya; muthawwif rombongan & admin boleh menghapus apa pun.
export function canDeleteMedia(actor: MediaActor, uploaderId: string | null): boolean {
  if (actor.role === 'admin') return true;
  if (actor.groupRole === 'muthawwif') return true;
  return actor.groupRole !== null && uploaderId === actor.userId;
}

// Unggahan dianggap "resmi" bila diunggah muthawwif rombongan itu atau admin.
export function isOfficialUpload(actor: MediaActor): boolean {
  return actor.role === 'admin' || actor.groupRole === 'muthawwif';
}

// Caption: rapikan spasi; kosong → null.
export function normalizeCaption(raw: string | undefined): string | null {
  const c = (raw ?? '').replace(/\s+/g, ' ').trim();
  return c ? c.slice(0, MAX_CAPTION_LENGTH) : null;
}
