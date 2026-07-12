import { Request, Response } from 'express';
import { asyncHandler } from '@/lib/asyncHandler';
import { createSlot, listSlotsForDoctor, cancelSlot } from '@/modules/availability/availability.service';
import { createSlotSchema } from '@/modules/availability/availability.schema';

export const createSlotController = asyncHandler(async (req: Request, res: Response) => {
  const input = createSlotSchema.parse(req.body);
  const slot = await createSlot(req.user!.sub, input);
  res.status(201).json(slot);
});

export const listSlotsController = asyncHandler(async (req: Request, res: Response) => {
  const doctorId = req.params.doctorId as string;
  const fromDate = req.query.from ? new Date(req.query.from as string) : undefined;
  const slots = await listSlotsForDoctor(doctorId, fromDate);
  res.status(200).json(slots);
});

export const cancelSlotController = asyncHandler(async (req: Request, res: Response) => {
  const slot = await cancelSlot(req.user!.sub, req.params.slotId as string);
  res.status(200).json(slot);
});