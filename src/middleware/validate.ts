import { NextFunction, Request, Response } from 'express';
import { z, ZodError, ZodTypeAny } from 'zod';
import { Errors } from '@/middleware/errorHandler';

type ValidateTarget = 'body' | 'query' | 'params';

export function validate<T extends ZodTypeAny>(schema: T, target: ValidateTarget = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const parsed = schema.parse(req[target]) as z.infer<T>;
      req[target] = parsed;
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        next(
          Errors.badRequest(
            'Validation failed',
            err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
          ),
        );
      } else {
        next(err);
      }
    }
  };
}