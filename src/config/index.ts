import { z } from 'zod';
import 'dotenv/config';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),

  DATABASE_URL: z.string().url().startsWith('postgresql://', {
    message: 'DATABASE_URL must be a postgresql:// connection string (pooled connection)',
  }),
  DIRECT_URL: z.string().url().startsWith('postgresql://', {
    message: 'DIRECT_URL must be a postgresql:// connection string (direct connection, used by Prisma migrations)',
  }),

  REDIS_URL: z.string().refine((val) => val.startsWith('rediss://') || val.startsWith('redis://'), {
    message: 'REDIS_URL must start with redis:// or rediss://',
  }),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET should be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET should be at least 32 characters'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('30d'),

  MFA_ENCRYPTION_KEY: z.string().min(32).optional(), // used to encrypt stored TOTP secrets at rest

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional(),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    // eslint-disable-next-line no-console
    console.error('Invalid environment configuration:');
    for (const issue of parsed.error.issues) {
      // eslint-disable-next-line no-console
      console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
    }
    process.exit(1);
  }

  return parsed.data;
}

export const env = loadEnv();

export const isProd = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';