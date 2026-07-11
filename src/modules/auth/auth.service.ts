import crypto from 'crypto';
import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { authenticator } from 'otplib';
import { prisma } from '@/lib/prisma';
import { env } from '@/config';
import { Errors } from '@/middleware/errorHandler';
import { SignupInput, LoginInput } from '@/modules/auth/auth.schema';
import { logger } from '@/lib/logger';

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function signAccessToken(userId: string, role: string): string {
  return jwt.sign({ sub: userId, role }, env.JWT_SECRET, { expiresIn: env.JWT_ACCESS_TTL as any });
}

function hashToken(rawToken: string): string {
  // Refresh tokens are high-value, long-lived secrets — hash before storage
  // (sha256 is sufficient here, unlike passwords, since these are already
  // high-entropy random values, not human-chosen and guessable).
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

// ---------------------------------------------------------------------------
// Signup / Login
// ---------------------------------------------------------------------------

export async function signup(input: SignupInput): Promise<{ userId: string }> {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    // Deliberately vague — do not reveal whether an email is registered.
    // Prevents user enumeration (an OWASP-listed risk for auth endpoints).
    throw Errors.conflict('Unable to create account with the provided details');
  }

  // argon2id is the OWASP-recommended variant — resistant to both GPU
  // cracking (unlike bcrypt) and side-channel attacks (unlike argon2i alone).
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

  // Same generic error whether the email doesn't exist OR the password is
  // wrong — again, prevents user enumeration via response differences.
  if (!user) {
    throw Errors.unauthorized('Invalid email or password');
  }

  const passwordValid = await argon2.verify(user.passwordHash, input.password);
  if (!passwordValid) {
    throw Errors.unauthorized('Invalid email or password');
  }

  if (user.mfaEnabled) {
    // Don't issue tokens yet — caller must complete MFA verification first.
    return { userId: user.id, mfaRequired: true };
  }

  const accessToken = signAccessToken(user.id, user.role);
  const refreshToken = await issueRefreshToken(user.id);
  return { accessToken, refreshToken };
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
  const refreshToken = await issueRefreshToken(user.id);
  return { accessToken, refreshToken };
}

// ---------------------------------------------------------------------------
// Refresh token rotation with reuse detection.
//
// Every refresh issues a brand new token and revokes the old one (rotation).
// If a revoked (already-used) token is ever presented again, that's a strong
// signal it was stolen and used by an attacker after the legitimate client
// already rotated past it — so the entire token "family" (every token
// descended from one original login) is revoked, forcing a real re-login on
// all devices tied to that session lineage.
// ---------------------------------------------------------------------------

export async function issueRefreshToken(userId: string, familyId?: string): Promise<string> {
  const rawToken = crypto.randomBytes(40).toString('hex');
  const tokenHash = hashToken(rawToken);
  const resolvedFamilyId = familyId ?? crypto.randomUUID();

  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash,
      familyId: resolvedFamilyId,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    },
  });

  return rawToken;
}

export async function rotateRefreshToken(rawToken: string): Promise<AuthTokens> {
  const tokenHash = hashToken(rawToken);
  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } });

  if (!stored) {
    throw Errors.unauthorized('Invalid refresh token');
  }

  if (stored.revoked) {
    // Reuse of an already-rotated token — treat as a compromise signal and
    // kill the entire family, not just this one token.
    logger.error(
      { userId: stored.userId, familyId: stored.familyId },
      'refresh token reuse detected — revoking entire token family',
    );
    await prisma.refreshToken.updateMany({
      where: { familyId: stored.familyId },
      data: { revoked: true },
    });
    throw Errors.unauthorized('Refresh token has been revoked — please log in again');
  }

  if (stored.expiresAt < new Date()) {
    throw Errors.unauthorized('Refresh token has expired');
  }

  // Mark this token used, then issue a fresh one in the same family.
  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { revoked: true },
  });

  const user = await prisma.user.findUnique({ where: { id: stored.userId } });
  if (!user) {
    throw Errors.unauthorized('User no longer exists');
  }

  const accessToken = signAccessToken(user.id, user.role);
  const newRefreshToken = await issueRefreshToken(user.id, stored.familyId);

  return { accessToken, refreshToken: newRefreshToken };
}

export async function revokeAllUserTokens(userId: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { userId },
    data: { revoked: true },
  });
}
