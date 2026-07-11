import { NextFunction, Request, Response } from 'express';

type AsyncRouteHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

/**
 * Wraps an async Express route handler so that any rejected promise (i.e.
 * any thrown error inside an async function) is automatically forwarded to
 * next(err) — and therefore reaches errorHandler.ts — instead of becoming an
 * unhandled promise rejection that crashes the process or hangs the request.
 */
export function asyncHandler(fn: AsyncRouteHandler) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };
}
