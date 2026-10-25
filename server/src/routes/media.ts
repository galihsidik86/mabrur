import express, { Router, Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/auth';
import { AppError } from '../middleware/error-handler';
import * as mediaService from '../services/media.service';
import {
  MAX_CAPTION_LENGTH,
  MAX_PHOTO_BYTES,
  MAX_THUMB_BYTES,
  normalizeCaption,
  normalizeDurationMs,
  normalizeTakenAt,
  uploadKindFor,
} from '../services/media-core';

const router = Router();
router.use(authenticate);

function param(val: string | string[]): string {
  return Array.isArray(val) ? val[0] : val;
}

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/octet-stream'];
// Body foto ditampung di RAM, video memakan disk & koneksi lama → batasi unggahan serentak per akun
// (antrean HP mengirim satu per satu).
const MAX_CONCURRENT_UPLOADS = 2;
const IMMUTABLE_CACHE = 'private, max-age=604800, immutable';
// Thumbnail yang sementara memakai foto asli (thumbnail belum terkirim) jangan di-cache lama.
const FALLBACK_THUMB_CACHE = 'private, max-age=300';

// Body biner mentah (bukan base64/JSON). Body terlalu besar → 413 yang jelas, bukan 500.
function rawImage(limit: number) {
  const parse = express.raw({ type: IMAGE_TYPES, limit });
  const limitMb = Math.round((limit / 1024 / 1024) * 10) / 10;
  return (req: Request, res: Response, next: NextFunction) => {
    parse(req, res, (err?: unknown) => {
      if (err && (err as { type?: string }).type === 'entity.too.large') {
        return next(new AppError(413, `Ukuran foto maksimal ${limitMb} MB`, 'PAYLOAD_TOO_LARGE'));
      }
      if (err) return next(err);
      if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
        return next(new AppError(400, 'Isi foto kosong atau Content-Type bukan gambar', 'VALIDATION_ERROR'));
      }
      next();
    });
  };
}

const inFlight = new Map<string, number>();

function limitConcurrentUploads(req: Request, res: Response, next: NextFunction) {
  const key = req.auth!.sub;
  const n = inFlight.get(key) ?? 0;
  if (n >= MAX_CONCURRENT_UPLOADS) {
    return next(new AppError(429, 'Unggahan sebelumnya masih berjalan. Coba lagi sebentar.', 'RATE_LIMITED'));
  }
  inFlight.set(key, n + 1);
  let released = false;
  res.on('close', () => {
    if (released) return;
    released = true;
    const left = (inFlight.get(key) ?? 1) - 1;
    if (left <= 0) inFlight.delete(key); else inFlight.set(key, left);
  });
  next();
}

function makeLimiter(max: number) {
  return rateLimit({
    windowMs: 10 * 60 * 1000,
    max,
    keyGenerator: (req) => req.auth?.sub ?? req.ip ?? 'anon',
    message: { error: { message: 'Terlalu banyak unggahan. Coba lagi beberapa menit lagi.', code: 'RATE_LIMITED' } },
  });
}
// 150 foto + thumbnailnya per 10 menit per akun — cukup untuk unggah massal muthawwif.
const photoLimiter = makeLimiter(150);
const thumbLimiter = makeLimiter(150);

const groupParams = z.object({ groupId: z.string().uuid() });
const mediaParams = z.object({ id: z.string().uuid() });

const listQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(60),
  official: z.enum(['0', '1']).optional(),
});

const uploadQuery = z.object({
  client_uuid: z.string().uuid().optional(),
  schedule_id: z.string().uuid().optional(),
  taken_at: z.string().max(40).optional(),
  width: z.coerce.number().int().min(1).max(20000).optional(),
  height: z.coerce.number().int().min(1).max(20000).optional(),
  duration_ms: z.string().max(12).optional(),
});

const captionBody = z.object({ caption: z.string().max(MAX_CAPTION_LENGTH * 2).nullable() });

// Keterangan dikirim di header X-Media-Caption (URL-encoded) agar tidak tercatat di log akses URL.
function captionFromHeader(req: Request): string | null {
  const raw = req.get('x-media-caption');
  if (!raw) return null;
  try {
    return normalizeCaption(decodeURIComponent(raw).slice(0, MAX_CAPTION_LENGTH * 2));
  } catch {
    throw new AppError(400, 'Keterangan tidak valid', 'VALIDATION_ERROR');
  }
}

// Cek hak SEBELUM body dibaca: bukan anggota / bukan pengunggah tidak sempat menghabiskan RAM.
function requireGroupMember(req: Request, res: Response, next: NextFunction) {
  mediaService.assertCanView(param(req.params.groupId), req.auth!)
    .then((actor) => { res.locals.actor = actor; next(); })
    .catch(next);
}

function requireUploader(req: Request, _res: Response, next: NextFunction) {
  mediaService.assertUploaderMember(param(req.params.id), req.auth!).then(() => next()).catch(next);
}

