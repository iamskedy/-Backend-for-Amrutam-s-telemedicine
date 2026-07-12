import { Router } from 'express';
import { requireAuth } from '@/middleware/auth';
import { requireRole } from '@/middleware/rbac';
import { validate } from '@/middleware/validate';
import { createPrescriptionSchema, supersedePrescriptionSchema } from '@/modules/prescriptions/prescription.schema';
import {
  createPrescriptionController,
  supersedePrescriptionController,
  getPrescriptionController,
} from '@/modules/prescriptions/prescription.controller';

export const prescriptionRouter = Router();

prescriptionRouter.get('/:id', requireAuth, getPrescriptionController);
prescriptionRouter.post(
  '/',
  requireAuth,
  requireRole('DOCTOR'),
  validate(createPrescriptionSchema),
  createPrescriptionController,
);
prescriptionRouter.post(
  '/:id/supersede',
  requireAuth,
  requireRole('DOCTOR'),
  validate(supersedePrescriptionSchema),
  supersedePrescriptionController,
);