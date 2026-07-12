import { prisma } from '@/lib/prisma';
import { Errors } from '@/middleware/errorHandler';
import { writeAuditLog } from '@/modules/audit/audit.service';

type ConsultationStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';

// Explicit legal transitions — anything not listed here is rejected.
const ALLOWED_TRANSITIONS: Record<ConsultationStatus, ConsultationStatus[]> = {
  SCHEDULED: ['IN_PROGRESS', 'CANCELLED', 'NO_SHOW'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
};

export async function transitionConsultation(
  consultationId: string,
  actorId: string,
  newStatus: ConsultationStatus,
) {
  const consultation = await prisma.consultation.findUnique({ where: { id: consultationId } });
  if (!consultation) {
    throw Errors.notFound('Consultation not found');
  }

  const allowed = ALLOWED_TRANSITIONS[consultation.status as ConsultationStatus];
  if (!allowed.includes(newStatus)) {
    throw Errors.conflict(
      `Cannot transition consultation from ${consultation.status} to ${newStatus}`,
    );
  }

  const updated = await prisma.consultation.update({
    where: { id: consultationId },
    data: {
      status: newStatus,
      ...(newStatus === 'IN_PROGRESS' ? { startedAt: new Date() } : {}),
      ...(newStatus === 'COMPLETED' || newStatus === 'CANCELLED' ? { endedAt: new Date() } : {}),
    },
  });

  await writeAuditLog({
    actorId,
    action: 'consultation.status_changed',
    entityType: 'Consultation',
    entityId: consultationId,
    before: { status: consultation.status },
    after: { status: newStatus },
  });

  return updated;
}

export async function getConsultation(consultationId: string) {
  const consultation = await prisma.consultation.findUnique({ where: { id: consultationId } });
  if (!consultation) {
    throw Errors.notFound('Consultation not found');
  }
  return consultation;
}