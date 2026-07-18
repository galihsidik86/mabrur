import { config as loadEnv } from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Load .env from project root (parent of server/)
loadEnv({ path: path.resolve(__dirname, '../../.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().min(10),
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  // Perbaikan: validasi bahwa key adalah hex valid (32 bytes = 64 hex chars)
  ENCRYPTION_KEY: z.string().length(64).regex(/^[0-9a-f]+$/i, 'ENCRYPTION_KEY harus berupa 64 karakter hex'),
  // Token service-to-service utk integrasi Safar (opsional — endpoint /integrations
  // menolak 503 bila tidak dikonfigurasi). Min 32 karakter.
  SAFAR_SYNC_TOKEN: z.string().min(32).optional(),
});

export const config = envSchema.parse(process.env);
