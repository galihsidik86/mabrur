import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/rbac';
import { db } from '../db';
import { AppError } from '../middleware/error-handler';
import { audit } from '../services/audit.service';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const router = Router();
router.use(authenticate);

// Helper: sanitasi nilai CSV untuk mencegah injection
const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;

// ==================== PHOTO UPLOAD ====================

// Perbaikan: validasi ekstensi file (whitelist), batasi ukuran, sanitasi nama
const ALLOWED_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif']);
const MAX_UPLOAD_SIZE = 5 * 1024 * 1024; // 5 MB

router.post('/upload/photo', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { base64, filename } = req.body;
    if (!base64 || typeof base64 !== 'string') {
      return res.status(400).json({ error: { message: 'base64 wajib diisi', code: 'VALIDATION_ERROR' } });
    }

    const ext = ((filename || 'photo.jpg').split('.').pop() || 'jpg').toLowerCase();
    // Perbaikan: hanya izinkan ekstensi gambar, mencegah upload file berbahaya
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return res.status(400).json({ error: { message: 'Format file tidak didukung (jpg/png/webp/gif)', code: 'VALIDATION_ERROR' } });
    }

    const buffer = Buffer.from(base64, 'base64');
    // Perbaikan: batasi ukuran file, mencegah DoS via upload besar
    if (buffer.length > MAX_UPLOAD_SIZE) {
      return res.status(400).json({ error: { message: 'Ukuran file maksimal 5 MB', code: 'VALIDATION_ERROR' } });
    }

    const name = `${crypto.randomUUID()}.${ext}`;
    const uploadsDir = path.resolve(__dirname, '../../uploads');
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

    fs.writeFileSync(path.join(uploadsDir, name), buffer);

    const url = `/uploads/${name}`;
    res.json({ data: { url } });
  } catch (err) { next(err); }
});

// ==================== SOS PHOTO ====================

// Perbaikan: validasi body + cek rows affected untuk mencegah silent IDOR failure
const sosPhotoSchema = z.object({
  photo_url: z.string().min(1).max(500),
});

router.patch('/sos/:id/photo', validate(sosPhotoSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const rows = await db('sos_alerts').where({ id, user_id: req.auth!.sub }).update({ photo_url: req.body.photo_url });
    if (rows === 0) throw new AppError(404, 'SOS tidak ditemukan atau bukan milikmu', 'NOT_FOUND');
    res.json({ data: { ok: true } });
  } catch (err) { next(err); }
});

// ==================== RATINGS ====================

const ratingSchema = z.object({
  rating: z.number().int().min(1).max(5),
  feedback: z.string().max(1000).optional(),
});

router.post('/ratings', validate(ratingSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [r] = await db('ratings').insert({
      user_id: req.auth!.sub,
      rating: req.body.rating,
      feedback: req.body.feedback || null,
    }).returning('*');
    await audit(req.auth!.sub, 'rating.create', 'ratings', r.id);
    res.status(201).json({ data: r });
  } catch (err) { next(err); }
});

router.get('/ratings', authorize('admin'), async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const ratings = await db('ratings').join('users', 'users.id', 'ratings.user_id')
      .select('ratings.*', 'users.name as user_name')
      .orderBy('ratings.created_at', 'desc');
    res.json({ data: ratings });
  } catch (err) { next(err); }
});

// ==================== EXPORT CSV ====================

router.get('/export/users', authorize('admin'), async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const users = await db('users').where('is_active', true)
      .select('name', 'phone', 'role', 'blood_type', 'emergency_contact', 'created_at');
    const header = 'Nama,HP,Role,Gol Darah,Kontak Darurat,Terdaftar\n';
    // Perbaikan: sanitasi CSV — escape tanda kutip ganda untuk mencegah CSV injection
    const esc = (v: string) => `"${String(v || '').replace(/"/g, '""')}"`;
    const rows = users.map((u: any) =>
      `${esc(u.name)},${esc(u.phone)},${esc(u.role)},${esc(u.blood_type)},${esc(u.emergency_contact)},${esc(u.created_at)}`
    ).join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=pengguna-mabrur.csv');
    res.send('\uFEFF' + header + rows); // BOM for Excel
  } catch (err) { next(err); }
});

router.get('/export/sos', authorize('admin'), async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const alerts = await db('sos_alerts').join('users', 'users.id', 'sos_alerts.user_id')
      .select('users.name', 'sos_alerts.category', 'sos_alerts.status',
        'sos_alerts.lat', 'sos_alerts.lng', 'sos_alerts.created_at', 'sos_alerts.resolved_at');
    const header = 'Nama,Kategori,Status,Lat,Lng,Dibuat,Diselesaikan\n';
    const rows = alerts.map((a: any) =>
      `${esc(a.name)},${esc(a.category)},${esc(a.status)},${esc(a.lat)},${esc(a.lng)},${esc(a.created_at)},${esc(a.resolved_at)}`
    ).join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=sos-mabrur.csv');
    res.send('\uFEFF' + header + rows);
  } catch (err) { next(err); }
});

// ==================== THEME PREFERENCE ====================

// Perbaikan: validasi nilai theme agar hanya menerima nilai yang valid
const themeSchema = z.object({ theme: z.enum(['light', 'dark']).default('light') });

router.patch('/theme', validate(themeSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    await db('users').where('id', req.auth!.sub).update({ theme: req.body.theme });
    res.json({ data: { ok: true } });
  } catch (err) { next(err); }
});

export default router;
