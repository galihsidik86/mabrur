import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { db } from '../db';
import { config } from '../config';
import { AppError } from '../middleware/error-handler';
import { audit } from './audit.service';
import { logger } from '../logger';

const loginFailures = new Map<string, { count: number; last: number }>();
const ALERT_THRESHOLD = 5;

const ACCESS_EXPIRY = '15m';
const REFRESH_EXPIRY_DAYS = 30;

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function trackLoginFailure(phone: string) {
  const now = Date.now();
  const entry = loginFailures.get(phone) || { count: 0, last: now };
  // Reset if last failure was > 15 minutes ago
  if (now - entry.last > 15 * 60 * 1000) entry.count = 0;
  entry.count++;
  entry.last = now;
  loginFailures.set(phone, entry);
  if (entry.count >= ALERT_THRESHOLD) {
    logger.warn({ phone, attempts: entry.count }, 'SECURITY: Login gagal berulang — kemungkinan brute force');
  }
}

// Hash dummy untuk perbandingan ketika user tidak ditemukan
// Perbaikan: mencegah timing attack untuk enumerasi nomor HP
const DUMMY_HASH = '$2a$12$LJ3m4ys3Lf0j9OLQQ3xBjuNZNPMcnSqOMZpjGR3keYfqaGISsBQi';

export async function login(phone: string, password: string) {
  const user = await db('users').where({ phone, is_active: true }).first();

  // Perbaikan: selalu jalankan bcrypt.compare agar waktu respons konsisten
  // mencegah penyerang mendeteksi nomor HP valid via perbedaan waktu
  const valid = await bcrypt.compare(password, user?.password_hash || DUMMY_HASH);
  if (!user || !valid) {
    trackLoginFailure(phone);
    throw new AppError(401, 'Nomor HP atau password salah', 'AUTH_FAILED');
  }

  // Perbaikan: pin algoritma HS256 secara eksplisit
  const accessToken = jwt.sign(
    { sub: user.id, role: user.role },
    config.JWT_SECRET,
    { algorithm: 'HS256', expiresIn: ACCESS_EXPIRY },
  );

  const refreshToken = crypto.randomBytes(40).toString('hex');
  const expiresAt = new Date(
    Date.now() + REFRESH_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
  );

  await db('refresh_tokens').insert({
    user_id: user.id,
    token_hash: hashToken(refreshToken),
    expires_at: expiresAt,
  });

  await audit(user.id, 'auth.login', 'users', user.id);

  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    user: { id: user.id, name: user.name, phone: user.phone, role: user.role, must_change_password: !!user.must_change_password },
  };
}

// Perbaikan: hapus semua refresh token saat password diubah
// mencegah sesi lama tetap aktif setelah reset password
export async function revokeAllTokens(userId: string) {
  await db('refresh_tokens').where('user_id', userId).delete();
}

export async function refresh(refreshToken: string) {
  const tokenHash = hashToken(refreshToken);

  const stored = await db('refresh_tokens')
    .where('token_hash', tokenHash)
    .where('expires_at', '>', new Date())
    .first();

  if (!stored) {
    throw new AppError(401, 'Refresh token tidak valid atau sudah kedaluwarsa', 'TOKEN_INVALID');
  }

  const user = await db('users')
    .where({ id: stored.user_id, is_active: true })
    .first();

  if (!user) {
    throw new AppError(401, 'Pengguna tidak ditemukan atau tidak aktif', 'TOKEN_INVALID');
  }

  // Rotate: hapus token lama, buat baru (atomic transaction)
  const accessToken = jwt.sign(
    { sub: user.id, role: user.role },
    config.JWT_SECRET,
    { algorithm: 'HS256', expiresIn: ACCESS_EXPIRY },
  );

  const newRefreshToken = crypto.randomBytes(40).toString('hex');
  const expiresAt = new Date(
    Date.now() + REFRESH_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
  );

  await db.transaction(async (trx) => {
    await trx('refresh_tokens').where('id', stored.id).delete();
    await trx('refresh_tokens').insert({
      user_id: user.id,
      token_hash: hashToken(newRefreshToken),
      expires_at: expiresAt,
    });
  });

  return {
    access_token: accessToken,
    refresh_token: newRefreshToken,
    user: { id: user.id, name: user.name, phone: user.phone, role: user.role, must_change_password: !!user.must_change_password },
  };
}

export async function logout(userId: string, refreshToken: string) {
  const tokenHash = hashToken(refreshToken);
  await db('refresh_tokens')
    .where({ user_id: userId, token_hash: tokenHash })
    .delete();
  await audit(userId, 'auth.logout', 'users', userId);
}
