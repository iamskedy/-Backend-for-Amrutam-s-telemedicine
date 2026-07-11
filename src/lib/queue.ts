import { Queue, QueueOptions } from 'bullmq';
import { env } from '@/config';

// BullMQ needs its own dedicated Redis connection options (it manages
// blocking commands internally) — reusing the general-purpose `redis`
// client from lib/redis.ts is not recommended by BullMQ's own docs.
const connection: QueueOptions['connection'] = {
  host: new URL(env.REDIS_URL).hostname,
  port: Number(new URL(env.REDIS_URL).port || 6379),
  password: new URL(env.REDIS_URL).password || undefined,
  tls: env.REDIS_URL.startsWith('rediss://') ? {} : undefined,
  maxRetriesPerRequest: null, // required by BullMQ for its blocking commands
};

const defaultJobOptions: QueueOptions['defaultJobOptions'] = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 2000 }, // 2s, 4s, 8s
  removeOnComplete: 1000, // keep last 1000 completed jobs for debugging
  removeOnFail: 5000, // keep more failed jobs — useful for diagnosing issues
};

export const notificationQueue = new Queue('notifications', { connection, defaultJobOptions });
export const prescriptionPdfQueue = new Queue('prescription-pdf', { connection, defaultJobOptions });