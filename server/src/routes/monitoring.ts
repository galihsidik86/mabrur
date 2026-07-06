import { Router, Request, Response, NextFunction } from 'express';
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

// GET /groups/:groupId/members/status
router.get(
  '/groups/:groupId/members/status',
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

export default router;
