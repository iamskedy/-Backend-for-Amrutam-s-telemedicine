import { Request, Response } from 'express';
import { asyncHandler } from '@/lib/asyncHandler';
import {
  createPrescription,
  supersedePrescription,
  getPrescription,
} from '@/modules/prescriptions/prescription.service';
import {
  createPrescriptionSchema,
  supersedePrescriptionSchema,
} from '@/modules/prescriptions/prescription.schema';

export const createPrescriptionController = asyncHandler(async (req: Request, res: Response) => {
  const { consultationId, content } = createPrescriptionSchema.parse(req.body);
  const prescription = await createPrescription(req.user!.sub, consultationId, content);
  res.status(201).json(prescription);
});

export const supersedePrescriptionController = asyncHandler(async (req: Request, res: Response) => {
  const { content } = supersedePrescriptionSchema.parse(req.body);
  const prescription = await supersedePrescription(req.user!.sub, req.params.id as string, content);
  res.status(201).json(prescription);
});

export const getPrescriptionController = asyncHandler(async (req: Request, res: Response) => {
  const prescription = await getPrescription(req.params.id as string);
  res.status(200).json(prescription);
});