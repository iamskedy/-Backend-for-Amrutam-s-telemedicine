import { z } from 'zod';

export const searchDoctorsSchema = z.object({
  specialty: z.string().optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  availableAfter: z.string().datetime().optional(),
});