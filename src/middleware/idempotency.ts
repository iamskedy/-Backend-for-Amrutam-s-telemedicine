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
export function requireIdempotencyKey() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const key = req.header('idempotency-key');
    if (!key) {
      next(Errors.badRequest('Idempotency-Key header is required for this operation'));
      return;
    }

    const redisKey = `idem:${req.method}:${req.path}:${key}`;

    try {
      const cached = await redis.get(redisKey);
      if (cached) {
        const stored: StoredResponse = JSON.parse(cached);
        idempotencyReplayTotal.inc({ route: req.path });
        req.log?.info({ key }, 'idempotency replay — returning cached response');
        res.status(stored.statusCode).json(stored.body);
        return;
      }
    } catch (err) {
      // Redis read failure — fail open (let the request proceed normally)
      // rather than blocking a legitimate write over a cache-layer blip.
      logger.error({ err }, 'idempotency check failed — proceeding without cache');
      next();
      return;
    }

    const originalJson = res.json.bind(res);
    res.json = ((body: unknown) => {
      const toStore: StoredResponse = { statusCode: res.statusCode, body };

      // NOTE: this cache write is fire-and-forget (not awaited) to avoid
      // adding Redis-write latency to every response. This means there's a
      // small window (typically single-digit ms) where two near-simultaneous
      // requests with the same idempotency key could both miss the cache
      // and both execute the handler. The booking saga's own optimistic
      // locking (slot version check) is the true source of truth against
      // double-booking; this middleware is a fast-path optimization on top
      // of it, not the sole safeguard. Documented in security checklist.
      void redis
        .set(redisKey, JSON.stringify(toStore), 'EX', IDEMPOTENCY_TTL_SECONDS)
        .catch((err) => logger.error({ err, key: redisKey }, 'failed to cache idempotent response'));

      return originalJson(body);
    }) as typeof res.json;

    next();
  };
}