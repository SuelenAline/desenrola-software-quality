import { ConflictException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

export async function lockAccountManagement(tx: Prisma.TransactionClient) {
  // Serialize account status changes and deletions across application instances.
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(69301214)::text`;
}

export async function requireOtherActiveAdmin(
  tx: Prisma.TransactionClient,
  id: number,
) {
  const other = await tx.user.findFirst({
    where: { id: { not: id }, role: 'ADMIN', active: true },
    select: { id: true },
  });
  if (!other)
    throw new ConflictException(
      'A última conta administradora ativa deve ser preservada.',
    );
}
