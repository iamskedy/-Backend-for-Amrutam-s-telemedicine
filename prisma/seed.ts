import { PrismaClient, Role, SlotStatus, ConsultationStatus, PaymentStatus, PrescriptionStatus } from '@prisma/client';
import { faker } from '@faker-js/faker';
import bcrypt from 'bcryptjs';
// ^ If your auth service uses a different hashing lib (bcrypt, argon2, etc.),
// swap this import to match — otherwise seeded users won't be able to log in
// through your real login endpoint.

const prisma = new PrismaClient();

// Known password for ALL seeded users — for local/manual testing only.
// Never use this seed script against a staging or production database.
const SEED_PASSWORD = 'Password123!';

const SPECIALTIES = [
  'General Medicine',
  'Cardiology',
  'Dermatology',
  'Pediatrics',
  'Orthopedics',
  'Psychiatry',
  'Ayurveda',
  'Gynecology',
];

async function main() {
  console.log('Seeding database...');

  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);

  // ---------- Clean slate (dev only) ----------
  // Order matters — delete children before parents to respect FKs.
  await prisma.auditLog.deleteMany();
  await prisma.prescription.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.consultation.deleteMany();
  await prisma.availabilitySlot.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.doctor.deleteMany();
  await prisma.profile.deleteMany();
  await prisma.user.deleteMany();

  // ---------- Admin ----------
  const admin = await prisma.user.create({
    data: {
      email: 'admin@amrutam.test',
      passwordHash,
      role: Role.ADMIN,
      profile: { create: { name: 'Admin User', phone: faker.phone.number() } },
    },
  });

  // ---------- Doctors (15) ----------
  const doctors = [];
  for (let i = 0; i < 15; i++) {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const user = await prisma.user.create({
      data: {
        email: `doctor${i + 1}@amrutam.test`,
        passwordHash,
        role: Role.DOCTOR,
        profile: {
          create: {
            name: `Dr. ${firstName} ${lastName}`,
            phone: faker.phone.number(),
            address: faker.location.streetAddress(),
          },
        },
        doctor: {
          create: {
            specialty: faker.helpers.arrayElement(SPECIALTIES),
            licenseNo: `LIC-${faker.string.alphanumeric(8).toUpperCase()}`,
            bio: faker.lorem.sentences(2),
            rating: Number(faker.number.float({ min: 3.5, max: 5, fractionDigits: 1 })),
            verifiedAt: faker.date.past({ years: 2 }),
          },
        },
      },
      include: { doctor: true },
    });
    doctors.push(user.doctor!);
  }

  // ---------- Patients (20) ----------
  const patients = [];
  for (let i = 0; i < 20; i++) {
    const user = await prisma.user.create({
      data: {
        email: `patient${i + 1}@amrutam.test`,
        passwordHash,
        role: Role.PATIENT,
        profile: {
          create: {
            name: faker.person.fullName(),
            phone: faker.phone.number(),
            dob: faker.date.birthdate({ min: 18, max: 75, mode: 'age' }),
            address: faker.location.streetAddress(),
          },
        },
      },
    });
    patients.push(user);
  }

  // ---------- Availability slots ----------
  // Each doctor gets a mix: several OPEN slots in the future, a couple
  // already BOOKED (feeding real consultations below), one HELD (mid-saga),
  // one CANCELLED — enough variety to exercise each SlotStatus.
  const bookedSlotsByDoctor: Record<string, { slot: any; doctor: any }[]> = {};

  for (const doctor of doctors) {
    bookedSlotsByDoctor[doctor.id] = [];
    const baseDay = faker.date.soon({ days: 3 });

    for (let day = 0; day < 5; day++) {
      const dayStart = new Date(baseDay);
      dayStart.setDate(dayStart.getDate() + day);

      for (let slotIdx = 0; slotIdx < 3; slotIdx++) {
        const startTime = new Date(dayStart);
        startTime.setHours(9 + slotIdx * 2, 0, 0, 0);
        const endTime = new Date(startTime);
        endTime.setMinutes(endTime.getMinutes() + 30);

        // Distribution: ~50% OPEN, ~35% BOOKED, ~10% CANCELLED, ~5% HELD
        const roll = faker.number.int({ min: 1, max: 100 });
        const status: SlotStatus =
          roll <= 50 ? SlotStatus.OPEN
          : roll <= 85 ? SlotStatus.BOOKED
          : roll <= 95 ? SlotStatus.CANCELLED
          : SlotStatus.HELD;

        const slot = await prisma.availabilitySlot.create({
          data: { doctorId: doctor.id, startTime, endTime, status },
        });

        if (status === SlotStatus.BOOKED) {
          bookedSlotsByDoctor[doctor.id].push({ slot, doctor });
        }
      }
    }
  }

  // ---------- Consultations + Payments (+ Prescriptions) ----------
  // One consultation per BOOKED slot, patient assigned round-robin.
  // Status distribution: mix of SCHEDULED / IN_PROGRESS / COMPLETED /
  // CANCELLED / NO_SHOW so the dataset exercises every enum value.
  const allBookedSlots = Object.values(bookedSlotsByDoctor).flat();
  let patientCursor = 0;

  const CONSULTATION_STATUSES: ConsultationStatus[] = [
    ConsultationStatus.SCHEDULED,
    ConsultationStatus.IN_PROGRESS,
    ConsultationStatus.COMPLETED,
    ConsultationStatus.CANCELLED,
    ConsultationStatus.NO_SHOW,
  ];

  for (let i = 0; i < allBookedSlots.length; i++) {
    const { slot, doctor } = allBookedSlots[i];
    const patient = patients[patientCursor % patients.length];
    patientCursor++;

    const status = CONSULTATION_STATUSES[i % CONSULTATION_STATUSES.length];

    const consultation = await prisma.consultation.create({
      data: {
        patientId: patient.id,
        doctorId: doctor.id,
        slotId: slot.id,
        status,
        scheduledAt: slot.startTime,
        startedAt: status === ConsultationStatus.IN_PROGRESS || status === ConsultationStatus.COMPLETED
          ? slot.startTime
          : null,
        endedAt: status === ConsultationStatus.COMPLETED ? slot.endTime : null,
        idempotencyKey: `seed-${faker.string.uuid()}`,
      },
    });

    // Payment mirrors consultation outcome
    const paymentStatus: PaymentStatus =
      status === ConsultationStatus.CANCELLED ? PaymentStatus.REFUNDED
      : status === ConsultationStatus.NO_SHOW ? PaymentStatus.CAPTURED
      : PaymentStatus.CAPTURED;

    await prisma.payment.create({
      data: {
        consultationId: consultation.id,
        amount: faker.number.int({ min: 300, max: 1500 }),
        currency: 'INR',
        status: paymentStatus,
        providerRef: `mock_${faker.string.alphanumeric(12)}`,
        idempotencyKey: `seed-${faker.string.uuid()}:payment`,
      },
    });

    // Prescription for completed consultations only
    if (status === ConsultationStatus.COMPLETED) {
      await prisma.prescription.create({
        data: {
          consultationId: consultation.id,
          doctorId: doctor.id,
          patientId: patient.id,
          content: {
            diagnosis: faker.lorem.sentence(),
            medications: [
              {
                name: faker.helpers.arrayElement(['Paracetamol', 'Ashwagandha', 'Triphala', 'Amoxicillin']),
                dosage: faker.helpers.arrayElement(['1 tablet twice daily', '5ml once daily', '1 capsule at night']),
                durationDays: faker.number.int({ min: 3, max: 14 }),
              },
            ],
            notes: faker.lorem.sentences(2),
          },
          status: PrescriptionStatus.ACTIVE,
        },
      });
    }
  }

  console.log('Seed complete:');
  console.log(`  1 admin, ${doctors.length} doctors, ${patients.length} patients`);
  console.log(`  ${allBookedSlots.length} consultations + payments (mixed statuses)`);
  console.log(`  All seeded users share the password: ${SEED_PASSWORD}`);
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });