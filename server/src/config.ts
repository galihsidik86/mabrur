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
  ENCRYPTION_KEY: z.string().length(64),
});

export const config = envSchema.parse(process.env);
