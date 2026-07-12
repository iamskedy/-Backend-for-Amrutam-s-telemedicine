import express, { Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import pinoHttp from 'pino-http';
import swaggerUi from "swagger-ui-express";
import YAML from "yamljs";
import path from "path";
import { logger } from '@/lib/logger';
import { requestContext } from '@/middleware/requestContext';
import { errorHandler, notFoundHandler } from '@/middleware/errorHandler';
import { httpRequestDuration, httpRequestsTotal } from '@/lib/metrics';
import { healthRouter } from '@/modules/health/health.routes';
import { authRouter } from './modules/auth/auth.routes';
import { doctorRouter } from '@/modules/doctors/doctor.routes';
import { availabilityRouter } from '@/modules/availability/availability.routes';
import { consultationRouter } from '@/modules/consultations/consultation.routes';
import { prescriptionRouter } from '@/modules/prescriptions/prescription.routes';
import { searchRouter } from '@/modules/search/search.routes';
import { adminRouter } from '@/modules/admin/analytics.routes';
import { bookingRouter } from '@/modules/booking/booking.routes';



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
      const routePath = (req.route as { path?: string } | undefined)?.path;
      const route = routePath ? `${req.baseUrl}${routePath}` : req.path;
      const labels = { method: req.method, route, status_code: String(res.statusCode) };
      httpRequestDuration.observe(labels, durationSec);
      httpRequestsTotal.inc(labels);
    });
    next();
  });

 const swaggerDocument = YAML.load(
  path.join(process.cwd(), "docs", "openapi.yaml")
);

  app.use("/api-docs",swaggerUi.serve,swaggerUi.setup(swaggerDocument));
  app.use('/health', healthRouter);
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/doctors', doctorRouter);
  app.use('/api/v1/availability', availabilityRouter);
  app.use('/api/v1/consultations', consultationRouter);

app.use('/api/v1/bookings', bookingRouter);
  app.use('/api/v1/prescriptions', prescriptionRouter);
  app.use('/api/v1/search', searchRouter);
  app.use('/api/v1/admin', adminRouter);
 

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
