import { Request, Response, NextFunction } from 'express';
import { requireRole } from '@/middleware/rbac';
import { AppError } from '@/middleware/errorHandler';

describe('requireRole middleware', () => {
  const middleware = requireRole('ADMIN', 'DOCTOR');

  function mockReq(user?: { sub: string; role: string }): Request {
    return { user } as unknown as Request;
  }

  function mockNext(): jest.Mock<void, [Error?]> {
    return jest.fn<void, [Error?]>();
  }

  it('allows a user whose role is in the allowed list', () => {
    const req = mockReq({ sub: '1', role: 'ADMIN' });
    const next = mockNext();

    middleware(req, {} as Response, next as unknown as NextFunction);

    expect(next).toHaveBeenCalledWith();
  });

  it('denies a user whose role is not in the allowed list', () => {
    const req = mockReq({ sub: '2', role: 'PATIENT' });
    const next = mockNext();

    middleware(req, {} as Response, next as unknown as NextFunction);

    expect(next).toHaveBeenCalledTimes(1);
    const errArg = next.mock.calls[0]![0]! as AppError;
    expect(errArg).toBeInstanceOf(AppError);
    expect(errArg.statusCode).toBe(403);
  });

  it('denies a request with no authenticated user at all', () => {
    const req = mockReq(undefined);
    const next = mockNext();

    middleware(req, {} as Response, next as unknown as NextFunction);

    expect(next).toHaveBeenCalledTimes(1);
    const errArg = next.mock.calls[0]![0]! as AppError;
    expect(errArg).toBeInstanceOf(AppError);
    expect(errArg.statusCode).toBe(401);
  });
});