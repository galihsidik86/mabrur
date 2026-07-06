import { Request, Response, NextFunction } from 'express';
import type { UserRole } from '../types';

export function authorize(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.auth) {
      res.status(401).json({
        error: { message: 'Tidak terautentikasi', code: 'UNAUTHORIZED' },
      });
      return;
    }

    if (!roles.includes(req.auth.role)) {
      res.status(403).json({
        error: { message: 'Anda tidak memiliki akses untuk ini', code: 'FORBIDDEN' },
      });
      return;
    }

    next();
  };
}
