import { z } from 'zod';

export const createPrescriptionSchema = z.object({
  consultationId: z.string().uuid(),
  content: z.object({
    medicines: z.array(
      z.object({
        name: z.string().min(1),
        dosage: z.string().min(1),
        frequency: z.string().min(1),
        durationDays: z.number().int().positive(),
      }),
    ),
    notes: z.string().optional(),
  }),
});

export const supersedePrescriptionSchema = z.object({
  content: createPrescriptionSchema.shape.content,
});
export type CreatePrescriptionInput = z.infer<typeof createPrescriptionSchema>;
export type SupersedePrescriptionInput = z.infer<typeof supersedePrescriptionSchema>;