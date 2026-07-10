import Redis from 'ioredis';
import { env } from '@/config';
import { logger } from '@/lib/logger';


export const redis = new Redis(env.REDIS_URL, {

  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    if (times > 10) {
      logger.error({ times }, 'redis retry limit exceeded, giving up');
      return null; 
    }
    return Math.min(times * 200, 2000);
  },

});

redis.on('connect', () => {
  logger.info({ tls: env.REDIS_URL.startsWith('rediss://') }, 'redis connected');
});

redis.on('error', (err) => {
  logger.error({ err }, 'redis connection error');
});

export async function checkRedisHealth(): Promise<boolean> {
  try {
    const pong = await redis.ping();
    return pong === 'PONG';
  } catch {
    return false;
  }
}

export async function disconnectRedis(): Promise<void> {
  await redis.quit();
}
