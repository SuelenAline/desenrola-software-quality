import { Test, TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TransactionsController } from './transactions.controller.js';
import { AuthGuard } from '../auth/auth.guard.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('TransactionsController', () => {
  let controller: TransactionsController;

  const prismaMock = {
    transaction: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TransactionsController],
      providers: [
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<TransactionsController>(TransactionsController);
  });

  it('deve estar definido', () => {
    expect(controller).toBeDefined();
  });
  it('deve retornar todas as transações', async () => {
    const transacoes = [
      {
        id: 1,
        description: 'Mercado',
        amount: 100,
        type: 'Despesa',
      },
      {
        id: 2,
        description: 'Salário',
        amount: 2000,
        type: 'Receita',
      },
    ];

    prismaMock.transaction.findMany.mockResolvedValue(transacoes);

    const resultado = await controller.findAll(1);

    expect(resultado).toEqual(transacoes);
    expect(prismaMock.transaction.findMany).toHaveBeenCalledWith({
      where: { userId: 1 },
    });
  });
});
