import { Router } from 'express';
import { requireAuth } from '@/middleware/auth';
import { authLimiter } from '@/middleware/rateLimiter';
import { validate } from '@/middleware/validate';
import { signupSchema, loginSchema, mfaVerifySchema, refreshSchema } from '@/modules/auth/auth.schema';
import {
  signupController,
  loginController,
  mfaEnrollController,
  mfaVerifyEnrollmentController,
  mfaVerifyLoginController,
  refreshController,
  logoutController,
} from '@/modules/auth/auth.controller';

export const authRouter = Router();


authRouter.post('/signup', validate(signupSchema), authLimiter, signupController);
authRouter.post('/login', validate(loginSchema), authLimiter, loginController);


authRouter.post('/mfa/enroll', requireAuth, mfaEnrollController);
authRouter.post('/mfa/verify', requireAuth, validate(mfaVerifySchema), mfaVerifyEnrollmentController);

authRouter.post('/mfa/verify-login', authLimiter, mfaVerifyLoginController);

authRouter.post('/refresh', validate(refreshSchema), refreshController);
authRouter.post('/logout', requireAuth, logoutController);
