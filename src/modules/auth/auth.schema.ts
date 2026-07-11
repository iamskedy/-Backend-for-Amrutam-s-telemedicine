import { z } from 'zod';


export const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(12, 'Password must be at least 12 characters'),

  role: z.enum(['PATIENT', 'DOCTOR']),
  fullName: z.string().min(1, 'Full name is required'),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, 'Password is required'),
});

export const mfaVerifySchema = z.object({
  code: z
    .string()
    .length(6, 'MFA code must be exactly 6 digits')
    .regex(/^\d{6}$/, 'MFA code must be numeric'),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type MfaVerifyInput = z.infer<typeof mfaVerifySchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;