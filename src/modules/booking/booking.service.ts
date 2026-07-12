import { prisma } from '@/lib/prisma';
import { Errors } from '@/middleware/errorHandler';
import { logger } from '@/lib/logger';
import { authorizeAndCapture } from '@/modules/payments/payment.service';
import { writeAuditLog } from '@/modules/audit/audit.service';
import { bookingSagaOutcome } from '@/lib/metrics';
import { notificationQueue } from '@/lib/queue';

interface BookConsultationInput {
  slotId: string;
  amount: number;
  idempotencyKey: string;
  simulatePaymentFailure?: boolean; // test-only hook, see payment.service.ts
}

/**
 * Booking saga:
 *   1. HOLD + CREATE — in one DB transaction: optimistic-lock the slot
 *               (OPEN -> HELD) and create the Consultation row. Doing both
 *               together means a real, committed consultation.id exists
 *               before we ever try to charge for it — payments have a
 *               required FK to consultations, so the id must be real.
 *   2. PAY    — charge via the mock payment provider using the real
 *               consultation.id. On failure, compensate by deleting the
 *               consultation and reopening the slot.
 *   3. CONFIRM — slot HELD -> BOOKED. Payment is already CAPTURED by this
 *               point (payment.service.ts already committed it).
 *
 * Idempotency: checked FIRST, before any of the above — a retry with the
 * same idempotencyKey short-circuits to the existing consultation and never
 * re-enters the saga at all. This is a second, DB-level idempotency layer
 * on top of the Redis-based middleware (which is fire-and-forget and has a
 * small race window, documented in idempotency.ts) — this one is
 * authoritative because it's checked against real committed rows.
 */
export async function bookConsultation(patientId: string, input: BookConsultationInput) {
  const existing = await prisma.consultation.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
  });
  if (existing) {
    logger.info({ consultationId: existing.id }, 'booking idempotency replay');
    return existing;
  }

  const slot = await prisma.availabilitySlot.findUnique({ where: { id: input.slotId } });
  if (!slot) {
    throw Errors.notFound('Slot not found');
  }
  if (slot.status !== 'OPEN') {
    bookingSagaOutcome.inc({ outcome: 'slot_conflict' });
    throw Errors.conflict('Slot is no longer available');
  }

  // --- STEP 1: HOLD slot + create Consultation together, atomically ---
  const consultation = await prisma.$transaction(async (tx) => {
    const held = await tx.availabilitySlot.updateMany({
      where: { id: slot.id, status: 'OPEN', version: slot.version },
      data: { status: 'HELD', version: { increment: 1 } },
    });

    if (held.count === 0) {
      // Someone else's request won the race between our read and our write.
      bookingSagaOutcome.inc({ outcome: 'slot_conflict' });
      throw Errors.conflict('Slot was just booked by someone else — please pick another slot');
    }

    return tx.consultation.create({
      data: {
        patientId,
        doctorId: slot.doctorId,
        slotId: slot.id,
        status: 'SCHEDULED',
        scheduledAt: slot.startTime,
        idempotencyKey: input.idempotencyKey,
      },
    });
  });

  // --- STEP 2: PAY, now with a real, committed consultationId ---
  let payment;
  try {
    payment = await authorizeAndCapture({
      consultationId: consultation.id,
      amount: input.amount,
      idempotencyKey: `${input.idempotencyKey}:payment`,
      simulateFailure: input.simulatePaymentFailure,
    });
  } catch (err) {
    // COMPENSATION: undo both the hold and the consultation row.
    await prisma.$transaction([
      prisma.consultation.delete({ where: { id: consultation.id } }),
      prisma.availabilitySlot.update({
        where: { id: slot.id },
        data: { status: 'OPEN', version: { increment: 1 } },
      }),
    ]);
    bookingSagaOutcome.inc({ outcome: 'payment_failed' });
    logger.warn({ slotId: slot.id, err }, 'payment failed — hold and consultation rolled back');
    throw err;
  }

  // --- STEP 3: CONFIRM (slot HELD -> BOOKED; payment already CAPTURED) ---
  try {
    await prisma.availabilitySlot.update({
      where: { id: slot.id },
      data: { status: 'BOOKED' },
    });

    bookingSagaOutcome.inc({ outcome: 'committed' });

    await writeAuditLog({
      actorId: patientId,
      action: 'booking.created',
      entityType: 'Consultation',
      entityId: consultation.id,
      after: { status: consultation.status, slotId: slot.id },
    });

    // Off the critical path — don't make the booking response wait on
    // notification delivery.
    await notificationQueue.add('booking-confirmed', {
      consultationId: consultation.id,
      patientId,
      doctorId: slot.doctorId,
    });

    return consultation;
  } catch (err) {
    // If this final step somehow fails after payment already succeeded,
    // we have a genuine inconsistency (payment captured, slot still shows
    // HELD). Rather than attempt an automatic refund here (compounding
    // failure modes in a catch block), log it loudly for manual/automated
    // reconciliation — this tradeoff is documented in architecture.md.
    bookingSagaOutcome.inc({ outcome: 'rolled_back' });
    logger.error(
      { slotId: slot.id, paymentId: payment.id, consultationId: consultation.id, err },
      'CRITICAL: payment captured but slot confirmation failed — needs reconciliation',
    );
    throw Errors.internal('Booking could not be completed — please contact support');
  }
}