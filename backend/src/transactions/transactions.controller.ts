import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CreateTransactionDto } from './transactions.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { TransactionIdPipe } from './transaction-id.pipe.js';

import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentUserId } from '../auth/current-user.decorator.js';
import { DashboardQueryDto } from './dashboard.dto.js';
import { dashboardRange, dashboardSummary } from './dashboard.js';

@Controller('transactions')
@UseGuards(AuthGuard)
export class TransactionsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async findAll(@CurrentUserId() userId: number) {
    return this.prisma.transaction.findMany({ where: { userId } });
  }

  @Get('dashboard')
  async dashboard(@CurrentUserId() userId: number, @Query() query: DashboardQueryDto) {
    const range = dashboardRange(query);
    const transactions = await this.prisma.transaction.findMany({
      where: { userId, createdAt: { gte: range.start, lt: range.end } },
      select: { createdAt: true, type: true, amount: true },
    });
    return dashboardSummary(range, transactions);
  }

  @Get('summary')
  async summary(@CurrentUserId() userId: number) {
    const groups = await this.prisma.transaction.groupBy({
      by: ['type'],
      where: { userId },
      _sum: { amount: true },
    });
    const total = (type: string) =>
      groups.find((group) => group.type === type)?._sum.amount ??
      new Prisma.Decimal(0);
    const income = total('Receita');
    const expense = total('Despesa');
    return {
      income: income.toFixed(2),
      expense: expense.toFixed(2),
      balance: income.minus(expense).toFixed(2),
    };
  }

  // Preserve the raw parameter until TransactionIdPipe validates its syntax.
  // A number-only annotation would let the global ValidationPipe coerce it first.
  @Get(':id')
  async findOne(
    @Param('id', TransactionIdPipe) id: string | number,
    @CurrentUserId() userId: number,
  ) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id: Number(id), userId },
    });
    if (!transaction) throw new NotFoundException('Transação não encontrada.');
    return transaction;
  }

  @Put(':id')
  async update(
    @Param('id', TransactionIdPipe) id: string | number,
    @Body() data: CreateTransactionDto,
    @CurrentUserId() userId: number,
  ) {
    try {
      return await this.prisma.transaction.update({
        where: { id: Number(id), userId },
        data: {
          description: data.description,
          amount: data.amount,
          type: data.type,
        },
      });
    } catch (error) {
      this.handleWriteError(error);
    }
  }

  @Delete(':id')
  async remove(
    @Param('id', TransactionIdPipe) id: string | number,
    @CurrentUserId() userId: number,
  ) {
    try {
      return await this.prisma.transaction.delete({
        where: { id: Number(id), userId },
      });
    } catch (error) {
      this.handleWriteError(error);
    }
  }

  @Post()
  async create(
    @Body() data: CreateTransactionDto,
    @CurrentUserId() userId: number,
  ) {
    return this.prisma.transaction.create({
      data: {
        userId,
        description: data.description,
        amount: data.amount,
        type: data.type,
      },
    });
  }

  private handleWriteError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    ) {
      throw new NotFoundException('Transação não encontrada.');
    }
    throw error;
  }
}
