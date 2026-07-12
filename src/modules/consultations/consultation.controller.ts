import { Request, Response } from 'express';
import { asyncHandler } from '@/lib/asyncHandler';
import { transitionConsultation, getConsultation } from '@/modules/consultations/consultation.service';

export const getConsultationController = asyncHandler(async (req: Request, res: Response) => {
  const consultation = await getConsultation(req.params.id as string);
  res.status(200).json(consultation);
});

export const transitionConsultationController = asyncHandler(async (req: Request, res: Response) => {
  const consultation = await transitionConsultation(
    req.params.id as string,
    req.user!.sub,
    req.body.status,
  );
  res.status(200).json(consultation);
});