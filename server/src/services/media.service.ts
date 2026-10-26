// Dokumentasi rombongan: simpan/baca/hapus foto & video + metadata. Logika murni ada di media-core.ts.
// Berkas di MEDIA_DIR/<group_id>/<uuid>.<ext> — di luar folder publik /uploads, dilayani lewat
// GET /media/:id/file setelah cek keanggotaan.
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Transform, type Readable } from 'stream';
import { pipeline } from 'stream/promises';
import type { Knex } from 'knex';
import { db } from '../db';
import { config } from '../config';
import { logger } from '../logger';
import { AppError } from '../middleware/error-handler';
import { audit } from './audit.service';
import {
  canDeleteMedia,
  exceedsQuota,
  expiresAt,
  extensionFor,
  isOfficialUpload,
  mimeFromFileName,
  MAX_PHOTO_BYTES,
  MAX_VIDEO_BYTES,
  MEDIA_QUOTA_BYTES,
  sniffImage,
  sniffMedia,
  type MediaActor,
  type MediaKind,
} from './media-core';

export const MEDIA_DIR = config.MEDIA_DIR
  ? path.resolve(config.MEDIA_DIR)
  : path.resolve(__dirname, '../../storage/media');

// Berkas di disk tanpa baris DB (unggahan gagal di tengah, crash) baru dihapus setelah selama ini,
// agar unggahan yang sedang berjalan tidak ikut tersapu.
const ORPHAN_MIN_AGE_MS = 60 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000;
const CLEANUP_FIRST_DELAY_MS = 60 * 1000;

type Auth = { sub: string; role: MediaActor['role'] };

type MediaRow = {
  id: string;
  group_id: string;
  kind: MediaKind;
  uploader_id: string | null;
  mime: string;
  file_name: string;
  thumb_name: string | null;
  thumb_bytes: number;
};

const PUBLIC_FIELDS = [
  'id', 'group_id', 'uploader_id', 'schedule_id', 'kind', 'mime', 'size_bytes',
  'width', 'height', 'duration_ms', 'caption', 'is_official', 'taken_at', 'created_at', 'expires_at',
];

// Byte awal berkas yang disimpan untuk deteksi jenis (cukup untuk kotak 'ftyp' MP4/MOV).
const SNIFF_HEAD_BYTES = 64;

export async function getActor(groupId: string, auth: Auth): Promise<MediaActor> {
  const member = await db('group_members')
    .where({ group_id: groupId, user_id: auth.sub, is_active: true })
    .first('role_in_group');
  return { userId: auth.sub, role: auth.role, groupRole: member?.role_in_group ?? null };
}

// Anggota aktif (atau admin) saja yang boleh melihat, mengunggah, dan mengubah.
export async function assertCanView(groupId: string, auth: Auth): Promise<MediaActor> {
  const actor = await getActor(groupId, auth);
  if (actor.role !== 'admin' && actor.groupRole === null) {
    throw new AppError(403, 'Anda bukan anggota rombongan ini', 'FORBIDDEN');
  }
  return actor;
}

async function usedBytes(groupId: string, conn: Knex | Knex.Transaction = db): Promise<number> {
  const row = await conn('group_media')
    .where('group_id', groupId)
    .andWhere('expires_at', '>', new Date())
    .first(conn.raw('COALESCE(SUM(size_bytes + thumb_bytes), 0)::bigint AS used'));
  return Number(row?.used ?? 0);
}

function quotaError(): AppError {
  return new AppError(413, 'Kuota dokumentasi rombongan (2 GB) sudah penuh', 'QUOTA_EXCEEDED');
}

export async function listMedia(
  groupId: string,
  opts: { page: number; limit: number; officialOnly: boolean },
) {
  const base = db('group_media as m')
    .where('m.group_id', groupId)
    .andWhere('m.expires_at', '>', new Date())
    .modify((q) => { if (opts.officialOnly) q.andWhere('m.is_official', true); });

  const [{ count }] = await base.clone().count<{ count: string }[]>('* as count');
  const rows = await base.clone()
    .leftJoin('users as u', 'u.id', 'm.uploader_id')
    .leftJoin('schedules as s', 's.id', 'm.schedule_id')
    .select([
      ...PUBLIC_FIELDS.map((f) => `m.${f}`),
      'u.name as uploader_name',
      's.title as schedule_title',
      db.raw('(m.thumb_name IS NOT NULL) AS has_thumb'),
    ])
    .orderBy('m.taken_at', 'desc')
    .orderBy('m.id', 'desc')
    .limit(opts.limit)
    .offset((opts.page - 1) * opts.limit);

  return {
    data: rows,
    meta: {
      total: Number(count),
      page: opts.page,
      limit: opts.limit,
      used_bytes: await usedBytes(groupId),
      quota_bytes: MEDIA_QUOTA_BYTES,
    },
  };
}

