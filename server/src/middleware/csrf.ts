import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';

const tokens = new Map<string, number>();
const TOKEN_TTL = 60 * 60 * 1000; // 1 hour

export function csrfToken(req: Request, res: Response, _next: NextFunction): void {
  const token = crypto.randomBytes(32).toString('hex');
  tokens.set(token, Date.now());
  res.json({ data: { csrf_token: token } });
}

export function csrfVerify(req: Request, res: Response, next: NextFunction): void {
  // Skip for non-mutating methods and API (JWT-based)
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();

  // Skip if Authorization header present (API calls with JWT)
  if (req.headers.authorization) return next();

  const token = req.headers['x-csrf-token'] as string || req.body?._csrf;
  if (!token || !tokens.has(token)) {
    res.status(403).json({ error: { message: 'CSRF token tidak valid', code: 'CSRF_ERROR' } });
    return;
  }

  const created = tokens.get(token)!;
  tokens.delete(token);
  if (Date.now() - created > TOKEN_TTL) {
    res.status(403).json({ error: { message: 'CSRF token kedaluwarsa', code: 'CSRF_ERROR' } });
    return;
  }

  next();
}

// Cleanup old tokens periodically
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of tokens) {
    if (now - v > TOKEN_TTL) tokens.delete(k);
  }
}, 10 * 60 * 1000);
