import { Request, Response } from 'express';
import { asyncHandler } from '@/lib/asyncHandler';
import { searchDoctors } from '@/modules/search/search.service';

export const searchDoctorsController = asyncHandler(async (req: Request, res: Response) => {
  const { specialty, minRating, availableAfter } = req.query as Record<string, string | undefined>;
  const results = await searchDoctors({
    specialty,
    minRating: minRating ? Number(minRating) : undefined,
    availableAfter: availableAfter ? new Date(availableAfter) : undefined,
  });
  res.status(200).json(results);
});