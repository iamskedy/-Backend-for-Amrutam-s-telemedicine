import { Request, Response } from 'express';
import { asyncHandler } from '@/lib/asyncHandler';
import { getBookingsPerDay, getCancellationRate, getRevenue } from '@/modules/admin/analytics.service';

export const bookingsPerDayController = asyncHandler(async (_req: Request, res: Response) => {
  res.status(200).json(await getBookingsPerDay());
});

export const cancellationRateController = asyncHandler(async (_req: Request, res: Response) => {
  res.status(200).json(await getCancellationRate());
});

export const revenueController = asyncHandler(async (_req: Request, res: Response) => {
  res.status(200).json(await getRevenue());
});