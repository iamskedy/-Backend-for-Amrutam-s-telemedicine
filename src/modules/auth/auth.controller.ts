import { Request, Response } from 'express';
import { asyncHandler } from '@/lib/asyncHandler';
import { SignupInput, LoginInput, MfaVerifyInput, RefreshInput } from '@/modules/auth/auth.schema';
import {
  signup,
  login,
  enrollMfa,
  verifyMfaEnrollment,
  verifyMfaLogin,
  rotateRefreshToken,
  revokeAllUserTokens,
} from '@/modules/auth/auth.service';

export const signupController = asyncHandler(
  async (req: Request<unknown, unknown, SignupInput>, res: Response) => {
    const result = await signup(req.body);
    res.status(201).json(result);
  },
);

export const loginController = asyncHandler(
  async (req: Request<unknown, unknown, LoginInput>, res: Response) => {
    const result = await login(req.body);

    if ('mfaRequired' in result) {
      res.status(200).json({ mfaRequired: true, userId: result.userId });
      return;
    }

    res.status(200).json(result);
  },
);

export const mfaEnrollController = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.sub;
  const result = await enrollMfa(userId);
  res.status(200).json(result);
});

export const mfaVerifyEnrollmentController = asyncHandler(
  async (req: Request<unknown, unknown, MfaVerifyInput>, res: Response) => {
    const userId = req.user!.sub;
    const { code } = req.body;
    const result = await verifyMfaEnrollment(userId, code);
    res.status(200).json(result);
  },
);

interface MfaVerifyLoginBody {
  userId: string;
  code: string;
}

export const mfaVerifyLoginController = asyncHandler(
  async (req: Request<unknown, unknown, MfaVerifyLoginBody>, res: Response) => {
    const { userId, code } = req.body;
    const result = await verifyMfaLogin(userId, code);
    res.status(200).json(result);
  },
);

export const refreshController = asyncHandler(
  async (req: Request<unknown, unknown, RefreshInput>, res: Response) => {
    const { refreshToken } = req.body;
    const result = await rotateRefreshToken(refreshToken);
    res.status(200).json(result);
  },
);

export const logoutController = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.sub;
  await revokeAllUserTokens(userId);
  res.status(204).send();
});