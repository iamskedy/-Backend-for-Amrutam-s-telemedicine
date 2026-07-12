import { Request, Response } from 'express';
import { asyncHandler } from '@/lib/asyncHandler';
import { bookConsultation } from '@/modules/booking/booking.service';
import { bookConsultationSchema } from '@/modules/booking/booking.schema';

export const bookConsultationController = asyncHandler(async (req: Request, res: Response) => {
  const idempotencyKey = req.header('idempotency-key')!; // guaranteed by requireIdempotencyKey middleware
  const input = bookConsultationSchema.parse(req.body);
  const consultation = await bookConsultation(req.user!.sub, {
    ...input,
    idempotencyKey,
  });
  res.status(201).json(consultation);
});