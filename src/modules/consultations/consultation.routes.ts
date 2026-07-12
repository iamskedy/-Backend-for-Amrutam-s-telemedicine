import { Router } from 'express';
import { requireAuth } from '@/middleware/auth';
import { validate } from '@/middleware/validate';
import { transitionSchema } from '@/modules/consultations/consultation.schema';
import {
  getConsultationController,
  transitionConsultationController,
} from '@/modules/consultations/consultation.controller';

export const consultationRouter = Router();

consultationRouter.get('/:id', requireAuth, getConsultationController);
consultationRouter.patch(
  '/:id/status',
  requireAuth,
  validate(transitionSchema),
  transitionConsultationController,
);