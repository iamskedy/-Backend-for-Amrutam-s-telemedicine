import { NextFunction, Request, Response } from 'express';
import { AnyZodObject, ZodError } from 'zod';
import { Errors } from '@/middleware/errorHandler';

type ValidateTarget = 'body' | 'query' | 'params';

/**
 * Validates req[target] against a zod schema. On success, replaces
 * req[target] with the parsed (and possibly coerced/defaulted) data. On
 * failure, passes a structured 400 error to the error handler with the
 * field-level issues attached, so API consumers know exactly what to fix.
 */
export function validate(schema: AnyZodObject, target: ValidateTarget = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const parsed = schema.parse(req[target]);
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