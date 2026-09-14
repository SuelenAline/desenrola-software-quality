import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { loadEnvFile } from 'node:process';
import { existsSync } from 'node:fs';
import { it } from 'node:test';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../dist/app.module.js';
import { configureApp } from '../dist/configure-app.js';
import { PrismaService } from '../dist/prisma/prisma.service.js';

if (existsSync('.env')) loadEnvFile('.env');
const target = new URL(process.env.DATABASE_URL ?? '');
if (!['localhost', '127.0.0.1', '[::1]'].includes(target.hostname)) {
  throw new Error(
    'Este teste cria registros temporários e aceita somente PostgreSQL local.',
  );
}

it('registers and authenticates two real users, isolates CRUD and cleans its own records', async () => {
  let app, prisma;
  const runId = randomUUID();
  const emails = [
    `auth-test-${runId}-a@example.com`,
    `auth-test-${runId}-b@example.com`,
  ];
  const password = `Test-only-${randomUUID()}`;
  try {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    const http = app.getHttpServer();
    const sessions = [];
    for (const email of emails) {
      const response = await request(http)
        .post('/auth/register')
        .send({ name: 'Temporary auth test', email, password })
        .expect(201);
      assert.equal(response.body.user.passwordHash, undefined);
      sessions.push(response.body);
    }
    await request(http)
      .post('/auth/register')
      .send({ name: 'Duplicate', email: emails[0].toUpperCase(), password })
      .expect(409);
    const login = await request(http)
      .post('/auth/login')
      .send({ email: emails[0], password })
      .expect(200);
    assert.equal(login.body.user.id, sessions[0].user.id);
    assert.equal(login.body.user.passwordHash, undefined);
    const storedUser = await prisma.user.findUniqueOrThrow({
      where: { id: login.body.user.id },
    });
    assert.notEqual(storedUser.passwordHash, password);
    assert.match(storedUser.passwordHash, /^scrypt-v1\$/);
    await request(http)
      .post('/auth/login')
      .send({ email: emails[0], password: 'Incorrect password' })
      .expect(401);
    await request(http).get('/transactions').expect(401);
    const transaction = {
      description: `Temporary auth test ${runId}`,
      amount: 12.34,
      type: 'Despesa',
    };
    const created = await request(http)
      .post('/transactions')
      .auth(login.body.access_token, { type: 'bearer' })
      .send(transaction)
      .expect(201);
    assert.equal(created.body.userId, login.body.user.id);
    assert.equal(created.body.amount, '12.34');
    const id = created.body.id;
    const own = await request(http)
      .get('/transactions')
      .auth(login.body.access_token, { type: 'bearer' })
      .expect(200);
    assert.deepEqual(
      own.body.map((row) => row.id),
      [id],
    );
    await request(http)
      .get('/transactions')
      .auth(sessions[1].access_token, { type: 'bearer' })
      .expect(200, []);
    for (const method of ['get', 'put', 'delete']) {
      await request(http)
        [method](`/transactions/${id}`)
        .auth(sessions[1].access_token, { type: 'bearer' })
        .send(transaction)
        .expect(404);
    }
    assert.equal(
      (
        await prisma.transaction.findUniqueOrThrow({ where: { id } })
      ).amount.toString(),
      '12.34',
    );
    await request(http)
      .put(`/transactions/${id}`)
      .auth(login.body.access_token, { type: 'bearer' })
      .send({ ...transaction, amount: 99.99 })
      .expect(200);
    await request(http)
      .delete(`/transactions/${id}`)
      .auth(login.body.access_token, { type: 'bearer' })
      .expect(200);
    assert.equal(await prisma.transaction.findUnique({ where: { id } }), null);
  } finally {
    try {
      if (prisma) {
        // Delete only users with this run's random email addresses and their records.
        await prisma.$transaction(async (tx) => {
          const createdUsers = await tx.user.findMany({
            where: { email: { in: emails } },
            select: { id: true },
          });
          await tx.transaction.deleteMany({
            where: { userId: { in: createdUsers.map((user) => user.id) } },
          });
          await tx.user.deleteMany({ where: { email: { in: emails } } });
        });
      }
    } finally {
      await app?.close();
    }
  }
});

