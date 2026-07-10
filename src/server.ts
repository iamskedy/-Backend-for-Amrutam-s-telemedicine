import { buildApp } from '@/app';
import { env } from '@/config';
import { logger } from '@/lib/logger';
import { connectDb, disconnectDb, checkDbHealth } from '@/lib/prisma';
import { checkRedisHealth, disconnectRedis } from '@/lib/redis';

async function main(): Promise<void> {
  // Verify dependencies before accepting traffic — fail loudly at boot
  // rather than accepting requests a broken DB/Redis connection can't serve.
  await connectDb();
  const [dbOk, redisOk] = await Promise.all([checkDbHealth(), checkRedisHealth()]);

  if (!dbOk) {
    logger.error('database health check failed at startup — check DATABASE_URL/DIRECT_URL');
    process.exit(1);
  }
  if (!redisOk) {
    logger.error('redis health check failed at startup — check REDIS_URL (rediss:// vs redis://)');
    process.exit(1);
  }

  logger.info({ db: dbOk, redis: redisOk }, 'dependencies healthy, starting server');

  const app = buildApp();
  const server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT, env: env.NODE_ENV }, 'amrutam-telemedicine server listening');
  });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'shutdown signal received, closing gracefully');
    server.close(async () => {
      await Promise.all([disconnectDb(), disconnectRedis()]);
      logger.info('shutdown complete');
      process.exit(0);
    });

    // force-exit if graceful shutdown hangs (e.g. a stuck connection)
    setTimeout(() => {
      logger.error('graceful shutdown timed out, forcing exit');
      process.exit(1);
    }, 10_000).unref();
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((err) => {
  logger.error({ err }, 'fatal error during server startup');
  process.exit(1);
});
