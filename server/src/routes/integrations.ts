import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { requireServiceToken } from '../middleware/service-auth';
import { syncFromSafar, getGroupStatusForSafar } from '../services/integration.service';

function param(v: string | string[]): string { return Array.isArray(v) ? v[0] : v; }

/**
 * Integrasi Safar (back-office travel) — endpoint mesin-ke-mesin.
 * Auth: header X-Service-Token (lihat middleware/service-auth).
 */
const router = Router();
router.use(requireServiceToken);

const syncSchema = z.object({
  group: z.object({
    externalRef: z.string().uuid(),
    name: z.string().min(3).max(120),
    kloterCode: z.string().regex(/^[A-Za-z0-9-]+$/).max(20),
    year: z.number().int().min(2024).max(2100),
  }),
  members: z
    .array(
      z.object({
        externalRef: z.string().uuid(),
        phone: z.string().regex(/^08\d{8,13}$/, 'Format nomor HP: 08xxxxxxxxxx'),
        name: z.string().min(2).max(120),
        role: z.enum(['jamaah', 'muthawwif']),
        passportNo: z.string().max(20).nullish(),
        emergencyContact: z.string().max(120).nullish(),
        initialPassword: z.string().min(6).max(60).nullish(),
      }),
    )
    .min(1)
    .max(200),
  schedules: z
    .array(
      z.object({
        title: z.string().min(2).max(160),
        locationName: z.string().max(160).nullish(),
        startTime: z.string().datetime({ offset: true }),
        endTime: z.string().datetime({ offset: true }).nullish(),
        sortOrder: z.number().int().min(0).max(1000).optional(),
      }),
    )
    .max(100)
    .optional(),
});

router.post('/safar/sync', validate(syncSchema), async (req, res, next) => {
  try {
    const result = await syncFromSafar(req.body);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

router.get('/safar/groups/:externalRef/status', async (req, res, next) => {
  try {
    const externalRef = param(req.params.externalRef);
    const result = await getGroupStatusForSafar(externalRef);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

export default router;
