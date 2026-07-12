import { z } from 'zod';

export const bookConsultationSchema = z.object({
  slotId: z.string().uuid(),
  amount: z.number().positive(),
});

export type BookConsultationInput = z.infer<typeof bookConsultationSchema>;