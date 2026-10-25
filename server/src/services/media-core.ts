// Logika murni Dokumentasi rombongan (tanpa DB/FS) — dites di tests/media-core.test.ts.
// Keputusan produk (2026-10-24): kuota 2 GB per rombongan, masa simpan 180 hari sejak diunggah,
// jamaah & muthawwif boleh mengunggah; unggahan muthawwif ditandai "resmi".

export const MEDIA_QUOTA_BYTES = 2 * 1024 * 1024 * 1024;
export const MEDIA_RETENTION_DAYS = 180;
// HP mengompres foto ke sisi panjang 1920 px (~0,3–0,6 MB); batas ini pengaman (body ditampung di RAM).
export const MAX_PHOTO_BYTES = 4 * 1024 * 1024;
export const MAX_THUMB_BYTES = 512 * 1024;
export const MAX_CAPTION_LENGTH = 200;
// Jam HP boleh sedikit maju; lebih dari ini dianggap salah → pakai waktu server.
const MAX_FUTURE_SKEW_MS = 24 * 60 * 60 * 1000;

export type ImageMime = 'image/jpeg' | 'image/png' | 'image/webp';

const EXT: Record<ImageMime, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

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

export function extensionFor(mime: ImageMime): string {
  return EXT[mime];
}

export function mimeFromFileName(name: string): ImageMime | null {
  const ext = name.slice(name.lastIndexOf('.') + 1).toLowerCase();
  const hit = (Object.keys(EXT) as ImageMime[]).find((m) => EXT[m] === ext);
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
