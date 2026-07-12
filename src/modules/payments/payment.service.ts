import { prisma } from '@/lib/prisma';
import { Errors } from '@/middleware/errorHandler';
import { logger } from '@/lib/logger';

interface AuthorizeAndCaptureInput {
  consultationId: string;
  amount: number;
  currency?: string;
  idempotencyKey: string;
  // Test-only escape hatch to deterministically exercise the saga's
  // compensation path — never read in a real payment decision otherwise.
  simulateFailure?: boolean;
}

export async function authorizeAndCapture(input: AuthorizeAndCaptureInput) {
  // Idempotency at the payment layer too — if this exact payment attempt
  // was already processed, return the existing record instead of charging
  // again. This matters independently of the booking-level idempotency key,
  // since the payment step can in principle be retried on its own.
  const existing = await prisma.payment.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
  if (existing) {
    logger.info({ paymentId: existing.id }, 'payment idempotency replay');
    return existing;
  }

  const payment = await prisma.payment.create({
    data: {
      consultationId: input.consultationId,
      amount: input.amount,
      currency: input.currency ?? 'INR',
      status: 'PENDING',
      idempotencyKey: input.idempotencyKey,
    },
  });

  // --- mock gateway call ---
  // A real integration would call out to Stripe/Razorpay here and branch on
  // their response. simulateFailure exists purely so tests can force the
  // failure branch deterministically instead of relying on randomness.
  const gatewaySucceeded = !input.simulateFailure;

  if (!gatewaySucceeded) {
    const failed = await prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'FAILED' },
    });
    throw Errors.badRequest('Payment failed', { paymentId: failed.id });
  }

  return prisma.payment.update({
    where: { id: payment.id },
    data: { status: 'CAPTURED', providerRef: `mock_${payment.id}` },
  });
}

export async function refundPayment(consultationId: string) {
  const payment = await prisma.payment.findUnique({ where: { consultationId } });
  if (!payment) {
    throw Errors.notFound('No payment found for this consultation');
  }
  if (payment.status !== 'CAPTURED') {
    throw Errors.conflict(`Cannot refund a payment with status ${payment.status}`);
  }
  return prisma.payment.update({
    where: { id: payment.id },
    data: { status: 'REFUNDED' },
  });
}