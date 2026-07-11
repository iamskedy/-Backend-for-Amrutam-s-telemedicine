import { prisma } from '@/lib/prisma';
import { Errors } from '@/middleware/errorHandler';
import { UpdateDoctorProfileInput } from '@/modules/doctors/doctor.schema';

export async function getDoctorProfile(userId: string) {
  const doctor = await prisma.doctor.findUnique({ where: { userId } });
  if (!doctor) {
    throw Errors.notFound('Doctor profile not found');
  }
  return doctor;
}

export async function updateDoctorProfile(userId: string, input: UpdateDoctorProfileInput) {
  const doctor = await prisma.doctor.findUnique({ where: { userId } });
  if (!doctor) {
    throw Errors.notFound('Doctor profile not found');
  }

  // Prevent claiming a license number already in use by a different doctor.
  const licenseConflict = await prisma.doctor.findUnique({ where: { licenseNo: input.licenseNo } });
  if (licenseConflict && licenseConflict.id !== doctor.id) {
    throw Errors.conflict('This license number is already registered to another account');
  }

  return prisma.doctor.update({
    where: { userId },
    data: {
      specialty: input.specialty,
      licenseNo: input.licenseNo,
      bio: input.bio,
    },
  });
}

export async function getDoctorById(doctorId: string) {
  const doctor = await prisma.doctor.findUnique({ where: { id: doctorId } });
  if (!doctor) {
    throw Errors.notFound('Doctor not found');
  }
  return doctor;
}

export async function listDoctors() {
  // Only surface verified doctors publicly — an unverified doctor (e.g.
  // fresh signup, license not yet confirmed) shouldn't be bookable.
  return prisma.doctor.findMany({
    where: { verifiedAt: { not: null } },
    orderBy: { rating: 'desc' },
  });
}

export async function verifyDoctor(doctorId: string) {
  const doctor = await prisma.doctor.findUnique({ where: { id: doctorId } });
  if (!doctor) {
    throw Errors.notFound('Doctor not found');
  }
  return prisma.doctor.update({
    where: { id: doctorId },
    data: { verifiedAt: new Date() },
  });
}
