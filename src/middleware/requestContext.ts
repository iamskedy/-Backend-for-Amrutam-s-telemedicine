import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { logger } from '@/lib/logger';


export function requestContext(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header('x-request-id');
  req.requestId = incoming && incoming.length > 0 ? incoming : randomUUID();
  req.log = logger.child({ requestId: req.requestId });
  res.setHeader('x-request-id', req.requestId);
  next();
}