function fileFor(groupId: string, name: string): string {
  return path.join(MEDIA_DIR, groupId, name);
}

// Hapus berkas tanpa menggagalkan pemanggil; sisa yang gagal dihapus ditangani sweepOrphanFiles.
async function unlinkLogged(file: string): Promise<void> {
  try {
    await fs.promises.unlink(file);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') logger.warn({ err, file }, 'Gagal menghapus berkas dokumentasi');
  }
}

async function removeFiles(row: Pick<MediaRow, 'group_id' | 'file_name' | 'thumb_name'>): Promise<void> {
  await unlinkLogged(fileFor(row.group_id, row.file_name));
  if (row.thumb_name) await unlinkLogged(fileFor(row.group_id, row.thumb_name));
}

async function findByClientUuid(groupId: string, uploaderId: string, clientUuid: string) {
  return db('group_media')
    .where({ group_id: groupId, uploader_id: uploaderId, client_uuid: clientUuid })
    .first(PUBLIC_FIELDS);
}

const isUniqueViolation = (err: unknown) => (err as { code?: string }).code === '23505';

// Isi unggahan: foto ditampung di RAM (≤ 4 MB), video sudah di-stream ke berkas sementara di folder rombongan.
export type UploadSource =
  | { type: 'buffer'; buffer: Buffer }
  | { type: 'file'; path: string; size: number; head: Buffer };

function tooLargeError(limit: number, what: string): AppError {
  return new AppError(413, `Ukuran ${what} maksimal ${Math.round(limit / 1024 / 1024)} MB`, 'PAYLOAD_TOO_LARGE');
}

// Stream body video ke MEDIA_DIR/<group>/.incoming-<uuid>.part sambil menghitung ukuran (RAM tetap kecil).
// Gagal/terputus → berkas sementara dihapus; sisa yang lolos (proses mati) disapu sweepOrphanFiles.
export async function receiveVideo(
  body: Readable,
  groupId: string,
  declaredLength: number | null,
): Promise<Extract<UploadSource, { type: 'file' }>> {
  if (declaredLength !== null && declaredLength > MAX_VIDEO_BYTES) throw tooLargeError(MAX_VIDEO_BYTES, 'video');
  // Rombongan yang kuotanya jelas tidak cukup ditolak sebelum menulis puluhan MB ke disk.
  if (declaredLength !== null && exceedsQuota(await usedBytes(groupId), declaredLength)) throw quotaError();
  const dir = path.join(MEDIA_DIR, groupId);
  await fs.promises.mkdir(dir, { recursive: true });
  const tmp = path.join(dir, `.incoming-${crypto.randomUUID()}.part`);
  let size = 0;
  const head: Buffer[] = [];
  let headLen = 0;
  const meter = new Transform({
    transform(chunk: Buffer, _enc, cb) {
      size += chunk.length;
      if (size > MAX_VIDEO_BYTES) return cb(tooLargeError(MAX_VIDEO_BYTES, 'video'));
      if (headLen < SNIFF_HEAD_BYTES) {
        const part = chunk.subarray(0, SNIFF_HEAD_BYTES - headLen);
        head.push(part);
        headLen += part.length;
      }
      cb(null, chunk);
    },
  });
  // req TIDAK dimasukkan ke pipeline(): pipeline menghancurkan req saat galat, dan req yang hancur
  // membuat morgan/req.ip melempar di luar try (server crash). Putus koneksi dideteksi lewat 'close'.
  const onClose = () => {
    if (!(body as Readable & { complete?: boolean }).complete) {
      meter.destroy(new AppError(400, 'Unggahan video terputus', 'UPLOAD_ABORTED'));
    }
  };
  const onError = (err: Error) => meter.destroy(err);
  body.once('close', onClose);
  body.once('error', onError);
  const written = pipeline(meter, fs.createWriteStream(tmp, { flags: 'wx' }));
  body.pipe(meter);
  try {
    await written;
  } catch (err) {
    body.unpipe(meter);
    body.resume(); // buang sisa body agar respons galat (mis. 413) tetap bisa terkirim
    await unlinkLogged(tmp);
    throw err;
  } finally {
    body.off('close', onClose);
    body.off('error', onError);
  }
  if (size === 0) {
    await unlinkLogged(tmp);
    throw new AppError(400, 'Isi video kosong', 'VALIDATION_ERROR');
  }
  return { type: 'file', path: tmp, size, head: Buffer.concat(head) };
}

