import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/rbac';
import * as scheduleService from '../services/schedule.service';
import { assertMember } from '../services/group.service';
import { db } from '../db';

const router = Router();
router.use(authenticate);

function param(val: string | string[]): string {
  return Array.isArray(val) ? val[0] : val;
}

async function assertGroupWriter(userId: string, role: string, groupId: string) {
  if (role === 'admin') return;
  const member = await db('group_members')
    .where({ group_id: groupId, user_id: userId, is_active: true })
    .first();
  if (!member || member.role_in_group !== 'muthawwif') {
    const { AppError } = await import('../middleware/error-handler');
    throw new AppError(403, 'Hanya admin atau muthawwif rombongan ini yang bisa mengubah jadwal', 'FORBIDDEN');
  }
}

const createSchema = z.object({
  title: z.string().min(1).max(200),
  location_name: z.string().max(200).optional(),
  start_time: z.string().datetime(),
  end_time: z.string().datetime().optional(),
  status: z.enum(['upcoming', 'active', 'done']).optional(),
  sort_order: z.number().int().optional(),
});

const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  location_name: z.string().max(200).optional(),
  start_time: z.string().datetime().optional(),
  end_time: z.string().datetime().optional(),
  status: z.enum(['upcoming', 'active', 'done']).optional(),
  sort_order: z.number().int().optional(),
});

// GET /groups/:groupId/schedules
router.get(
  '/groups/:groupId/schedules',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const groupId = param(req.params.groupId);
      if (req.auth!.role !== 'admin') {
        await assertMember(groupId, req.auth!.sub);
      }
      const schedules = await scheduleService.listByGroup(groupId);
      res.json({ data: schedules });
    } catch (err) { next(err); }
  },
);

// POST /groups/:groupId/schedules
router.post(
  '/groups/:groupId/schedules',
  validate(createSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const groupId = param(req.params.groupId);
      await assertGroupWriter(req.auth!.sub, req.auth!.role, groupId);
      const schedule = await scheduleService.create(groupId, req.body, req.auth!.sub);
      res.status(201).json({ data: schedule });
    } catch (err) { next(err); }
  },
);

// PUT /schedules/:id
router.put(
  '/schedules/:id',
  validate(updateSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = param(req.params.id);
      const groupId = await scheduleService.getGroupIdBySchedule(id);
      await assertGroupWriter(req.auth!.sub, req.auth!.role, groupId);
      const schedule = await scheduleService.update(id, req.body, req.auth!.sub);
      res.json({ data: schedule });
    } catch (err) { next(err); }
  },
);

// DELETE /schedules/:id
router.delete(
  '/schedules/:id',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = param(req.params.id);
      const groupId = await scheduleService.getGroupIdBySchedule(id);
      await assertGroupWriter(req.auth!.sub, req.auth!.role, groupId);
      await scheduleService.remove(id, req.auth!.sub);
      res.status(204).send();
    } catch (err) { next(err); }
  },
);

export default router;
