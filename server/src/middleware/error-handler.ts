import { Request, Response, NextFunction } from 'express';
import { logger } from '../logger';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code: string = 'ERROR',
  ) {
    super(message);
  }
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error({ err, path: req.path, method: req.method }, err.message);
    }
    res.status(err.statusCode).json({
      error: { message: err.message, code: err.code },
    });
    return;
  }

  logger.error({ err, path: req.path, method: req.method, stack: err.stack }, 'Unhandled error');
  res.status(500).json({
    error: { message: 'Terjadi kesalahan pada server', code: 'INTERNAL_ERROR' },
  });
}
