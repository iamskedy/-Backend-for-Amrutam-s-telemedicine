import { Doctor } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { logger } from '@/lib/logger';

interface SearchDoctorsInput {
  specialty?: string;
  minRating?: number;
  availableAfter?: Date;
}

const CACHE_TTL_SECONDS = 60;

function cacheKey(input: SearchDoctorsInput): string {
  return `search:doctors:${JSON.stringify(input)}`;
}

export async function searchDoctors(input: SearchDoctorsInput): Promise<Doctor[]> {
  const key = cacheKey(input);

  try {
    const cached = await redis.get(key);
    if (cached) {
      return JSON.parse(cached) as Doctor[];
    }
  } catch (err) {
    logger.error({ err }, 'search cache read failed — falling through to DB');
  }

  const results = await prisma.doctor.findMany({
    where: {
      verifiedAt: { not: null },
      ...(input.specialty ? { specialty: { equals: input.specialty, mode: 'insensitive' } } : {}),
      ...(input.minRating ? { rating: { gte: input.minRating } } : {}),
      ...(input.availableAfter
        ? {
            availability: {
              some: { status: 'OPEN', startTime: { gte: input.availableAfter } },
            },
          }
        : {}),
    },
    orderBy: { rating: 'desc' },
    take: 50,
  });

  redis
    .set(key, JSON.stringify(results), 'EX', CACHE_TTL_SECONDS)
    .catch((err) => logger.error({ err }, 'search cache write failed'));

  return results;
}

/**
 * Called whenever a slot's status changes (create/hold/book/cancel).
 * Because search results are keyed by query params (not by doctor), we
 * can't invalidate a single key precisely — instead we bust the whole
 * search cache namespace. Acceptable here since search is read-heavy and
 * cheap to regenerate, and the alternative (per-doctor cache tagging) adds
 * real complexity for a scale this app isn't at yet.
 */
export async function invalidateSearchCache(): Promise<void> {
  try {
    const keys = await redis.keys('search:doctors:*');
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch (err) {
    logger.error({ err }, 'search cache invalidation failed');
  }
}