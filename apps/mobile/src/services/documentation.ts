// Dokumentasi rombongan di HP: antrean unggah tahan sinyal lemah + unduh/bagikan foto.
// Foto dikompres & disimpan di folder aplikasi (bukan cache) sampai terkirim; antrean dicoba ulang
// dengan jeda bertahap saat aplikasi aktif (app/_layout.tsx) / layar Dokumentasi dibuka.
// Unggahan idempoten: tiap foto membawa client_uuid, jadi mengulang setelah respons hilang tidak menggandakan.
// Logika murni: documentation-core.ts.
import { Directory, File, Paths, UploadTask, UploadType } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as MediaLibrary from 'expo-media-library/legacy';
import * as Sharing from 'expo-sharing';
import { api, apiUrl, getAuthHeaders, type GroupMedia } from './api';
import { getDB } from './db';
import {
  fitWithin,
  isPermanentFailure,
  makeUuidV4,
  retryDelayMs,
  MAX_UPLOAD_ATTEMPTS,
  PHOTO_MAX_SIDE,
  PHOTO_QUALITY,
  THUMB_MAX_SIDE,
  THUMB_QUALITY,
} from './documentation-core';

export type QueuedPhoto = {
  id: number;
  group_id: string;
  client_uuid: string;
  file_uri: string;
  thumb_uri: string | null;
  width: number | null;
  height: number | null;
  caption: string | null;
  schedule_id: string | null;
  taken_at: string;
  remote_id: string | null;
  status: 'pending' | 'failed';
  attempts: number;
  next_try_at: number;
  last_error: string | null;
};

export type PickedPhoto = { uri: string; width: number; height: number; takenAt: string | null };

export class GalleryPermissionError extends Error {}

const QUEUE_DIR_NAME = 'media-queue';
const DOWNLOAD_PREFIX = 'mabrur-doc-';
// Unggahan menggantung (portal Wi-Fi hotel, sinyal mati total) dibatalkan agar antrean tidak macet.
const UPLOAD_TIMEOUT_MS = 3 * 60_000;
const PROGRESS_THROTTLE_MS = 250;
// Berkas antrean tanpa baris DB (aplikasi mati saat menyiapkan foto) dihapus setelah selama ini.
const ORPHAN_MIN_AGE_MS = 60 * 60_000;

// ---- Pemberitahuan ke layar ----
// Perubahan struktur antrean (tambah/hapus/status) dan progres dipisah: progres sering → tanpa query DB.
type Listener = () => void;
const queueListeners = new Set<Listener>();
const progressListeners = new Set<Listener>();
const progress = new Map<number, number>();
let progressVersion = 0;
let lastProgressEmit = 0;

export function subscribeQueue(fn: Listener): () => void {
  queueListeners.add(fn);
  return () => { queueListeners.delete(fn); };
}

export function subscribeProgress(fn: Listener): () => void {
  progressListeners.add(fn);
  return () => { progressListeners.delete(fn); };
}

export function getProgressVersion(): number {
  return progressVersion;
}

export function uploadProgress(id: number): number | null {
  return progress.get(id) ?? null;
}

function notifyQueue(): void {
  queueListeners.forEach((fn) => fn());
}

function emitProgress(force = false): void {
  const now = Date.now();
  if (!force && now - lastProgressEmit < PROGRESS_THROTTLE_MS) return;
  lastProgressEmit = now;
  progressVersion++;
  progressListeners.forEach((fn) => fn());
}

// Album perlu dimuat ulang (foto baru terkirim, dihapus, keterangan diubah di layar foto).
let albumDirty = true;

export function markAlbumDirty(): void {
  albumDirty = true;
}

export function consumeAlbumDirty(): boolean {
  const was = albumDirty;
  albumDirty = false;
  return was;
}