function sourceSize(source: UploadSource): number {
  return source.type === 'buffer' ? source.buffer.length : source.size;
}

// Jenis dari isi berkas, dan harus cocok dengan jalurnya: foto lewat RAM (batas 4 MB), video lewat disk.
// Mencegah foto besar menyelinap lewat jalur video yang batasnya lebih longgar.
function detectKind(source: UploadSource) {
  const detected = sniffMedia(source.type === 'buffer' ? source.buffer : source.head);
  const expected: MediaKind = source.type === 'buffer' ? 'photo' : 'video';
  if (!detected || detected.kind !== expected) {
    throw new AppError(
      415,
      expected === 'photo' ? 'Berkas bukan foto JPG/PNG/WebP' : 'Berkas bukan video MP4/MOV',
      'UNSUPPORTED_MEDIA',
    );
  }
  if (detected.kind === 'photo' && sourceSize(source) > MAX_PHOTO_BYTES) throw tooLargeError(MAX_PHOTO_BYTES, 'foto');
  return detected;
}

async function placeFile(source: UploadSource, dest: string): Promise<void> {
  if (source.type === 'buffer') {
    await fs.promises.mkdir(path.dirname(dest), { recursive: true });
    await fs.promises.writeFile(dest, source.buffer, { flag: 'wx' });
  } else {
    // Berkas sementara sudah di folder rombongan yang sama → rename atomik, tanpa salin ulang.
    await fs.promises.rename(source.path, dest);
  }
}

export type CreateMediaInput = {
  groupId: string;
  actor: MediaActor;
  source: UploadSource;
  clientUuid: string | null;
  caption: string | null;
  scheduleId: string | null;
  takenAt: Date;
  width: number | null;
  height: number | null;
  durationMs: number | null;
};

// Kembalikan { row, created }. client_uuid yang sama dari pengunggah yang sama → baris lama (tanpa unggah ulang).
export async function createMedia(input: CreateMediaInput) {
  const { source } = input;
  let placed = false;
  try {
    if (input.clientUuid) {
      const existing = await findByClientUuid(input.groupId, input.actor.userId, input.clientUuid);
      if (existing) return { row: existing, created: false };
    }
    const { kind, mime } = detectKind(source);
    const size = sourceSize(source);

    if (input.scheduleId) {
      const schedule = await db('schedules').where({ id: input.scheduleId, group_id: input.groupId }).first('id');
      if (!schedule) throw new AppError(400, 'Kegiatan tidak ditemukan di rombongan ini', 'VALIDATION_ERROR');
    }
    // Cek awal tanpa kunci: rombongan yang sudah penuh tidak perlu menulis ke disk sama sekali.
    if (exceedsQuota(await usedBytes(input.groupId), size)) throw quotaError();

    const id = crypto.randomUUID();
    const fileName = `${id}.${extensionFor(mime)}`;
    await placeFile(source, fileFor(input.groupId, fileName));
    placed = true;

    const now = new Date();
    let row;
    try {
      row = await db.transaction(async (trx) => {
        // Kunci baris rombongan agar dua unggahan bersamaan tidak sama-sama lolos cek kuota.
        await trx('groups').where('id', input.groupId).forUpdate().first('id');
        if (exceedsQuota(await usedBytes(input.groupId, trx), size)) throw quotaError();
        const [inserted] = await trx('group_media')
          .insert({
            id,
            group_id: input.groupId,
            uploader_id: input.actor.userId,
            schedule_id: input.scheduleId,
            kind,
            mime,
            file_name: fileName,
            size_bytes: size,
            width: input.width,
            height: input.height,
            duration_ms: kind === 'video' ? input.durationMs : null,
            caption: input.caption,
            is_official: isOfficialUpload(input.actor),
            taken_at: input.takenAt,
            created_at: now,
            expires_at: expiresAt(now),
            client_uuid: input.clientUuid,
          })
          .returning(PUBLIC_FIELDS);
        return inserted;
      });
    } catch (err) {
      await unlinkLogged(fileFor(input.groupId, fileName));
      // Dua permintaan dengan client_uuid sama berbalapan → yang kalah memakai baris pemenang.
      if (input.clientUuid && isUniqueViolation(err)) {
        const existing = await findByClientUuid(input.groupId, input.actor.userId, input.clientUuid);
        if (existing) return { row: existing, created: false };
      }
      throw err;
    }
    await audit(input.actor.userId, 'media.upload', 'group_media', id, { group_id: input.groupId, kind, bytes: size });
    return { row, created: true };
  } finally {
    // Berkas sementara video yang tidak jadi dipindahkan (duplikat, ditolak, kuota penuh) dibuang.
    if (!placed && source.type === 'file') await unlinkLogged(source.path);
  }
}

