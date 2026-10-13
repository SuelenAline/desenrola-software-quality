import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it, mock } from 'node:test';
import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../dist/app.module.js';
import { configureApp } from '../dist/configure-app.js';
import { randomBytes } from 'node:crypto';
import { TokenService } from '../dist/auth/token.service.js';
import { PrismaService } from '../dist/prisma/prisma.service.js';

const transaction = {
  id: 1,
  description: 'Mercado',
  amount: '100',
  type: 'Despesa',
};
const payload = { description: 'Mercado', amount: 100, type: 'Despesa' };
const missing = () =>
  new Prisma.PrismaClientKnownRequestError('Missing record', {
    code: 'P2025',
    clientVersion: Prisma.prismaVersion.client,
  });

describe('HTTP transactions (compiled application, mocked persistence)', () => {
  let app;
  let db;
  let token;
  before(async () => {
    process.env.JWT_SECRET = randomBytes(32).toString('hex');
    db = {
      user: { findUnique: async () => ({ id: 1, tokenVersion: 0 }) },
      transaction: Object.fromEntries(
        ['findMany', 'findUnique', 'create', 'update', 'delete', 'groupBy'].map((name) => [
          name,
          mock.fn(),
        ]),
      ),
    };
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(db)
      .compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
    token = await app.get(TokenService).issue(1);
  });
  beforeEach(() => {
    for (const fn of Object.values(db.transaction)) {
      fn.mock.resetCalls();
      fn.mock.mockImplementation(async () => transaction);
    }
    db.transaction.findMany.mock.mockImplementation(async () => [transaction]);
  });
  after(async () => {
    await app?.close();
  });

  it('GET /', async () => {
    await request(app.getHttpServer()).get('/').expect(200, 'Hello World!');
  });
  it('lists transactions', async () => {
    await request(app.getHttpServer())
      .get('/transactions')
      .auth(token, { type: 'bearer' })
      .expect(200, [transaction]);
  });
  it('requires authentication for the financial summary', async () => {
    await request(app.getHttpServer()).get('/transactions/summary').expect(401);
    assert.equal(db.transaction.groupBy.mock.callCount(), 0);
  });
  for (const [name, groups, expected] of [
    ['empty account', [], { income: '0.00', expense: '0.00', balance: '0.00' }],
    ['decimal amounts', [ ['Receita', '0.30'], ['Despesa', '0.10'] ], { income: '0.30', expense: '0.10', balance: '0.20' }],
    ['negative balance', [ ['Despesa', '150.25'] ], { income: '0.00', expense: '150.25', balance: '-150.25' }],
    ['income only', [ ['Receita', '3200'] ], { income: '3200.00', expense: '0.00', balance: '3200.00' }],
  ]) {
    it(`summarizes ${name} for the authenticated user`, async () => {
      db.transaction.groupBy.mock.mockImplementation(async () =>
        groups.map(([type, amount]) => ({ type, _sum: { amount: new Prisma.Decimal(amount) } })),
      );
      await request(app.getHttpServer())
        .get('/transactions/summary')
        .auth(token, { type: 'bearer' })
        .expect(200, expected);
      assert.deepEqual(db.transaction.groupBy.mock.calls[0].arguments, [{
        by: ['type'], where: { userId: 1 }, _sum: { amount: true },
      }]);
    });
  }
  it('filters dashboard by owner and half-open UTC-3 date boundaries', async () => {
    db.transaction.findMany.mock.mockImplementation(async () => [
      { createdAt: new Date('2026-10-13T03:00:00Z'), type: 'Receita', amount: new Prisma.Decimal('0.30') },
      { createdAt: new Date('2026-10-14T02:59:59Z'), type: 'Despesa', amount: new Prisma.Decimal('0.10') },
    ]);
    const response = await request(app.getHttpServer())
      .get('/transactions/dashboard?period=day&date=2026-10-13')
      .auth(token, { type: 'bearer' }).expect(200);
    assert.deepEqual(response.body, {
      from: '2026-10-13', to: '2026-10-13', income: '0.30', expense: '0.10', balance: '0.20',
      daily: [{ date: '2026-10-13', income: '0.30', expense: '0.10', balance: '0.20' }],
    });
    assert.deepEqual(db.transaction.findMany.mock.calls[0].arguments[0], {
      where: { userId: 1, createdAt: { gte: new Date('2026-10-13T03:00:00Z'), lt: new Date('2026-10-14T03:00:00Z') } },
      select: { createdAt: true, type: true, amount: true },
    });
  });
  for (const [period, date, from, to, length] of [
    ['week', '2026-01-01', '2025-12-29', '2026-01-04', 7],
    ['week', '2026-01-04', '2025-12-29', '2026-01-04', 7],
    ['month', '2024-02-29', '2024-02-01', '2024-02-29', 29],
    ['month', '2026-12-31', '2026-12-01', '2026-12-31', 31],
  ]) {
    it(`fills empty days for ${period} at ${date}`, async () => {
      db.transaction.findMany.mock.mockImplementation(async () => []);
      const { body } = await request(app.getHttpServer())
        .get(`/transactions/dashboard?period=${period}&date=${date}`)
        .auth(token, { type: 'bearer' }).expect(200);
      assert.equal(body.from, from);
      assert.equal(body.to, to);
      assert.equal(body.daily.length, length);
      assert.equal(body.balance, '0.00');
      assert.ok(body.daily.every(day => day.income === '0.00' && day.expense === '0.00'));
    });
  }
  for (const query of ['', 'period=year&date=2026-10-13', 'period=day&date=2026-02-30', 'period=day&date=invalid', 'period=day&date=0000-01-01', 'period=day&date=2026-10-13&userId=2']) {
    it(`rejects invalid dashboard query ${query}`, async () => {
      await request(app.getHttpServer()).get(`/transactions/dashboard?${query}`)
        .auth(token, { type: 'bearer' }).expect(400);
      assert.equal(db.transaction.findMany.mock.callCount(), 0);
    });
  }
  it('requires authentication for dashboard details', async () => {
    await request(app.getHttpServer()).get('/transactions/dashboard?period=day&date=2026-10-13').expect(401);
  });
  it('finds by numeric ID', async () => {
    await request(app.getHttpServer())
      .get('/transactions/1')
      .auth(token, { type: 'bearer' })
      .expect(200, transaction);
    assert.deepEqual(db.transaction.findUnique.mock.calls[0].arguments, [
      { where: { id: 1, userId: 1 } },
    ]);
  });
  for (const method of ['get', 'put', 'delete']) {
    for (const id of ['abc', '1.5', '0', '-1', '2147483648', '1e2']) {
      it(`${method} rejects invalid ID ${id}`, async () => {
        await request(app.getHttpServer())
          [method](`/transactions/${id}`)
          .auth(token, { type: 'bearer' })
          .send(payload)
          .expect(400);
        for (const fn of Object.values(db.transaction))
          assert.equal(fn.mock.callCount(), 0);
      });
    }
    it(`${method} returns 404 for missing transaction`, async () => {
      db.transaction.findUnique.mock.mockImplementation(async () => null);
      db.transaction.update.mock.mockImplementation(async () => {
        throw missing();
      });
      db.transaction.delete.mock.mockImplementation(async () => {
        throw missing();
      });
      await request(app.getHttpServer())
        [method]('/transactions/1')
        .auth(token, { type: 'bearer' })
        .send(payload)
        .expect(404);
    });
  }
  for (const method of ['post', 'put']) {
    const path = method === 'post' ? '/transactions' : '/transactions/1';
    it(`${method} accepts valid data and trims description`, async () => {
      await request(app.getHttpServer())
        [method](path)
        .auth(token, { type: 'bearer' })
        .send({ ...payload, description: ' Mercado ' })
        .expect(method === 'post' ? 201 : 200);
      const fn = db.transaction[method === 'post' ? 'create' : 'update'];
      assert.deepEqual(
        fn.mock.calls[0].arguments[0].data,
        method === 'post' ? { ...payload, userId: 1 } : payload,
      );
      if (method === 'put')
        assert.deepEqual(fn.mock.calls[0].arguments[0].where, {
          id: 1,
          userId: 1,
        });
    });
    const invalid = [
      {},
      { description: ' ' },
      { description: 42 },
      { amount: -1 },
      { amount: 0.001 },
      { amount: 100000000 },
      { amount: '100' },
      { type: 'Other' },
      { extra: true },
    ];
    for (const [index, data] of invalid.entries()) {
      it(`${method} rejects invalid payload ${index}`, async () => {
        await request(app.getHttpServer())
          [method](path)
          .auth(token, { type: 'bearer' })
          .send(index === 0 ? {} : { ...payload, ...data })
          .expect(400);
        assert.equal(db.transaction.create.mock.callCount(), 0);
        assert.equal(db.transaction.update.mock.callCount(), 0);
      });
    }
  }
  it('deletes an existing transaction', async () => {
    await request(app.getHttpServer())
      .delete('/transactions/1')
      .auth(token, { type: 'bearer' })
      .expect(200, transaction);
    assert.deepEqual(db.transaction.delete.mock.calls[0].arguments, [
      { where: { id: 1, userId: 1 } },
    ]);
  });
  it('preserves unexpected persistence errors', async () => {
    const error = new Error('Database unavailable');
    db.transaction.update.mock.mockImplementation(async () => {
      throw error;
    });
    const { TransactionsController } =
      await import('../dist/transactions/transactions.controller.js');
    await assert.rejects(
      app.get(TransactionsController).update(1, payload, 1),
      (candidate) => candidate === error,
    );
  });
});
