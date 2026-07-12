import { prisma } from '@/lib/prisma';
import { Errors } from '@/middleware/errorHandler';
import { writeAuditLog } from '@/modules/audit/audit.service';
import { prescriptionPdfQueue } from '@/lib/queue';
import { CreatePrescriptionInput } from '@/modules/prescriptions/prescription.schema';

type PrescriptionContent = CreatePrescriptionInput['content'];

export async function createPrescription(
  doctorUserId: string,
  consultationId: string,
  content: PrescriptionContent,
) {
  const doctor = await prisma.doctor.findUnique({ where: { userId: doctorUserId } });
  if (!doctor) {
    throw Errors.notFound('Doctor profile not found');
  }

  const consultation = await prisma.consultation.findUnique({ where: { id: consultationId } });
  if (!consultation) {
    throw Errors.notFound('Consultation not found');
  }
  if (consultation.doctorId !== doctor.id) {
    throw Errors.forbidden('You are not the doctor for this consultation');
  }
  if (consultation.status !== 'COMPLETED') {
    throw Errors.conflict('Prescriptions can only be issued for completed consultations');
  }

  const prescription = await prisma.prescription.create({
    data: {
      consultationId,
      doctorId: doctor.id,
      patientId: consultation.patientId,
      content,                        
      status: 'ACTIVE',
    },
  });

  await writeAuditLog({
    actorId: doctorUserId,
    action: 'prescription.created',
    entityType: 'Prescription',
    entityId: prescription.id,
    after: { consultationId },
  });

  await prescriptionPdfQueue.add('generate-pdf', { prescriptionId: prescription.id });

  return prescription;
}

/**
 * Corrections are modeled as a NEW row linking back via supersedesId, with
 * the old row flipped to SUPERSEDED. The original prescription is never
 * mutated — preserves a defensible audit trail for a regulated health
 * record.
 */
export async function supersedePrescription(
  doctorUserId: string,
  oldPrescriptionId: string,
  newContent: PrescriptionContent,  
)  {
  const doctor = await prisma.doctor.findUnique({ where: { userId: doctorUserId } });
  if (!doctor) {
    throw Errors.notFound('Doctor profile not found');
  }

  const old = await prisma.prescription.findUnique({ where: { id: oldPrescriptionId } });
  if (!old || old.doctorId !== doctor.id) {
    throw Errors.notFound('Prescription not found');
  }
  if (old.status !== 'ACTIVE') {
    throw Errors.conflict('Only an ACTIVE prescription can be superseded');
  }

  const [, newPrescription] = await prisma.$transaction([
    prisma.prescription.update({ where: { id: old.id }, data: { status: 'SUPERSEDED' } }),
    prisma.prescription.create({
      data: {
        consultationId: old.consultationId,
        doctorId: old.doctorId,
        patientId: old.patientId,
        content: newContent, 
        status: 'ACTIVE',
        supersedesId: old.id,
      },
    }),
  ]);

  await writeAuditLog({
    actorId: doctorUserId,
    action: 'prescription.superseded',
    entityType: 'Prescription',
    entityId: newPrescription.id,
    before: { supersedes: old.id },
    after: { newPrescriptionId: newPrescription.id },
  });

  await prescriptionPdfQueue.add('generate-pdf', { prescriptionId: newPrescription.id });

  return newPrescription;
}

export async function getPrescription(prescriptionId: string) {
  const prescription = await prisma.prescription.findUnique({ where: { id: prescriptionId } });
  if (!prescription) {
    throw Errors.notFound('Prescription not found');
  }
  return prescription;
}