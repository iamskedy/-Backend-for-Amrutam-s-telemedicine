import { prisma } from '@/lib/prisma';
import { Errors } from '@/middleware/errorHandler';
import { CreateSlotInput } from '@/modules/availability/availability.schema';

export async function createSlot(doctorUserId: string, input: CreateSlotInput) {
  const doctor = await prisma.doctor.findUnique({ where: { userId: doctorUserId } });
  if (!doctor) {
    throw Errors.notFound('Doctor profile not found');
  }

  return prisma.availabilitySlot.create({
    data: {
      doctorId: doctor.id,
      startTime: new Date(input.startTime),
      endTime: new Date(input.endTime),
      status: 'OPEN',
    },
  });
}

export async function listSlotsForDoctor(doctorId: string, fromDate?: Date) {
  return prisma.availabilitySlot.findMany({
    where: {
      doctorId,
      status: 'OPEN',
      startTime: { gte: fromDate ?? new Date() },
    },
    orderBy: { startTime: 'asc' },
  });
}

export async function cancelSlot(doctorUserId: string, slotId: string) {
  const doctor = await prisma.doctor.findUnique({ where: { userId: doctorUserId } });
  if (!doctor) {
    throw Errors.notFound('Doctor profile not found');
  }

  const slot = await prisma.availabilitySlot.findUnique({ where: { id: slotId } });
  if (!slot || slot.doctorId !== doctor.id) {
    throw Errors.notFound('Slot not found');
  }

  
  if (slot.status !== 'OPEN') {
    throw Errors.conflict(
      `Cannot cancel a slot with status ${slot.status} — only OPEN slots can be cancelled directly`,
    );
  }

  return prisma.availabilitySlot.update({
    where: { id: slotId },
    data: { status: 'CANCELLED' },
  });
}