function queueDir(): Directory {
  const dir = new Directory(Paths.document, QUEUE_DIR_NAME);
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

function deleteQuiet(uri: string | null): void {
  if (!uri) return;
  try {
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch { /* berkas sudah tidak ada */ }
}

// ---- Kompres & masukkan ke antrean ----
async function renderJpeg(src: PickedPhoto, maxSide: number, quality: number, dest: File) {
  const size = fitWithin(src.width, src.height, maxSide);
  const ctx = ImageManipulator.manipulate(src.uri);
  if (src.width <= 0 || size.width < src.width) ctx.resize({ width: size.width });
  const image = await ctx.renderAsync();
  try {
    const out = await image.saveAsync({ compress: quality, format: SaveFormat.JPEG });
    await new File(out.uri).move(dest);
    return { width: out.width, height: out.height };
  } finally {
    image.release();
  }
}

let enqueueing = 0;

// Semua-atau-tidak-sama-sekali: semua foto disiapkan dulu, lalu dimasukkan dalam satu transaksi.
// Gagal di tengah → berkas yang sudah dibuat dihapus, tidak ada yang masuk antrean (aman ditekan ulang).
export async function enqueuePhotos(
  groupId: string,
  photos: readonly PickedPhoto[],
  caption: string | null,
  scheduleId: string | null,
): Promise<void> {
  enqueueing++;
  const created: File[] = [];
  try {
    const dir = queueDir();
    const prepared: Array<{ file: File; thumb: File; width: number; height: number; takenAt: string }> = [];
    for (const p of photos) {
      const base = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const file = new File(dir, `${base}.jpg`);
      const thumb = new File(dir, `${base}_t.jpg`);
      created.push(file, thumb);
      const full = await renderJpeg(p, PHOTO_MAX_SIDE, PHOTO_QUALITY, file);
      await renderJpeg(p, THUMB_MAX_SIDE, THUMB_QUALITY, thumb);
      prepared.push({ file, thumb, width: full.width, height: full.height, takenAt: p.takenAt ?? new Date().toISOString() });
    }
    const db = getDB();
    await db.withTransactionAsync(async () => {
      for (const p of prepared) {
        await db.runAsync(
          `INSERT INTO media_queue (group_id, client_uuid, file_uri, thumb_uri, width, height, caption, schedule_id, taken_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [groupId, makeUuidV4(), p.file.uri, p.thumb.uri, p.width, p.height, caption, scheduleId, p.takenAt],
        );
      }
    });
  } catch (err) {
    created.forEach((f) => deleteQuiet(f.uri));
    throw err;
  } finally {
    enqueueing--;
  }
  notifyQueue();
  void processQueue();
}

// Semua antrean akun ini (lintas rombongan) agar tidak ada foto tersembunyi yang tak bisa dibatalkan.
export async function getQueue(): Promise<QueuedPhoto[]> {
  return getDB().getAllAsync<QueuedPhoto>('SELECT * FROM media_queue ORDER BY id');
}

export async function countQueue(): Promise<number> {
  const row = await getDB().getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM media_queue');
  return row?.n ?? 0;
}

export async function retryQueued(id: number): Promise<void> {
  await getDB().runAsync(
    "UPDATE media_queue SET status = 'pending', attempts = 0, next_try_at = 0, last_error = NULL WHERE id = ?",
    [id],
  );
  notifyQueue();
  void processQueue();
}

// Unggahan yang sedang berjalan (untuk dibatalkan bila pengguna membatalkan foto itu).
let current: { rowId: number; task: UploadTask | null; cancelled: boolean } | null = null;

export async function discardQueued(id: number): Promise<void> {
  if (current?.rowId === id) {
    current.cancelled = true;
    current.task?.cancel();
  }
  const row = await getDB().getFirstAsync<QueuedPhoto>('SELECT * FROM media_queue WHERE id = ?', [id]);
  if (!row) return;
  await getDB().runAsync('DELETE FROM media_queue WHERE id = ?', [id]);
  deleteQuiet(row.file_uri);
  deleteQuiet(row.thumb_uri);
  // Foto sudah sampai di server sebelum dibatalkan → hapus juga di sana.
  if (row.remote_id) api.deleteMedia(row.remote_id).then(markAlbumDirty).catch(() => { /* hapus manual dari album */ });
  notifyQueue();
}

// Dipanggil saat logout: baris antrean terhapus di clearAll(); di sini berkasnya + foto unduhan.
export function clearQueueFiles(): void {
  if (current) {
    current.cancelled = true;
    current.task?.cancel();
  }
  try {
    const dir = new Directory(Paths.document, QUEUE_DIR_NAME);
    if (dir.exists) dir.delete();
  } catch { /* tidak kritis */ }
  try {
    for (const entry of new Directory(Paths.cache).list()) {
      if (entry instanceof File && entry.name.startsWith(DOWNLOAD_PREFIX)) entry.delete();
    }
  } catch { /* tidak kritis */ }
  albumDirty = true;
}

// Berkas di folder antrean tanpa baris (aplikasi mati saat menyiapkan foto). Sekali per sesi aplikasi.
let sweptOrphans = false;

async function sweepQueueOrphans(): Promise<void> {
  if (sweptOrphans || enqueueing > 0) return;
  sweptOrphans = true;
  const dir = new Directory(Paths.document, QUEUE_DIR_NAME);
  if (!dir.exists) return;
  const rows = await getDB().getAllAsync<{ file_uri: string; thumb_uri: string | null }>('SELECT file_uri, thumb_uri FROM media_queue');
  const known = new Set(rows.flatMap((r) => [r.file_uri, r.thumb_uri]));
  const cutoff = Date.now() - ORPHAN_MIN_AGE_MS;
  for (const entry of dir.list()) {
    if (entry instanceof File && !known.has(entry.uri) && (entry.modificationTime ?? 0) < cutoff) deleteQuiet(entry.uri);
  }
}

// ---- Pengiriman ----
type SendResult = { status: number; body: string };

async function uploadWithTimeout(task: UploadTask): Promise<SendResult> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      task.cancel();
      reject(new Error('unggah melewati batas waktu'));
    }, UPLOAD_TIMEOUT_MS);
  });
  try {
    return await Promise.race([task.uploadAsync(), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

async function sendFile(
  url: string,
  file: File,
  method: 'POST' | 'PUT',
  extraHeaders: Record<string, string>,
  onProgress?: (ratio: number) => void,
): Promise<SendResult> {
  const attempt = async (auth: Record<string, string>) => {
    const task = new UploadTask(file, url, {
      httpMethod: method,
      uploadType: UploadType.BINARY_CONTENT,
      mimeType: 'image/jpeg',
      headers: { ...auth, ...extraHeaders, 'Content-Type': 'image/jpeg' },
      sessionType: 'background',
      onProgress: onProgress ? (p) => onProgress(p.totalBytes > 0 ? p.bytesSent / p.totalBytes : 0) : undefined,
    });
    if (current) current.task = task;
    try {
      return await uploadWithTimeout(task);
    } finally {
      if (current?.task === task) current.task = null;
      task.release();
    }
  };
  let res = await attempt(await getAuthHeaders());
  if (res.status === 401 && !current?.cancelled) res = await attempt(await getAuthHeaders(true));
  return res;
}

function errorMessage(body: string): string | null {
  try {
    const msg = (JSON.parse(body) as { error?: { message?: unknown } }).error?.message;
    return typeof msg === 'string' ? msg : null;
  } catch {
    return null;
  }
}

function uploadQuery(row: QueuedPhoto): string {
  const parts: string[] = [`client_uuid=${row.client_uuid}`, `taken_at=${encodeURIComponent(row.taken_at)}`];
  if (row.schedule_id) parts.push(`schedule_id=${encodeURIComponent(row.schedule_id)}`);
  if (row.width) parts.push(`width=${row.width}`);
  if (row.height) parts.push(`height=${row.height}`);
  return parts.join('&');
}

// Gagal sementara: coba lagi nanti; setelah MAX_UPLOAD_ATTEMPTS ditandai gagal agar terlihat & bisa dicoba manual.
async function scheduleRetry(row: QueuedPhoto, message: string | null): Promise<void> {
  const attempts = row.attempts + 1;
  if (attempts >= MAX_UPLOAD_ATTEMPTS) {
    await markFailed(row, message);
    return;
  }
  await getDB().runAsync(
    'UPDATE media_queue SET attempts = ?, next_try_at = ?, last_error = ? WHERE id = ?',
    [attempts, Date.now() + retryDelayMs(row.attempts), message, row.id],
  );
}

async function markFailed(row: QueuedPhoto, message: string | null): Promise<void> {
  await getDB().runAsync("UPDATE media_queue SET status = 'failed', last_error = ? WHERE id = ?", [message, row.id]);
}

async function finish(row: QueuedPhoto): Promise<void> {
  await getDB().runAsync('DELETE FROM media_queue WHERE id = ?', [row.id]);
  deleteQuiet(row.file_uri);
  deleteQuiet(row.thumb_uri);
  markAlbumDirty();
}

// Foto sampai di server tapi pengguna sudah membatalkannya → hapus di server.
async function undoIfCancelled(remoteId: string): Promise<boolean> {
  if (!current?.cancelled) return false;
  await api.deleteMedia(remoteId).catch(() => { /* hapus manual dari album */ });
  return true;
}

// true = lanjut ke item berikutnya; false = berhenti (kemungkinan offline / server sibuk).
async function uploadOne(row: QueuedPhoto): Promise<boolean> {
  current = { rowId: row.id, task: null, cancelled: false };
  try {
    let remoteId = row.remote_id;
    if (!remoteId) {
      const file = new File(row.file_uri);
      if (!file.exists) {
        await markFailed(row, null);
        return true;
      }
      const headers: Record<string, string> = row.caption ? { 'X-Media-Caption': encodeURIComponent(row.caption) } : {};
      const res = await sendFile(apiUrl(`/groups/${row.group_id}/media?${uploadQuery(row)}`), file, 'POST', headers, (ratio) => {
        progress.set(row.id, ratio);
        emitProgress();
      });
      if (res.status === 200 || res.status === 201) {
        remoteId = (JSON.parse(res.body) as { data: { id: string } }).data.id;
        if (await undoIfCancelled(remoteId)) return true;
        // Gagal menyimpan remote_id tidak masalah: unggah ulang dengan client_uuid sama mengembalikan baris ini.
        await getDB().runAsync('UPDATE media_queue SET remote_id = ? WHERE id = ?', [remoteId, row.id]).catch(() => {});
      } else if (current.cancelled) {
        return true;
      } else if (isPermanentFailure(res.status)) {
        await markFailed(row, errorMessage(res.body));
        return true;
      } else {
        await scheduleRetry(row, errorMessage(res.body));
        return false;
      }
    }

    // Thumbnail opsional: gagal permanen → server memakai foto asli sebagai thumbnail.
    const thumb = row.thumb_uri ? new File(row.thumb_uri) : null;
    if (thumb?.exists && !current.cancelled) {
      const res = await sendFile(apiUrl(`/media/${remoteId}/thumb`), thumb, 'PUT', {});
      if (await undoIfCancelled(remoteId)) return true;
      if (res.status !== 200 && !isPermanentFailure(res.status)) {
        await scheduleRetry({ ...row, remote_id: remoteId }, errorMessage(res.body));
        return false;
      }
    }
    if (await undoIfCancelled(remoteId)) return true;
    await finish(row);
    return true;
  } catch {
    if (current?.cancelled) return true;
    await scheduleRetry(row, null);
    return false;
  } finally {
    current = null;
    progress.delete(row.id);
    emitProgress(true);
    notifyQueue();
  }
}

let running: Promise<void> | null = null;

export function processQueue(): Promise<void> {
  if (!running) {
    running = (async () => {
      await sweepQueueOrphans().catch(() => { /* tidak kritis */ });
      for (;;) {
        const row = await getDB().getFirstAsync<QueuedPhoto>(
          "SELECT * FROM media_queue WHERE status = 'pending' AND next_try_at <= ? ORDER BY id LIMIT 1",
          [Date.now()],
        );
        if (!row || !(await uploadOne(row))) return;
      }
    })()
      .catch(() => { /* DB belum siap / logout di tengah jalan — dicoba lagi pada pemicu berikutnya */ })
      .finally(() => { running = null; });
  }
  return running;
}

// ---- Lihat, unduh, bagikan ----
// Item album yang sudah dimuat, agar layar tampilan foto tidak perlu endpoint satuan.
const remembered = new Map<string, GroupMedia>();

export function rememberMedia(items: readonly GroupMedia[]): void {
  items.forEach((it) => remembered.set(it.id, it));
}

export function getRememberedMedia(id: string): GroupMedia | null {
  return remembered.get(id) ?? null;
}

export function forgetMedia(id: string): void {
  remembered.delete(id);
}

export function mediaUrl(id: string, variant: 'file' | 'thumb'): string {
  return apiUrl(`/media/${id}/${variant}`);
}

// Unduh ke cache (dipakai ulang untuk simpan & bagikan). Status non-2xx → downloadFileAsync melempar galat.
async function downloadToCache(item: GroupMedia): Promise<string> {
  const ext = item.mime === 'image/png' ? 'png' : item.mime === 'image/webp' ? 'webp' : 'jpg';
  const dest = new File(Paths.cache, `${DOWNLOAD_PREFIX}${item.id}.${ext}`);
  if (dest.exists && (dest.size ?? 0) > 0) return dest.uri;
  const file = await File.downloadFileAsync(mediaUrl(item.id, 'file'), dest, {
    headers: await getAuthHeaders(),
    idempotent: true,
  });
  if ((file.size ?? 0) === 0) {
    deleteQuiet(file.uri);
    throw new Error('berkas unduhan kosong');
  }
  return file.uri;
}

export async function saveToGallery(item: GroupMedia): Promise<void> {
  const perm = await MediaLibrary.requestPermissionsAsync(true);
  if (!perm.granted) throw new GalleryPermissionError(perm.canAskAgain ? 'ask' : 'settings');
  await MediaLibrary.saveToLibraryAsync(await downloadToCache(item));
}

export async function sharePhoto(item: GroupMedia, dialogTitle: string): Promise<void> {
  const uri = await downloadToCache(item);
  await Sharing.shareAsync(uri, { mimeType: item.mime, dialogTitle });
}