it('updates credentials, revokes sessions and deletes only the temporary owner in PostgreSQL', async () => {
  let app, prisma;
  const runId = randomUUID();
  const emails = [
    `account-test-${runId}-a@example.com`,
    `account-test-${runId}-b@example.com`,
    `account-test-${runId}-updated@example.com`,
  ];
  const password = `Test-only-${randomUUID()}`;
  const newPassword = `Changed-test-${randomUUID()}`;
  try {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    const http = app.getHttpServer();
    const sessions = [];
    for (const email of emails.slice(0, 2)) {
      const response = await request(http)
        .post('/auth/register')
        .send({ name: 'Temporary account test', email, password })
        .expect(201);
      sessions.push(response.body);
    }
    const ownedTransactions = [];
    for (const session of sessions) {
      const created = await request(http)
        .post('/transactions')
        .auth(session.access_token, { type: 'bearer' })
        .send({
          description: `Account test ${runId}`,
          amount: 5.25,
          type: 'Despesa',
        })
        .expect(201);
      ownedTransactions.push(created.body.id);
    }
    const updated = await request(http)
      .patch('/auth/me')
      .auth(sessions[0].access_token, { type: 'bearer' })
      .send({
        currentPassword: password,
        name: ' Updated Name ',
        email: emails[2].toUpperCase(),
        password: newPassword,
      })
      .expect(200);
    assert.equal(updated.body.name, 'Updated Name');
    assert.equal(updated.body.email, emails[2]);
    assert.equal(updated.body.passwordHash, undefined);
    assert.equal(updated.body.tokenVersion, undefined);
    const stored = await prisma.user.findUniqueOrThrow({
      where: { id: sessions[0].user.id },
    });
    assert.equal(stored.tokenVersion, 1);
    assert.notEqual(stored.passwordHash, newPassword);
    await request(http)
      .get('/transactions')
      .auth(sessions[0].access_token, { type: 'bearer' })
      .expect(401);
    await request(http)
      .post('/auth/login')
      .send({ email: emails[2], password })
      .expect(401);
    const login = await request(http)
      .post('/auth/login')
      .send({ email: emails[2], password: newPassword })
      .expect(200);
    const currentToken = login.body.access_token;
    const profile = await request(http)
      .get('/auth/me')
      .auth(currentToken, { type: 'bearer' })
      .expect(200);
    assert.equal(profile.body.id, sessions[0].user.id);
    await request(http)
      .delete('/auth/me')
      .auth(currentToken, { type: 'bearer' })
      .send({ currentPassword: password })
      .expect(401);
    assert.ok(
      await prisma.transaction.findUnique({
        where: { id: ownedTransactions[0] },
      }),
    );
    await request(http)
      .delete('/auth/me')
      .auth(currentToken, { type: 'bearer' })
      .send({ currentPassword: newPassword })
      .expect(204);
    assert.equal(
      await prisma.user.findUnique({ where: { id: sessions[0].user.id } }),
      null,
    );
    assert.equal(
      await prisma.transaction.findUnique({
        where: { id: ownedTransactions[0] },
      }),
      null,
    );
    assert.ok(
      await prisma.user.findUnique({ where: { id: sessions[1].user.id } }),
    );
    assert.ok(
      await prisma.transaction.findUnique({
        where: { id: ownedTransactions[1] },
      }),
    );
    await request(http)
      .get('/transactions')
      .auth(currentToken, { type: 'bearer' })
      .expect(401);
    const other = await request(http)
      .get('/transactions')
      .auth(sessions[1].access_token, { type: 'bearer' })
      .expect(200);
    assert.deepEqual(
      other.body.map((row) => row.id),
      [ownedTransactions[1]],
    );
  } finally {
    try {
      if (prisma) {
        await prisma.$transaction(async (tx) => {
          const createdUsers = await tx.user.findMany({
            where: { email: { in: emails } },
            select: { id: true },
          });
          await tx.transaction.deleteMany({
            where: { userId: { in: createdUsers.map((user) => user.id) } },
          });
          await tx.user.deleteMany({ where: { email: { in: emails } } });
        });
      }
    } finally {
      await app?.close();
    }
  }
});
