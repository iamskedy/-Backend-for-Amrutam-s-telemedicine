import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

interface WriteAuditLogInput {
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  ip?: string;
}


export async function writeAuditLog(input: WriteAuditLogInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: input.actorId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        before: input.before as any,
        after: input.after as any,
        ip: input.ip,
      },
    });
  } catch (err) {
    
    logger.error({ err, input }, 'failed to write audit log');
  }
}