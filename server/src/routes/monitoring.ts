import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/auth';
import { AppError } from '../middleware/error-handler';
import * as monitoringService from '../services/monitoring.service';
import { db } from '../db';

const router = Router();
router.use(authenticate);

function param(val: string | string[]): string {
  return Array.isArray(val) ? val[0] : val;
}

async function assertMuthawwifOrAdmin(userId: string, role: string, groupId: string) {
  if (role === 'admin') return;
  const member = await db('group_members')
    .where({ group_id: groupId, user_id: userId, is_active: true })
    .first();
  if (!member || member.role_in_group !== 'muthawwif') {
    throw new AppError(403, 'Hanya admin atau muthawwif yang bisa melihat monitoring', 'FORBIDDEN');
  }
}

// groupId bukan UUID -> 400, bukan 500 dari Postgres (22P02).
const groupParamsSchema = z.object({ groupId: z.string().uuid() });

// GET /groups/:groupId/members/status
router.get(
  '/groups/:groupId/members/status',
  validate(groupParamsSchema, 'params'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const groupId = param(req.params.groupId);
      await assertMuthawwifOrAdmin(req.auth!.sub, req.auth!.role, groupId);
      const result = await monitoringService.getMemberStatuses(groupId);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  },
);

// POST /groups/:groupId/location-reminders — push "aktifkan lokasi" ke jamaah.
// Tanpa user_ids: semua jamaah rombongan yang tidak terpantau.
const reminderSchema = z.object({
  user_ids: z.array(z.string().uuid()).min(1).max(500).optional(),
}).default({}); // body kosong (Express 5: undefined) = ingatkan semua

router.post(
  '/groups/:groupId/location-reminders',
  validate(groupParamsSchema, 'params'),
  validate(reminderSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const groupId = param(req.params.groupId);
      await assertMuthawwifOrAdmin(req.auth!.sub, req.auth!.role, groupId);
      const result = await monitoringService.sendLocationReminders(groupId, req.auth!.sub, req.body.user_ids);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
