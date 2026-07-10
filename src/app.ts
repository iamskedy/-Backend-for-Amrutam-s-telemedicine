import express, { Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import pinoHttp from 'pino-http';

import { logger } from '@/lib/logger';
import { requestContext } from '@/middleware/requestContext';
import { errorHandler, notFoundHandler } from '@/middleware/errorHandler';
import { httpRequestDuration, httpRequestsTotal } from '@/lib/metrics';
import { healthRouter } from '@/modules/health/health.routes';

export function buildApp(): Express {
  const app = express();

  
  app.use(helmet());
  app.use(cors()); 
  app.use(compression());
  app.use(express.json({ limit: '1mb' }));
  app.use(requestContext);
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => (req as express.Request).requestId,
      customLogLevel: (_req, res, err) => {
        if (err || res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },
    }),
  );

 
  app.use((req, res, next) => {
    const start = process.hrtime.bigint();
    res.on('finish', () => {
      const durationSec = Number(process.hrtime.bigint() - start) / 1e9;
      const route = req.route?.path ? `${req.baseUrl}${req.route.path}` : req.path;
      const labels = { method: req.method, route, status_code: String(res.statusCode) };
      httpRequestDuration.observe(labels, durationSec);
      httpRequestsTotal.inc(labels);
    });
    next();
  });

 
  app.use('/health', healthRouter);

 

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
