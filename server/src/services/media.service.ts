// Dokumentasi rombongan: simpan/baca/hapus foto + metadata. Logika murni ada di media-core.ts.
// Berkas di MEDIA_DIR/<group_id>/<uuid>.<ext> — di luar folder publik /uploads, dilayani lewat
// GET /media/:id/file setelah cek keanggotaan.
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
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
  MEDIA_QUOTA_BYTES,
  sniffImage,
  type MediaActor,
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
  uploader_id: string | null;
  mime: string;
  file_name: string;
  thumb_name: string | null;
  thumb_bytes: number;
};

const PUBLIC_FIELDS = [
  'id', 'group_id', 'uploader_id', 'schedule_id', 'kind', 'mime', 'size_bytes',
  'width', 'height', 'caption', 'is_official', 'taken_at', 'created_at', 'expires_at',
];

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

// Kembalikan { row, created }. client_uuid yang sama dari pengunggah yang sama → baris lama (tanpa unggah ulang).
export async function createPhoto(input: {
  groupId: string;
  actor: MediaActor;
  buffer: Buffer;
  clientUuid: string | null;
  caption: string | null;
  scheduleId: string | null;
  takenAt: Date;
  width: number | null;
  height: number | null;
}) {
  if (input.clientUuid) {
    const existing = await findByClientUuid(input.groupId, input.actor.userId, input.clientUuid);
    if (existing) return { row: existing, created: false };
  }

  const mime = sniffImage(input.buffer);
  if (!mime) throw new AppError(415, 'Berkas bukan foto JPG/PNG/WebP', 'UNSUPPORTED_MEDIA');

  if (input.scheduleId) {
    const schedule = await db('schedules').where({ id: input.scheduleId, group_id: input.groupId }).first('id');
    if (!schedule) throw new AppError(400, 'Kegiatan tidak ditemukan di rombongan ini', 'VALIDATION_ERROR');
  }
  // Cek awal tanpa kunci: rombongan yang sudah penuh tidak perlu menulis ke disk sama sekali.
  if (exceedsQuota(await usedBytes(input.groupId), input.buffer.length)) throw quotaError();

  const id = crypto.randomUUID();
  const fileName = `${id}.${extensionFor(mime)}`;
  await fs.promises.mkdir(path.join(MEDIA_DIR, input.groupId), { recursive: true });
  await fs.promises.writeFile(fileFor(input.groupId, fileName), input.buffer, { flag: 'wx' });

  const now = new Date();
  let row;
  try {
    row = await db.transaction(async (trx) => {
      // Kunci baris rombongan agar dua unggahan bersamaan tidak sama-sama lolos cek kuota.
      await trx('groups').where('id', input.groupId).forUpdate().first('id');
      if (exceedsQuota(await usedBytes(input.groupId, trx), input.buffer.length)) throw quotaError();
      const [inserted] = await trx('group_media')
        .insert({
          id,
          group_id: input.groupId,
          uploader_id: input.actor.userId,
          schedule_id: input.scheduleId,
          kind: 'photo',
          mime,
          file_name: fileName,
          size_bytes: input.buffer.length,
          width: input.width,
          height: input.height,
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
  await audit(input.actor.userId, 'media.upload', 'group_media', id, { group_id: input.groupId, bytes: input.buffer.length });
  return { row, created: true };
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
