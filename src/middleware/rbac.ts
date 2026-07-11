import { NextFunction, Request, Response } from 'express';
import { Errors } from '@/middleware/errorHandler';
import { AuthPayload } from '@/middleware/auth';

export function requireRole(...allowedRoles: AuthPayload['role'][]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(Errors.unauthorized('Authentication required before role check'));
      return;
    }
    if (!allowedRoles.includes(req.user.role)) {
      next(Errors.forbidden(`This action requires one of: ${allowedRoles.join(', ')}`));
      return;
    }
    next();
  };
}