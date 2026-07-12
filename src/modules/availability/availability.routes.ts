import { Router } from 'express';
import { requireAuth } from '@/middleware/auth';
import { requireRole } from '@/middleware/rbac';
import { validate } from '@/middleware/validate';
import { createSlotSchema } from '@/modules/availability/availability.schema';
import {
  createSlotController,
  listSlotsController,
  cancelSlotController,
} from '@/modules/availability/availability.controller';

export const availabilityRouter = Router();

// Doctor-only — create a new availability slot for themselves.
availabilityRouter.post(
  '/',
  requireAuth,
  requireRole('DOCTOR'),
  validate(createSlotSchema),
  createSlotController,
);

// Public — list a specific doctor's open slots (used by search/booking).
availabilityRouter.get('/doctor/:doctorId', listSlotsController);

// Doctor-only — cancel their own OPEN slot.
availabilityRouter.delete('/:slotId', requireAuth, requireRole('DOCTOR'), cancelSlotController);