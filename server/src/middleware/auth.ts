import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { db } from '../db';
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
    // Perbaikan: pin algoritma HS256 untuk mencegah algorithm confusion attack
    const payload = jwt.verify(header.slice(7), config.JWT_SECRET, {
      algorithms: ['HS256'],
    }) as AuthPayload;
    req.auth = payload;

    // Perbaikan: cek user masih aktif — token lama tetap valid secara JWT
    // tapi user bisa saja sudah dinonaktifkan admin
    db('users')
      .where({ id: payload.sub, is_active: true })
      .select('id')
      .first()
      .then((user) => {
        if (!user) {
          res.status(401).json({
            error: { message: 'Akun telah dinonaktifkan', code: 'UNAUTHORIZED' },
          });
          return;
        }
        next();
      })
      .catch(() => {
        res.status(500).json({
          error: { message: 'Terjadi kesalahan pada server', code: 'INTERNAL_ERROR' },
        });
      });
  } catch {
    res.status(401).json({
      error: { message: 'Token tidak valid atau sudah kedaluwarsa', code: 'UNAUTHORIZED' },
    });
  }
}
