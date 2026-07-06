import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import type { AuthPayload } from '../types';

export function authenticate(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({
      error: { message: 'Token tidak ditemukan', code: 'UNAUTHORIZED' },
    });
    return;
  }

  try {
    const payload = jwt.verify(header.slice(7), config.JWT_SECRET) as AuthPayload;
    req.auth = payload;
    next();
  } catch {
    res.status(401).json({
      error: { message: 'Token tidak valid atau sudah kedaluwarsa', code: 'UNAUTHORIZED' },
    });
  }
}