async function loadLive(mediaId: string): Promise<MediaRow> {
  const row = await db('group_media').where('id', mediaId).first();
  if (!row || new Date(row.expires_at) <= new Date()) {
    throw new AppError(404, 'Dokumentasi tidak ditemukan', 'NOT_FOUND');
  }
  return row;
}

// Pengunggah yang masih anggota aktif. Dipanggil sebelum body dibaca (route) dan lagi saat menyimpan.
export async function assertUploaderMember(mediaId: string, auth: Auth): Promise<MediaRow> {
  const row = await loadLive(mediaId);
  await assertCanView(row.group_id, auth);
  if (row.uploader_id !== auth.sub) throw new AppError(403, 'Hanya pengunggah yang dapat mengubah dokumentasi ini', 'FORBIDDEN');
  return row;
}

// Thumbnail selalu JPEG dengan nama tetap <id>_t.jpg → menimpa yang lama, tidak meninggalkan berkas yatim.
export async function setThumb(mediaId: string, auth: Auth, buffer: Buffer): Promise<void> {
  const row = await assertUploaderMember(mediaId, auth);
  if (sniffImage(buffer) !== 'image/jpeg') throw new AppError(415, 'Thumbnail harus JPG', 'UNSUPPORTED_MEDIA');
  const thumbName = `${row.id}_t.jpg`;
  await db.transaction(async (trx) => {
    await trx('groups').where('id', row.group_id).forUpdate().first('id');
    const current = await trx('group_media').where('id', row.id).first('thumb_bytes');
    if (!current) throw new AppError(404, 'Dokumentasi tidak ditemukan', 'NOT_FOUND');
    const used = (await usedBytes(row.group_id, trx)) - Number(current.thumb_bytes ?? 0);
    if (exceedsQuota(used, buffer.length)) throw quotaError();
    await trx('group_media').where('id', row.id).update({ thumb_name: thumbName, thumb_bytes: buffer.length });
    // Tulis ke nama sementara lalu rename (atomik): pembaca tak pernah melihat berkas setengah jadi,
    // dan bila penulisan gagal transaksi di-rollback sehingga thumb_bytes tetap cocok dengan berkas lama.
    const target = fileFor(row.group_id, thumbName);
    const tmp = `${target}.${process.pid}.tmp`;
    try {
      await fs.promises.writeFile(tmp, buffer);
      await fs.promises.rename(tmp, target);
    } catch (err) {
      await unlinkLogged(tmp);
      throw err;
    }
  });
}

// Path berkas untuk anggota rombongan; thumbnail jatuh ke foto asli bila belum dikirim.
export async function resolveFile(mediaId: string, auth: Auth, variant: 'file' | 'thumb') {
  const row = await loadLive(mediaId);
  await assertCanView(row.group_id, auth);
  const isFallback = variant === 'thumb' && !row.thumb_name;
  // Video tanpa thumbnail: jangan kirim berkas video sebagai gambar → HP menampilkan ikon pengganti.
  if (isFallback && row.kind === 'video') throw new AppError(404, 'Thumbnail belum tersedia', 'NOT_FOUND');
  const name = variant === 'thumb' && row.thumb_name ? row.thumb_name : row.file_name;
  return { path: fileFor(row.group_id, name), mime: mimeFromFileName(name) ?? row.mime, isFallback };
}

