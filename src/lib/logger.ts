import pino from 'pino';
import { env, isProd } from '@/config';

export const logger = pino({
  level: env.LOG_LEVEL,
  // Structured JSON in prod (machine-parseable, ships to log aggregation).
  // Pretty-printed in dev for human readability.
  transport: isProd
    ? undefined
    : {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
      },
  redact: {
    // never log secrets/PII even if accidentally passed into a log call —
    // both top-level (e.g. logger.info({ password: ... })) and nested one
    // level deep (e.g. logger.info({ user: { password: ... } })) are covered
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'password',
      'passwordHash',
      'mfaSecret',
      'token',
      'refreshToken',
      '*.password',
      '*.passwordHash',
      '*.mfaSecret',
      '*.token',
      '*.refreshToken',
    ],
    censor: '[REDACTED]',
  },
});