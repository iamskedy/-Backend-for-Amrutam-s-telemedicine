import { Request, Response } from 'express';
import { asyncHandler } from '@/lib/asyncHandler';
import { bookConsultation } from '@/modules/booking/booking.service';

export const bookConsultationController = asyncHandler(async (req: Request, res: Response) => {
  const idempotencyKey = req.header('idempotency-key')!; // guaranteed by requireIdempotencyKey middleware
  const consultation = await bookConsultation(req.user!.sub, {
    ...req.body,
    idempotencyKey,
  });
  res.status(201).json(consultation);
});