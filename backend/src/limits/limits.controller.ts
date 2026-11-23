import {
  Body,
  ConflictException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentUserId } from '../auth/current-user.decorator.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { dashboardRange } from '../transactions/dashboard.js';
import { TransactionIdPipe } from '../transactions/transaction-id.pipe.js';
import { SpendingLimitDto } from './limits.dto.js';

@Controller('limits')
@UseGuards(AuthGuard)
export class LimitsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@CurrentUserId() userId: number) {
    const limits = await this.prisma.spendingLimit.findMany({
      where: { userId },
      include: { category: { select: { name: true } } },
      orderBy: [
        { year: 'desc' },
        { month: 'desc' },
        { category: { name: 'asc' } },
        { id: 'asc' },
      ],
    });
    const periods = new Map<string, typeof limits>();
    for (const limit of limits) {
      const period = `${limit.year}-${String(limit.month).padStart(2, '0')}`;
      const entries = periods.get(period);
      if (entries) entries.push(limit);
      else periods.set(period, [limit]);
    }
    const results = [];
    for (const [period, entries] of periods) {
      const { start, end } = dashboardRange({
        period: 'month',
        date: `${period}-01`,
      });
      const totals = await this.prisma.transaction.groupBy({
        by: ['categoryId'],
        where: {
          userId,
          type: 'Despesa',
          categoryId: { in: entries.map(({ categoryId }) => categoryId) },
          createdAt: { gte: start, lt: end },
        },
        _sum: { amount: true },
      });
      const byCategory = new Map(
        totals.map((row) => [row.categoryId, row._sum.amount]),
      );
      for (const { amount, ...limit } of entries) {
        const spent = byCategory.get(limit.categoryId) ?? new Prisma.Decimal(0);
        const available = amount.minus(spent);
        const status = available.isNegative()
          ? 'exceeded'
          : spent.gte(amount.times('0.8'))
            ? 'warning'
            : 'ok';
        results.push({
          ...limit,
          amount: amount.toFixed(2),
          spent: spent.toFixed(2),
          available: available.toFixed(2),
          percentage: spent.div(amount).times(100).toFixed(2),
          status,
          exceeded: (available.isNegative()
            ? available.abs()
            : new Prisma.Decimal(0)
          ).toFixed(2),
        });
      }
    }
    return results;
  }

  @Post()
  create(@CurrentUserId() userId: number, @Body() data: SpendingLimitDto) {
    return this.save(userId, data);
  }

  @Put(':id')
  update(
    @CurrentUserId() userId: number,
    @Param('id', TransactionIdPipe) id: string | number,
    @Body() data: SpendingLimitDto,
  ) {
    return this.save(userId, data, Number(id));
  }

  private async save(userId: number, data: SpendingLimitDto, id?: number) {
    const category = await this.prisma.category.findUnique({
      where: { id_userId: { id: data.categoryId, userId } },
      select: { id: true },
    });
    if (!category) throw new NotFoundException('Categoria não encontrada.');
    try {
      return id === undefined
        ? await this.prisma.spendingLimit.create({ data: { ...data, userId } })
        : await this.prisma.spendingLimit.update({
            where: { id, userId },
            data,
          });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002')
          throw new ConflictException(
            'Já existe um limite para essa categoria e período.',
          );
        if (error.code === 'P2025')
          throw new NotFoundException('Limite não encontrado.');
        if (error.code === 'P2003')
          throw new NotFoundException('Categoria não encontrada.');
      }
      throw error;
    }
  }
}
