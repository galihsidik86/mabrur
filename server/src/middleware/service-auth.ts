import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { config } from '../config';

/**
 * Autentikasi mesin-ke-mesin utk integrasi Safar.
 * Header: X-Service-Token — dibandingkan timing-safe dgn env SAFAR_SYNC_TOKEN.
 * Terpisah dari JWT user: token ini bukan identitas manusia dan tidak membawa role.
 */
export function requireServiceToken(req: Request, res: Response, next: NextFunction): void {
  if (!config.SAFAR_SYNC_TOKEN) {
    res.status(503).json({
      error: { message: 'Integrasi Safar tidak dikonfigurasi (SAFAR_SYNC_TOKEN)', code: 'INTEGRATION_DISABLED' },
    });
    return;
  }
  const given = req.header('x-service-token') ?? '';
  const expected = config.SAFAR_SYNC_TOKEN;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  const match = a.length === b.length && crypto.timingSafeEqual(a, b);
  if (!match) {
    res.status(401).json({
      error: { message: 'Service token tidak valid', code: 'UNAUTHORIZED' },
    });
    return;
  }
  next();
}
