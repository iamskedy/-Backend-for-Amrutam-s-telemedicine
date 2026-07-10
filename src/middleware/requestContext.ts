import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { logger } from '@/lib/logger';


declare module 'express-serve-static-core' {
  interface Request {
    requestId: string;
    log: typeof logger;
  }
}

/**
 * Attaches a correlation ID to every request (reused from an inbound
 * X-Request-Id header if the caller/gateway already set one, otherwise
 * generated fresh), and a request-scoped child logger that automatically
 * includes it. Every downstream log line for this request carries the same
 * ID, which is what makes tracing a single request through logs + traces
 * actually usable in production.
 */
export function requestContext(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header('x-request-id');
  req.requestId = incoming && incoming.length > 0 ? incoming : randomUUID();
  req.log = logger.child({ requestId: req.requestId });
  res.setHeader('x-request-id', req.requestId);
  next();
}
