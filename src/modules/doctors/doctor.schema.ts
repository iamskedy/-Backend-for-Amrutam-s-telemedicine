import { z } from 'zod';

export const updateDoctorProfileSchema = z.object({
  specialty: z.string().min(1, 'Specialty is required'),
  licenseNo: z.string().min(1, 'License number is required'),
  bio: z.string().max(2000).optional(),
});

export type UpdateDoctorProfileInput = z.infer<typeof updateDoctorProfileSchema>;