// Metadata diperiksa sebelum body dibaca: keterangan rusak / video > 60 detik ditolak tanpa sempat diunggah.
function parseUploadMeta(req: Request, res: Response, next: NextFunction) {
  try {
    res.locals.caption = captionFromHeader(req);
  } catch (err) {
    return next(err);
  }
  try {
    res.locals.durationMs = normalizeDurationMs((req.query as { duration_ms?: string }).duration_ms);
  } catch (err) {
    return next(new AppError(400, (err as Error).message, 'VALIDATION_ERROR'));
  }
  next();
}

const photoBody = rawImage(MAX_PHOTO_BYTES);

// Foto (image/*) → buffer di RAM; video (video/*) → stream ke berkas sementara di disk.
function receiveUpload(req: Request, res: Response, next: NextFunction) {
  if (uploadKindFor(req.get('content-type')) === 'photo') {
    return photoBody(req, res, (err?: unknown) => {
      if (err) return next(err);
      res.locals.source = { type: 'buffer', buffer: req.body as Buffer } satisfies mediaService.UploadSource;
      next();
    });
  }
  const declared = Number(req.get('content-length'));
  mediaService.receiveVideo(req, param(req.params.groupId), Number.isFinite(declared) && declared > 0 ? declared : null)
    .then((source) => { res.locals.source = source; next(); })
    .catch(next);
}

// GET /groups/:groupId/media — album rombongan (terbaru dulu), hanya anggota.
router.get(
  '/groups/:groupId/media',
  validate(groupParams, 'params'),
  validate(listQuery, 'query'),
  requireGroupMember,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const q = req.query as unknown as z.infer<typeof listQuery>;
      res.json(await mediaService.listMedia(param(req.params.groupId), { page: q.page, limit: q.limit, officialOnly: q.official === '1' }));
    } catch (err) { next(err); }
  },
);

// POST /groups/:groupId/media — unggah satu foto (body = JPG/PNG/WebP, ≤ 4 MB) atau video
// (body = MP4/MOV, Content-Type video/*, ≤ 60 detik & 40 MB); metadata di query.
// client_uuid sama → 200 + baris lama (antrean HP aman mengulang setelah respons hilang).
router.post(
  '/groups/:groupId/media',
  photoLimiter,
  validate(groupParams, 'params'),
  validate(uploadQuery, 'query'),
  parseUploadMeta,
  requireGroupMember,
  limitConcurrentUploads,
  receiveUpload,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const q = req.query as unknown as z.infer<typeof uploadQuery>;
      // createMedia selalu membuang berkas sementara video bila tidak jadi disimpan.
      const { row, created } = await mediaService.createMedia({
        groupId: param(req.params.groupId),
        actor: res.locals.actor,
        source: res.locals.source as mediaService.UploadSource,
        clientUuid: q.client_uuid ?? null,
        caption: res.locals.caption ?? null,
        scheduleId: q.schedule_id ?? null,
        takenAt: normalizeTakenAt(q.taken_at, new Date()),
        width: q.width ?? null,
        height: q.height ?? null,
        durationMs: res.locals.durationMs ?? null,
      });
      res.status(created ? 201 : 200).json({ data: row });
    } catch (err) { next(err); }
  },
);

// PUT /media/:id/thumb — thumbnail JPG kecil dari HP (album hemat kuota data jamaah).
router.put(
  '/media/:id/thumb',
  thumbLimiter,
  validate(mediaParams, 'params'),
  requireUploader,
  limitConcurrentUploads,
  rawImage(MAX_THUMB_BYTES),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await mediaService.setThumb(param(req.params.id), req.auth!, req.body as Buffer);
      res.json({ data: { ok: true } });
    } catch (err) { next(err); }
  },
);

// GET /media/:id/file & /media/:id/thumb — berkas hanya untuk anggota rombongan.
for (const variant of ['file', 'thumb'] as const) {
  router.get(`/media/:id/${variant}`, validate(mediaParams, 'params'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const file = await mediaService.resolveFile(param(req.params.id), req.auth!, variant);
      // Header lewat opsi sendFile → hanya terpasang bila berkas benar-benar terkirim (bukan pada 404).
      res.sendFile(file.path, {
        headers: { 'Content-Type': file.mime, 'Cache-Control': file.isFallback ? FALLBACK_THUMB_CACHE : IMMUTABLE_CACHE },
      }, (err) => {
        if (err && !res.headersSent) next(new AppError(404, 'Berkas dokumentasi tidak ditemukan', 'NOT_FOUND'));
      });
    } catch (err) { next(err); }
  });
}

// PATCH /media/:id — ubah keterangan (pengunggah yang masih anggota).
router.patch('/media/:id', validate(mediaParams, 'params'), validate(captionBody), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const caption = normalizeCaption(req.body.caption ?? undefined);
    await mediaService.updateCaption(param(req.params.id), req.auth!, caption);
    res.json({ data: { caption } });
  } catch (err) { next(err); }
});

// DELETE /media/:id — pengunggah, muthawwif rombongan, atau admin.
router.delete('/media/:id', validate(mediaParams, 'params'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    await mediaService.deleteMedia(param(req.params.id), req.auth!);
    res.json({ data: { ok: true } });
  } catch (err) { next(err); }
});

export default router;
