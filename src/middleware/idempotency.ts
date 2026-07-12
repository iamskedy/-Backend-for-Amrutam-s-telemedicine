import { NextFunction, Request, Response } from 'express';
import { redis } from '@/lib/redis';
import { Errors } from '@/middleware/errorHandler';
import { idempotencyReplayTotal } from '@/lib/metrics';
import { logger } from '@/lib/logger';

const IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60; // 24h — long enough to cover client retry windows

interface StoredResponse {
  statusCode: number;
  body: unknown;
}

/**
 * Enforces the Idempotency-Key header on write operations. First request
 * with a given key executes normally and its response is cached. Any
 * subsequent request with the same key (within the TTL) short-circuits and
 * replays the original response instead of re-executing the handler —
 * this is what prevents duplicate bookings/payments on client retry.
 */

import { asyncHandler } from '@/lib/asyncHandler';

export function requireIdempotencyKey() {
  return asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const key = req.header('idempotency-key');
    if (!key) {
      next(Errors.badRequest('Idempotency-Key header is required for this operation'));
      return;
    }

    const redisKey = `idem:${req.method}:${req.path}:${key}`;

    try {
      const cached = await redis.get(redisKey);
      if (cached) {
        const stored = JSON.parse(cached) as StoredResponse;
        idempotencyReplayTotal.inc({ route: req.path });
        req.log?.info({ key }, 'idempotency replay — returning cached response');
        res.status(stored.statusCode).json(stored.body);
        return;
      }
    } catch (err) {
      logger.error({ err }, 'idempotency check failed — proceeding without cache');
      next();
      return;
    }

    const originalJson = res.json.bind(res);
    res.json = ((body: unknown) => {
      const toStore: StoredResponse = { statusCode: res.statusCode, body };
      void redis
        .set(redisKey, JSON.stringify(toStore), 'EX', IDEMPOTENCY_TTL_SECONDS)
        .catch((err) => logger.error({ err, key: redisKey }, 'failed to cache idempotent response'));
      return originalJson(body);
    }) as typeof res.json;

    next();
  });
}