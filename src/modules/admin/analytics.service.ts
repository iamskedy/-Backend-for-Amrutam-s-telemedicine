import { prisma } from '@/lib/prisma';

export async function getBookingsPerDay(days = 30) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const consultations = await prisma.consultation.findMany({
    where: { createdAt: { gte: since } },
    select: { createdAt: true },
  });

  const counts: Record<string, number> = {};
  for (const c of consultations) {
    const day = c.createdAt.toISOString().slice(0, 10);
    counts[day] = (counts[day] ?? 0) + 1;
  }
  return counts;
}

export async function getCancellationRate(days = 30) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const total = await prisma.consultation.count({ where: { createdAt: { gte: since } } });
  const cancelled = await prisma.consultation.count({
    where: { createdAt: { gte: since }, status: 'CANCELLED' },
  });
  return { total, cancelled, rate: total > 0 ? cancelled / total : 0 };
}

export async function getRevenue(days = 30) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const result = await prisma.payment.aggregate({
    where: { createdAt: { gte: since }, status: 'CAPTURED' },
    _sum: { amount: true },
    _count: true,
  });
  return { totalRevenue: result._sum.amount ?? 0, capturedPayments: result._count };
}