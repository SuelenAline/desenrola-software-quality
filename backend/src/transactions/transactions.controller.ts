import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CreateTransactionDto } from './transactions.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { TransactionIdPipe } from './transaction-id.pipe.js';

import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentUserId } from '../auth/current-user.decorator.js';

@Controller('transactions')
@UseGuards(AuthGuard)
export class TransactionsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async findAll(@CurrentUserId() userId: number) {
    return this.prisma.transaction.findMany({ where: { userId } });
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
