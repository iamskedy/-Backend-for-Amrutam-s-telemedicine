import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { authenticator } from 'otplib';
import { prisma } from '@/lib/prisma';
import { env } from '@/config';
import { Errors } from '@/middleware/errorHandler';
import { SignupInput, LoginInput } from '@/modules/auth/auth.schema';

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

function signAccessToken(userId: string, role: string): string {
  return jwt.sign({ sub: userId, role }, env.JWT_SECRET, { expiresIn: env.JWT_ACCESS_TTL as any });
}

export async function signup(input: SignupInput): Promise<{ userId: string }> {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {

    throw Errors.conflict('Unable to create account with the provided details');
  }

 
  const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });

  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      role: input.role,
      profile: { create: { name: input.fullName } },
      ...(input.role === 'DOCTOR'
        ? { doctor: { create: { specialty: 'UNSPECIFIED', licenseNo: `PENDING-${Date.now()}` } } }
        : {}),
    },
  });

  return { userId: user.id };
}

export async function login(
  input: LoginInput,
): Promise<{ userId: string; mfaRequired: boolean } | AuthTokens> {
  const user = await prisma.user.findUnique({ where: { email: input.email } });

 
  if (!user) {
    throw Errors.unauthorized('Invalid email or password');
  }

  const passwordValid = await argon2.verify(user.passwordHash, input.password);
  if (!passwordValid) {
    throw Errors.unauthorized('Invalid email or password');
  }

  if (user.mfaEnabled) {
    
    return { userId: user.id, mfaRequired: true };
  }

  const accessToken = signAccessToken(user.id, user.role);
  
  return { accessToken, refreshToken: '' };
}


export async function enrollMfa(userId: string): Promise<{ otpauthUrl: string }> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw Errors.notFound('User not found');
  }

  const secret = authenticator.generateSecret();


  await prisma.user.update({
    where: { id: userId },
    data: { mfaSecret: secret },
  });

  const otpauthUrl = authenticator.keyuri(user.email, 'Amrutam', secret);
  return { otpauthUrl };
}

export async function verifyMfaEnrollment(userId: string, code: string): Promise<{ success: boolean }> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.mfaSecret) {
    throw Errors.badRequest('No pending MFA enrollment found — call enrollMfa first');
  }

  const valid = authenticator.verify({ token: code, secret: user.mfaSecret });
  if (!valid) {
    throw Errors.badRequest('Invalid MFA code');
  }

  await prisma.user.update({
    where: { id: userId },
    data: { mfaEnabled: true },
  });

  return { success: true };
}

export async function verifyMfaLogin(userId: string, code: string): Promise<AuthTokens> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.mfaEnabled || !user.mfaSecret) {
    throw Errors.badRequest('MFA is not enabled for this account');
  }

  const valid = authenticator.verify({ token: code, secret: user.mfaSecret });
  if (!valid) {
    throw Errors.unauthorized('Invalid MFA code');
  }

  const accessToken = signAccessToken(user.id, user.role);
 
  return { accessToken, refreshToken: '' };
}
