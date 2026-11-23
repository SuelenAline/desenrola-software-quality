import type { ActivityAction, Prisma } from '@prisma/client';
import type { PrismaService } from './prisma.service.js';

export function auditedWrite<T extends { id: number }>(
  prisma: PrismaService,
  actorId: number,
  action: ActivityAction,
  write: (tx: Prisma.TransactionClient) => Promise<T>,
) {
  return prisma.$transaction(async (tx) => {
    const record = await write(tx);
    await tx.activity.create({
      data: { actorId, actorAccountId: actorId, action, recordId: record.id },
    });
    return record;
  });
}
