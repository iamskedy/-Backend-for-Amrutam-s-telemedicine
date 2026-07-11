import { Router } from 'express';
import { requireAuth } from '@/middleware/auth';
import { requireRole } from '@/middleware/rbac';
import { validate } from '@/middleware/validate';
import { updateDoctorProfileSchema } from '@/modules/doctors/doctor.schema';
import {
  getOwnProfileController,
  updateOwnProfileController,
  getDoctorByIdController,
  listDoctorsController,
  verifyDoctorController,
} from '@/modules/doctors/doctor.controller';

export const doctorRouter = Router();

// Public — anyone can browse verified doctors, no auth required.
doctorRouter.get('/', listDoctorsController);

// Doctor-only — manage own profile. These literal paths MUST be registered
// before the wildcard GET /:id below, or Express will match "me" as if it
// were a doctor ID and this handler will never be reached.
doctorRouter.get('/me/profile', requireAuth, requireRole('DOCTOR'), getOwnProfileController);
doctorRouter.put(
  '/me/profile',
  requireAuth,
  requireRole('DOCTOR'),
  validate(updateDoctorProfileSchema),
  updateOwnProfileController,
);

// Public wildcard lookup — registered AFTER /me/profile on purpose.
doctorRouter.get('/:id', getDoctorByIdController);

// Admin-only — verify a doctor's credentials.
doctorRouter.post('/:id/verify', requireAuth, requireRole('ADMIN'), verifyDoctorController);
