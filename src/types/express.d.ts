import { logger } from '@/lib/logger';
import { AuthPayload } from '@/middleware/auth';

declare module 'express-serve-static-core' {
  interface Request {
    requestId: string;
    log: typeof logger;
    user?: AuthPayload;
  }
}
