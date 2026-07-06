import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/rbac';
import * as userService from '../services/user.service';

const router = Router();

function param(val: string | string[]): string {
  return Array.isArray(val) ? val[0] : val;
}

router.use(authenticate);
router.use(authorize('admin'));

const createSchema = z.object({
  phone: z.string().regex(/^08\d{8,13}$/, 'Format: 08xxxxxxxxxx (10-15 digit)'),
  password: z.string().min(6, 'Password minimal 6 karakter'),
  name: z.string().min(1, 'Nama wajib diisi').max(100),
  role: z.enum(['admin', 'muthawwif', 'jamaah']),
  passport_no: z.string().max(20).optional(),
  blood_type: z.string().max(10).optional(),
  medical_notes: z.string().max(500).optional(),
  emergency_contact: z.string().max(50).optional(),
});

const updateSchema = z.object({
  phone: z.string().regex(/^08\d{8,13}$/).optional(),
  password: z.string().min(6).optional(),
  name: z.string().min(1).max(100).optional(),
  role: z.enum(['admin', 'muthawwif', 'jamaah']).optional(),
  passport_no: z.string().max(20).optional(),
  blood_type: z.string().max(10).optional(),
  medical_notes: z.string().max(500).optional(),
  emergency_contact: z.string().max(50).optional(),
});

const listSchema = z.object({
  role: z.enum(['admin', 'muthawwif', 'jamaah']).optional(),
  search: z.string().max(100).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

router.post(
  '/',
  validate(createSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await userService.createUser(req.body, req.auth!.sub);
      res.status(201).json({ data: user });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  '/',
  validate(listSchema, 'query'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await userService.listUsers(req.query as any);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  '/:id',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await userService.getUser(param(req.params.id));
      res.json({ data: user });
    } catch (err) {
      next(err);
    }
  },
);

router.patch(
  '/:id',
  validate(updateSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await userService.updateUser(
        param(req.params.id),
        req.body,
        req.auth!.sub,
      );
      res.json({ data: user });
    } catch (err) {
      next(err);
    }
  },
);

router.delete(
  '/:id',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await userService.deleteUser(param(req.params.id), req.auth!.sub);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
);

export default router;