export async function updateCaption(mediaId: string, auth: Auth, caption: string | null): Promise<void> {
  const row = await assertUploaderMember(mediaId, auth);
  await db('group_media').where('id', row.id).update({ caption });
  await audit(auth.sub, 'media.caption', 'group_media', row.id);
}

export async function deleteMedia(mediaId: string, auth: Auth): Promise<void> {
  const row = await loadLive(mediaId);
  const actor = await getActor(row.group_id, auth);
  if (!canDeleteMedia(actor, row.uploader_id)) {
    throw new AppError(403, 'Anda tidak berhak menghapus dokumentasi ini', 'FORBIDDEN');
  }
  await db('group_media').where('id', row.id).delete();
  await removeFiles(row);
  await audit(auth.sub, 'media.delete', 'group_media', row.id, { group_id: row.group_id, uploader_id: row.uploader_id });
}

// Rombongan dihapus (baris media ikut CASCADE) → folder berkasnya juga dihapus.
export async function deleteGroupMediaFiles(groupId: string): Promise<void> {
  try {
    await fs.promises.rm(path.join(MEDIA_DIR, groupId), { recursive: true, force: true });
  } catch (err) {
    logger.warn({ err, groupId }, 'Gagal menghapus folder dokumentasi rombongan');
  }
}

// Hapus baris & berkas yang lewat masa simpan, per batch.
export async function cleanupExpiredMedia(batchSize = 500): Promise<number> {
  let total = 0;
  for (;;) {
    const rows: MediaRow[] = await db('group_media')
      .where('expires_at', '<=', new Date())
      .limit(batchSize)
      .select('id', 'group_id', 'uploader_id', 'mime', 'file_name', 'thumb_name', 'thumb_bytes');
    if (rows.length === 0) return total;
    await db('group_media').whereIn('id', rows.map((r) => r.id)).delete();
    for (const r of rows) await removeFiles(r);
    total += rows.length;
  }
}

// Berkas/folder di disk yang tidak lagi tercatat di DB (unggahan gagal, crash, hapus sebagian).
export async function sweepOrphanFiles(minAgeMs = ORPHAN_MIN_AGE_MS): Promise<number> {
  let entries: fs.Dirent[];
  try {
    entries = await fs.promises.readdir(MEDIA_DIR, { withFileTypes: true });
  } catch {
    return 0; // folder belum pernah dibuat
  }
  const cutoff = Date.now() - minAgeMs;
  let removed = 0;
  for (const dir of entries.filter((e) => e.isDirectory())) {
    const groupPath = path.join(MEDIA_DIR, dir.name);
    const rows: Array<{ file_name: string; thumb_name: string | null }> = await db('group_media')
      .where('group_id', dir.name)
      .select('file_name', 'thumb_name')
      .catch(() => []); // nama folder bukan UUID valid → anggap tanpa baris
    const known = new Set(rows.flatMap((r) => [r.file_name, r.thumb_name]).filter(Boolean));
    for (const name of await fs.promises.readdir(groupPath)) {
      if (known.has(name)) continue;
      const file = path.join(groupPath, name);
      const stat = await fs.promises.stat(file).catch(() => null);
      if (stat?.isFile() && stat.mtimeMs < cutoff) {
        await unlinkLogged(file);
        removed++;
      }
    }
  }
  return removed;
}

// Masa simpan ditegakkan otomatis oleh server (tidak bergantung cron terpisah); db:cleanup tetap bisa manual.
export function scheduleMediaCleanup(): void {
  const run = async () => {
    try {
      const expired = await cleanupExpiredMedia();
      const orphans = await sweepOrphanFiles();
      if (expired || orphans) logger.info({ expired, orphans }, 'Pembersihan dokumentasi selesai');
    } catch (err) {
      logger.error({ err }, 'Pembersihan dokumentasi gagal');
    }
  };
  setTimeout(run, CLEANUP_FIRST_DELAY_MS).unref();
  setInterval(run, CLEANUP_INTERVAL_MS).unref();
}
