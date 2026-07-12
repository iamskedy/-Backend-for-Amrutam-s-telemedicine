import { Router } from 'express';
import { requireAuth } from '@/middleware/auth';
import { requireRole } from '@/middleware/rbac';
import {
  bookingsPerDayController,
  cancellationRateController,
  revenueController,
} from '@/modules/admin/analytics.controller';

export const adminRouter = Router();


adminRouter.use(requireAuth, requireRole('ADMIN'));

adminRouter.get('/analytics/bookings-per-day', bookingsPerDayController);
adminRouter.get('/analytics/cancellation-rate', cancellationRateController);
adminRouter.get('/analytics/revenue', revenueController);