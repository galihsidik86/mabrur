import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/rbac';
import * as contentService from '../services/content.service';

const router = Router();
router.use(authenticate);

function param(val: string | string[]): string {
  return Array.isArray(val) ? val[0] : val;
}

// ==================== Ibadah Guides ====================

const guideListSchema = z.object({
  type: z.enum(['umrah', 'haji']).optional(),
});

const guideCreateSchema = z.object({
  type: z.enum(['umrah', 'haji']),
  step_number: z.number().int().positive(),
  title: z.string().min(1).max(100),
  subtitle: z.string().max(200).optional(),
  steps_text: z.string().max(2000).optional(),
  arabic_text: z.string().max(1000).optional(),
  latin_text: z.string().max(1000).optional(),
});

const guideUpdateSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  subtitle: z.string().max(200).optional(),
  step_number: z.number().int().positive().optional(),
  steps_text: z.string().max(2000).optional(),
  arabic_text: z.string().max(1000).optional(),
  latin_text: z.string().max(1000).optional(),
});

router.get(
  '/ibadah-guides',
  validate(guideListSchema, 'query'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const guides = await contentService.listGuides(req.query.type as string | undefined);
      res.json({ data: guides });
    } catch (err) { next(err); }
  },
);

router.get('/ibadah-guides/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const guide = await contentService.getGuide(param(req.params.id));
    res.json({ data: guide });
  } catch (err) { next(err); }
});

router.post(
  '/ibadah-guides',
  authorize('admin'),
  validate(guideCreateSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const guide = await contentService.createGuide(req.body, req.auth!.sub);
      res.status(201).json({ data: guide });
    } catch (err) { next(err); }
  },
);

router.put(
  '/ibadah-guides/:id',
  authorize('admin'),
  validate(guideUpdateSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const guide = await contentService.updateGuide(param(req.params.id), req.body, req.auth!.sub);
      res.json({ data: guide });
    } catch (err) { next(err); }
  },
);

router.delete(
  '/ibadah-guides/:id',
  authorize('admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await contentService.deleteGuide(param(req.params.id), req.auth!.sub);
      res.status(204).send();
    } catch (err) { next(err); }
  },
);

// ==================== Duas ====================

const duaCreateSchema = z.object({
  title: z.string().min(1).max(100),
  context: z.string().max(200).optional(),
  arabic_text: z.string().max(2000).optional(),
  latin_text: z.string().max(2000).optional(),
  translation: z.string().max(2000).optional(),
  sort_order: z.number().int().optional(),
});

const duaUpdateSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  context: z.string().max(200).optional(),
  arabic_text: z.string().max(2000).optional(),
  latin_text: z.string().max(2000).optional(),
  translation: z.string().max(2000).optional(),
  sort_order: z.number().int().optional(),
});

router.get('/duas', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const duas = await contentService.listDuas();
    res.json({ data: duas });
  } catch (err) { next(err); }
});

router.get('/duas/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dua = await contentService.getDua(param(req.params.id));
    res.json({ data: dua });
  } catch (err) { next(err); }
});

router.post(
  '/duas',
  authorize('admin'),
  validate(duaCreateSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dua = await contentService.createDua(req.body, req.auth!.sub);
      res.status(201).json({ data: dua });
    } catch (err) { next(err); }
  },
);

router.put(
  '/duas/:id',
  authorize('admin'),
  validate(duaUpdateSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dua = await contentService.updateDua(param(req.params.id), req.body, req.auth!.sub);
      res.json({ data: dua });
    } catch (err) { next(err); }
  },
);

router.delete(
  '/duas/:id',
  authorize('admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await contentService.deleteDua(param(req.params.id), req.auth!.sub);
      res.status(204).send();
    } catch (err) { next(err); }
  },
);

export default router;
