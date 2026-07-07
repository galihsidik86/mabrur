import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/rbac';
import { db } from '../db';
import { AppError } from '../middleware/error-handler';
import { audit } from '../services/audit.service';
import bcrypt from 'bcryptjs';
import { encrypt, decrypt } from '../services/crypto.service';

const router = Router();
router.use(authenticate);

function param(v: string | string[]): string { return Array.isArray(v) ? v[0] : v; }

// ==================== PROFILE ====================

const profileUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  password: z.string().min(6).optional(),
  blood_type: z.string().max(10).optional(),
  medical_notes: z.string().max(500).optional(),
  emergency_contact: z.string().max(50).optional(),
  passport_no: z.string().max(20).optional(),
});

router.patch('/profile', validate(profileUpdateSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = req.body;
    const update: Record<string, unknown> = { updated_at: new Date() };
    if (data.name) update.name = data.name;
    if (data.password) update.password_hash = await bcrypt.hash(data.password, 12);
    if (data.blood_type !== undefined) update.blood_type = data.blood_type || null;
    if (data.passport_no !== undefined) update.passport_no = data.passport_no ? encrypt(data.passport_no) : null;
    if (data.medical_notes !== undefined) update.medical_notes = data.medical_notes ? encrypt(data.medical_notes) : null;
    if (data.emergency_contact !== undefined) update.emergency_contact = data.emergency_contact || null;

    await db('users').where('id', req.auth!.sub).update(update);
    const user = await db('users').where('id', req.auth!.sub)
      .select('id', 'phone', 'name', 'role', 'blood_type', 'emergency_contact', 'created_at').first();
    await audit(req.auth!.sub, 'profile.update', 'users', req.auth!.sub);
    res.json({ data: user });
  } catch (err) { next(err); }
});

// ==================== SOS HISTORY ====================

router.get('/sos/history', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const alerts = await db('sos_alerts')
      .where('user_id', req.auth!.sub)
      .orderBy('created_at', 'desc')
      .limit(50)
      .select('id', 'category', 'lat', 'lng', 'status', 'photo_url', 'created_at', 'resolved_at');
    res.json({ data: alerts });
  } catch (err) { next(err); }
});

// ==================== ZIARAH ====================

router.get('/ziarah', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const places = await db('ziarah_places').orderBy('sort_order');
    res.json({ data: places });
  } catch (err) { next(err); }
});

router.post('/ziarah', authorize('admin'), validate(z.object({
  name: z.string().min(1), description: z.string().optional(), category: z.string(),
  location_name: z.string().optional(), lat: z.number().optional(), lng: z.number().optional(),
  tips: z.string().optional(), sort_order: z.number().int().optional(),
})), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [place] = await db('ziarah_places').insert(req.body).returning('*');
    res.status(201).json({ data: place });
  } catch (err) { next(err); }
});

router.put('/ziarah/:id', authorize('admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [place] = await db('ziarah_places').where('id', param(req.params.id))
      .update({ ...req.body, updated_at: new Date() }).returning('*');
    if (!place) throw new AppError(404, 'Tempat tidak ditemukan', 'NOT_FOUND');
    res.json({ data: place });
  } catch (err) { next(err); }
});

router.delete('/ziarah/:id', authorize('admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    await db('ziarah_places').where('id', param(req.params.id)).delete();
    res.status(204).send();
  } catch (err) { next(err); }
});

// ==================== CHAT ====================

const messageSchema = z.object({ text: z.string().min(1).max(1000) });

router.get('/groups/:groupId/messages', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const groupId = param(req.params.groupId);
    if (req.auth!.role !== 'admin') {
      const member = await db('group_members').where({ group_id: groupId, user_id: req.auth!.sub, is_active: true }).first();
      if (!member) throw new AppError(403, 'Bukan anggota rombongan', 'FORBIDDEN');
    }
    const before = req.query.before as string | undefined;
    let query = db('messages').join('users', 'users.id', 'messages.user_id')
      .where('messages.group_id', groupId)
      .select('messages.id', 'messages.text', 'messages.created_at', 'users.id as user_id', 'users.name as user_name')
      .orderBy('messages.created_at', 'desc').limit(50);
    if (before) query = query.where('messages.created_at', '<', before);
    const messages = await query;
    res.json({ data: messages.reverse() });
  } catch (err) { next(err); }
});

router.post('/groups/:groupId/messages', validate(messageSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const groupId = param(req.params.groupId);
    const member = await db('group_members').where({ group_id: groupId, user_id: req.auth!.sub, is_active: true }).first();
    if (!member) throw new AppError(403, 'Bukan anggota rombongan', 'FORBIDDEN');
    const [msg] = await db('messages').insert({ group_id: groupId, user_id: req.auth!.sub, text: req.body.text }).returning('*');
    const user = await db('users').where('id', req.auth!.sub).select('name').first();
    res.status(201).json({ data: { ...msg, user_name: user?.name } });
  } catch (err) { next(err); }
});

// ==================== STATS ====================

router.get('/stats/me', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.auth!.sub;
    const sosCount = await db('sos_alerts').where('user_id', userId).count().first();
    const membership = await db('group_members').where({ user_id: userId, is_active: true }).first();
    let schedDone = 0;
    if (membership) {
      const result = await db('schedules').where({ group_id: membership.group_id, status: 'done' }).count().first();
      schedDone = Number(result?.count || 0);
    }
    const loc = await db('user_locations').where('user_id', userId).first();
    const ihram = await db('ihram_status').where('user_id', userId).first();

    res.json({
      data: {
        sos_total: Number(sosCount?.count || 0),
        ibadah_done: schedDone,
        is_ihram: !!ihram?.is_ihram,
        has_location: !!loc,
        group_id: membership?.group_id || null,
      },
    });
  } catch (err) { next(err); }
});

// ==================== ONBOARDING ====================

router.post('/onboarded', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await db('users').where('id', req.auth!.sub).update({ onboarded: true });
    res.json({ data: { ok: true } });
  } catch (err) { next(err); }
});

export default router;
