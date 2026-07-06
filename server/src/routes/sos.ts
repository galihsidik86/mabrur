import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/auth';
import { AppError } from '../middleware/error-handler';
import * as sosService from '../services/sos.service';
import { db } from '../db';

const router = Router();
router.use(authenticate);

function param(val: string | string[]): string {
  return Array.isArray(val) ? val[0] : val;
}

const createSchema = z.object({
  category: z.enum(['medis', 'tersesat', 'kehilangan']),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
});

// POST /sos — kirim SOS
router.post(
  '/sos',
  validate(createSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sos = await sosService.create(req.auth!.sub, req.body);
      res.status(201).json({ data: sos });
    } catch (err) { next(err); }
  },
);

// GET /sos/active — SOS aktif user sendiri
router.get('/sos/active', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sos = await sosService.getActive(req.auth!.sub);
    res.json({ data: sos || null });
  } catch (err) { next(err); }
});

// DELETE /sos/:id — batalkan SOS sendiri
router.delete('/sos/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sos = await sosService.cancel(param(req.params.id), req.auth!.sub);
    res.json({ data: sos });
  } catch (err) { next(err); }
});

// PATCH /sos/:id/resolve — muthawwif/admin resolve SOS
router.patch('/sos/:id/resolve', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.auth!.role === 'jamaah') {
      // Jamaah hanya bisa resolve kalau dia muthawwif di group SOS tersebut
      const sos = await db('sos_alerts').where('id', param(req.params.id)).first();
      if (!sos) throw new AppError(404, 'SOS tidak ditemukan', 'NOT_FOUND');
      const member = await db('group_members')
        .where({ group_id: sos.group_id, user_id: req.auth!.sub, is_active: true })
        .first();
      if (!member || member.role_in_group !== 'muthawwif') {
        throw new AppError(403, 'Hanya muthawwif atau admin yang bisa menyelesaikan SOS', 'FORBIDDEN');
      }
    }
    const sos = await sosService.resolve(param(req.params.id), req.auth!.sub);
    res.json({ data: sos });
  } catch (err) { next(err); }
});

// GET /groups/:groupId/sos — SOS aktif per group (muthawwif/admin)
router.get('/groups/:groupId/sos', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const groupId = param(req.params.groupId);
    if (req.auth!.role !== 'admin') {
      const member = await db('group_members')
        .where({ group_id: groupId, user_id: req.auth!.sub, is_active: true })
        .first();
      if (!member || member.role_in_group !== 'muthawwif') {
        throw new AppError(403, 'Hanya muthawwif atau admin yang bisa melihat SOS rombongan', 'FORBIDDEN');
      }
    }
    const alerts = await sosService.listByGroup(groupId);
    res.json({ data: alerts });
  } catch (err) { next(err); }
});

export default router;
