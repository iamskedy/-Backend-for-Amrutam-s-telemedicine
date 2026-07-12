import { Router } from 'express';
import { checkDbHealth } from '@/lib/prisma';
import { checkRedisHealth } from '@/lib/redis';
import { registry } from '@/lib/metrics';
import { asyncHandler } from '@/lib/asyncHandler';

export const healthRouter = Router();

healthRouter.get('/live', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

healthRouter.get('/ready', asyncHandler(async (_req, res) => {
  const [dbOk, redisOk] = await Promise.all([checkDbHealth(), checkRedisHealth()]);
  const healthy = dbOk && redisOk;

  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'ok' : 'degraded',
    dependencies: {
      database: dbOk ? 'ok' : 'unreachable',
      redis: redisOk ? 'ok' : 'unreachable',
    },
  });
}));

healthRouter.get('/metrics', asyncHandler(async (_req, res) => {
  res.setHeader('Content-Type', registry.contentType);
  res.send(await registry.metrics());
}));