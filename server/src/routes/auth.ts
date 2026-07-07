import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/auth';
import * as authService from '../services/auth.service';
import * as userService from '../services/user.service';
import { savePushToken } from '../services/push.service';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    error: {
      message: 'Terlalu banyak percobaan login. Coba lagi dalam 15 menit.',
      code: 'RATE_LIMITED',
    },
  },
});

const loginSchema = z.object({
  phone: z.string().min(1, 'Nomor HP wajib diisi'),
  password: z.string().min(1, 'Password wajib diisi'),
});

const refreshSchema = z.object({
  refresh_token: z.string().min(1, 'Refresh token wajib diisi'),
});

router.post(
  '/login',
  loginLimiter,
  validate(loginSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await authService.login(req.body.phone, req.body.password);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  '/refresh',
  validate(refreshSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await authService.refresh(req.body.refresh_token);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  '/logout',
  authenticate,
  validate(refreshSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await authService.logout(req.auth!.sub, req.body.refresh_token);
      res.json({ data: { message: 'Berhasil logout' } });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  '/me',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await userService.getUser(req.auth!.sub);
      res.json({ data: user });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  '/push-token',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await savePushToken(req.auth!.sub, req.body.token);
      res.json({ data: { ok: true } });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
