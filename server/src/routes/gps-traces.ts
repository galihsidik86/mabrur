import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/rbac';
import { db } from '../db';
import { audit } from '../services/audit.service';

const router = Router();
router.use(authenticate);

function param(v: string | string[]): string { return Array.isArray(v) ? v[0] : v; }

// ==================== GPS TRACE (riset validasi lapangan) ====================

const pointSchema = z.object({
  t: z.number().int().positive(),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  acc: z.number().min(0).max(10000).nullable().optional(),
});

// Unggah dari mode Perekam GPS aplikasi (petugas/jamaah yang login)
router.post('/gps-traces', validate(z.object({
  label: z.string().min(1).max(100),
  started_at: z.number().int().positive(),
  ended_at: z.number().int().positive().nullable().optional(),
  device: z.string().max(120).optional(),
  points: z.array(pointSchema).min(10).max(20000),
})), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { label, started_at, ended_at, device, points } = req.body;
    const [row] = await db('gps_trace_sessions').insert({
      user_id: req.auth!.sub,
      label,
      started_at,
      ended_at: ended_at ?? null,
      point_count: points.length,
      points: JSON.stringify(points),
      device: device ?? null,
    }).returning(['id', 'created_at']);
    await audit(req.auth!.sub, 'gps_trace.upload', 'gps_trace_sessions', row.id, {
      label, point_count: points.length,
    });
    res.status(201).json({ data: row });
  } catch (err) { next(err); }
});

// Daftar sesi (tanpa titik) — admin
router.get('/gps-traces', authorize('admin'),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const rows = await db('gps_trace_sessions as g')
        .leftJoin('users as u', 'u.id', 'g.user_id')
        .select('g.id', 'g.label', 'g.started_at', 'g.ended_at', 'g.point_count',
          'g.device', 'g.created_at', 'u.name as user_name')
        .orderBy('g.created_at', 'desc')
        .limit(100);
      res.json({ data: rows });
    } catch (err) { next(err); }
  });

// Detail + titik — admin
router.get('/gps-traces/:id', authorize('admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const row = await db('gps_trace_sessions as g')
        .leftJoin('users as u', 'u.id', 'g.user_id')
        .select('g.*', 'u.name as user_name')
        .where('g.id', param(req.params.id))
        .first();
      if (!row) return res.status(404).json({ error: { message: 'Sesi tidak ditemukan', code: 'NOT_FOUND' } });
      res.json({ data: row });
    } catch (err) { next(err); }
  });

// Hapus — admin
router.delete('/gps-traces/:id', authorize('admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = param(req.params.id);
      const n = await db('gps_trace_sessions').where('id', id).delete();
      if (!n) return res.status(404).json({ error: { message: 'Sesi tidak ditemukan', code: 'NOT_FOUND' } });
      await audit(req.auth!.sub, 'gps_trace.delete', 'gps_trace_sessions', id);
      res.status(204).end();
    } catch (err) { next(err); }
  });

export default router;
