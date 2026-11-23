import {
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthGuard } from '../auth/auth.guard.js';
import { publicUserSelect } from '../auth/auth.service.js';
import { CurrentUserId } from '../auth/current-user.decorator.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { TransactionIdPipe } from '../transactions/transaction-id.pipe.js';
import {
  lockAccountManagement,
  requireOtherActiveAdmin,
} from './account-management.js';
import {
  AccountStatusDto,
  ActivitiesQuery,
  AdminUsersQuery,
} from './admin.dto.js';
import { AdminGuard } from './admin.guard.js';

const accountSelect = {
  ...publicUserSelect,
  active: true,
  _count: { select: { transactions: true } },
} satisfies Prisma.UserSelect;

@Controller('admin')
@UseGuards(AuthGuard, AdminGuard)
export class AdminController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('users')
  users(@Query() query: AdminUsersQuery) {
    const search = query.search?.trim().replace(/[\\%_]/g, '\\$&');
    return this.prisma.user.findMany({
      where: search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
            ],
          }
        : undefined,
      select: accountSelect,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
  }

  @Get('summary')
  async summary() {
    const [groups, totalTransactions] = await this.prisma.$transaction(
      [
        this.prisma.user.groupBy({ by: ['active'], _count: { _all: true } }),
        this.prisma.transaction.count(),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    const activeUsers = groups.find((group) => group.active)?._count._all ?? 0;
    const inactiveUsers =
      groups.find((group) => !group.active)?._count._all ?? 0;
    return {
      totalUsers: activeUsers + inactiveUsers,
      activeUsers,
      inactiveUsers,
      totalTransactions,
    };
  }

  @Patch('users/:id/status')
  async setStatus(
    @CurrentUserId() actorId: number,
    @Param('id', TransactionIdPipe) rawId: string | number,
    @Body() { active }: AccountStatusDto,
  ) {
    const id = Number(rawId);
    if (!active && id === actorId)
      throw new ConflictException('Você não pode desativar sua própria conta.');
    return this.prisma.$transaction(async (tx) => {
      await lockAccountManagement(tx);
      const actor = await tx.user.findUnique({
        where: { id: actorId },
        select: { role: true, active: true },
      });
      if (actor?.role !== 'ADMIN' || !actor.active)
        throw new ForbiddenException('Área exclusiva para administradores.');
      const account = await tx.user.findUnique({
        where: { id },
        select: accountSelect,
      });
      if (!account) throw new NotFoundException('Conta não encontrada.');
      if (account.active === active) return account;
      if (!active && account.role === 'ADMIN')
        await requireOtherActiveAdmin(tx, id);
      const updated = await tx.user.update({
        where: { id },
        data: active ? { active } : { active, tokenVersion: { increment: 1 } },
        select: accountSelect,
      });
      await tx.activity.create({
        data: {
          actorId,
          actorAccountId: actorId,
          action: active ? 'ACCOUNT_ACTIVATED' : 'ACCOUNT_DEACTIVATED',
          recordId: id,
        },
      });
      return updated;
    });
  }

  @Get('activities')
  async activities(@Query() query: ActivitiesQuery) {
    const id = query.before === undefined ? undefined : Number(query.before);
    if (id !== undefined && id > 2147483647)
      throw new NotFoundException('Atividade não encontrada.');
    const items = await this.prisma.activity.findMany({
      ...(id === undefined ? {} : { cursor: { id }, skip: 1 }),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 51,
      select: {
        id: true,
        actorId: true,
        action: true,
        recordId: true,
        createdAt: true,
        actor: { select: { name: true } },
      },
    });
    const next = items.length > 50 ? items[49].id : null;
    return { items: items.slice(0, 50), next };
  }
}
