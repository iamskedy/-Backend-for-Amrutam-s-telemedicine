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
 *
 * Only successful (2xx) responses are cached. Error responses (4xx/5xx)
 * are intentionally NOT cached — caching an error would mean a client
 * retrying after a transient failure (DB blip, gateway timeout, etc.)
 * gets that same error replayed forever for the TTL window instead of
 * getting a fresh attempt through the real handler.
 */

import { asyncHandler } from '@/lib/asyncHandler';

export function requireIdempotencyKey() {
  return asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const key = req.header('idempotency-key');
    if (!key) {
      next(Errors.badRequest('Idempotency-Key header is required for this operation'));
      return;
    }

    // req.path is relative to wherever this router is mounted (e.g. just
    // "/" for a POST to /api/v1/bookings), which would collide with any
    // other router's root POST route sharing the same key. Use
    // originalUrl so the key is scoped to the real, full request path.
    const redisKey = `idem:${req.method}:${req.originalUrl}:${key}`;

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
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const toStore: StoredResponse = { statusCode: res.statusCode, body };
        void redis
          .set(redisKey, JSON.stringify(toStore), 'EX', IDEMPOTENCY_TTL_SECONDS)
          .catch((err) => logger.error({ err, key: redisKey }, 'failed to cache idempotent response'));
      }
      return originalJson(body);
    }) as typeof res.json;

    next();
  });
}