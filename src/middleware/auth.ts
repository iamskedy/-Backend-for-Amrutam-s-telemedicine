import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '@/config';
import { Errors } from '@/middleware/errorHandler';

export interface AuthPayload {
  sub: string; 
  role: 'PATIENT' | 'DOCTOR' | 'ADMIN';
}


export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.header('authorization');
  if (!header?.startsWith('Bearer ')) {
    next(Errors.unauthorized('Missing or malformed Authorization header'));
    return;
  }

  const token = header.slice('Bearer '.length);

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as AuthPayload;
    req.user = payload;
    next();
  } catch {
    next(Errors.unauthorized('Invalid or expired token'));
  }
}