import { z } from 'zod';

export const createSlotSchema = z
  .object({
    startTime: z.string().datetime(),
    endTime: z.string().datetime(),
  })
  .refine((data) => new Date(data.startTime) < new Date(data.endTime), {
    message: 'startTime must be before endTime',
    path: ['endTime'],
  })
  .refine((data) => new Date(data.startTime) > new Date(), {
    message: 'startTime must be in the future',
    path: ['startTime'],
  });

export type CreateSlotInput = z.infer<typeof createSlotSchema>;
