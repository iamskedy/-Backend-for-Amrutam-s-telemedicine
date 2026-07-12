import { Router } from 'express';
import { requireAuth } from '@/middleware/auth';
import { requireRole } from '@/middleware/rbac';
import { validate } from '@/middleware/validate';
import { requireIdempotencyKey } from '@/middleware/idempotency';
import { bookConsultationSchema } from '@/modules/booking/booking.schema';
import { bookConsultationController } from '@/modules/booking/booking.controller';

export const bookingRouter = Router();

bookingRouter.post(
  '/',
  requireAuth,
  requireRole('PATIENT'),
  requireIdempotencyKey(),
  validate(bookConsultationSchema),
  bookConsultationController,
);