import { NextFunction, Request, Response } from 'express';
import { isProd } from '@/config';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}


export const Errors = {
  badRequest: (msg: string, details?: unknown) => new AppError(400, 'BAD_REQUEST', msg, details),
  unauthorized: (msg = 'Unauthorized') => new AppError(401, 'UNAUTHORIZED', msg),
  forbidden: (msg = 'Forbidden') => new AppError(403, 'FORBIDDEN', msg),
  notFound: (msg = 'Not found') => new AppError(404, 'NOT_FOUND', msg),
  conflict: (msg: string, details?: unknown) => new AppError(409, 'CONFLICT', msg, details),
  tooManyRequests: (msg = 'Rate limit exceeded') => new AppError(429, 'TOO_MANY_REQUESTS', msg),
  internal: (msg = 'Internal server error') => new AppError(500, 'INTERNAL_ERROR', msg),
};


export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  const requestId = req.requestId;

  if (err instanceof AppError) {
    req.log?.warn({ err, code: err.code, requestId }, 'handled application error');
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
        requestId,
      },
    });
    return;
  }

  req.log?.error({ err, requestId }, 'unhandled error');
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: isProd ? 'Something went wrong' : err.message,
      requestId,
    },
  });
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.path} not found` },
  });
}
