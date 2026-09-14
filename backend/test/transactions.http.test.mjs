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
        ['findMany', 'findUnique', 'create', 'update', 'delete'].map((name) => [
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
