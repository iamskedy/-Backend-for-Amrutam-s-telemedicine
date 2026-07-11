import { RateLimiterRedis, RateLimiterRes } from 'rate-limiter-flexible';
import { NextFunction, Request, Response } from 'express';
import { redis } from '@/lib/redis';
import { Errors } from '@/middleware/errorHandler';
import { logger } from '@/lib/logger';

function createRateLimiter(points: number, duration: number) {
  const limiter = new RateLimiterRedis({
    storeClient: redis,
    points,
    duration,
    keyPrefix: 'rl',
  });

  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    
    const key = req.ip ?? 'unknown';

    try {
      await limiter.consume(key);
      next();
    } catch (err) {
      if (err instanceof RateLimiterRes) {
        next(Errors.tooManyRequests());
      } else {
        
        logger.error({ err }, 'rate limiter infrastructure error — failing open');
        next();
      }
    }
  };
}

export const generalLimiter = createRateLimiter(100, 60);
export const authLimiter = createRateLimiter(5, 60);