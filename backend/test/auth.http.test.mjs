import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { afterEach, before, beforeEach, describe, it } from 'node:test';
import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { SignJWT } from 'jose';
import request from 'supertest';
import { AppModule } from '../dist/app.module.js';
import { configureApp } from '../dist/configure-app.js';
import { PrismaService } from '../dist/prisma/prisma.service.js';
import { PasswordService } from '../dist/auth/password.service.js';
import { TokenService } from '../dist/auth/token.service.js';

const password = 'Senha de teste 123!';
const registration = { name: 'Ana Silva', email: 'ana@example.com', password };
const payload = { description: 'Mercado', amount: 100, type: 'Despesa' };
const selectFields = (row, select) =>
  !row
    ? null
    : !select
      ? { ...row }
      : Object.fromEntries(
          Object.keys(select)
            .filter((key) => select[key])
            .map((key) => [key, row[key]]),
        );
const prismaError = (code) =>
  new Prisma.PrismaClientKnownRequestError('Test persistence error', {
    code,
    clientVersion: Prisma.prismaVersion.client,
  });

describe('Authentication and transaction ownership (mocked persistence)', () => {
  let app, users, transactions, token, storedHash, db;
  const secret = randomBytes(32).toString('hex');
  before(async () => {
    storedHash = await new PasswordService().hash(password);
  });
  beforeEach(async () => {
    process.env.JWT_SECRET = secret;
    users = [
      {
        id: 1,
        name: 'Owner',
        email: 'owner@example.com',
        passwordHash: storedHash,
        tokenVersion: 0,
        createdAt: new Date(),
      },
      {
        id: 2,
        name: 'Other',
        email: 'other@example.com',
        passwordHash: storedHash,
        tokenVersion: 0,
        createdAt: new Date(),
      },
    ];
    transactions = [
      { id: 1, ...payload, userId: 1 },
      { id: 2, ...payload, userId: 2 },
      { id: 3, ...payload, userId: null },
    ];
    const matches = (row, where) =>
      Object.entries(where).every(([key, value]) => row[key] === value);
    db = {
      $transaction: async (callback) => {
        const previousUsers = structuredClone(users);
        const previousTransactions = structuredClone(transactions);
        try {
          return await callback(db);
        } catch (error) {
          users = previousUsers;
          transactions = previousTransactions;
          throw error;
        }
      },
      user: {
        update: async ({ where, data, select }) => {
          const user = users.find((row) => matches(row, where));
          if (!user) throw prismaError('P2025');
          if (
            data.email &&
            users.some((row) => row.id !== user.id && row.email === data.email)
          )
            throw prismaError('P2002');
          const { tokenVersion, ...fields } = data;
          Object.assign(user, fields);
          if (tokenVersion) user.tokenVersion += tokenVersion.increment;
          return selectFields(user, select);
        },
        delete: async ({ where }) => {
          const index = users.findIndex((row) => matches(row, where));
          if (index === -1) throw prismaError('P2025');
          return users.splice(index, 1)[0];
        },
        findUnique: async ({ where, select }) =>
          selectFields(
            users.find((row) => matches(row, where)),
            select,
          ),
        create: async ({ data, select }) => {
          if (users.some((row) => row.email === data.email))
            throw prismaError('P2002');
          const user = {
            id: users.length + 1,
            tokenVersion: 0,
            ...data,
            createdAt: new Date(),
          };
          users.push(user);
          return selectFields(user, select);
        },
      },
      transaction: {
        deleteMany: async ({ where }) => {
          const initial = transactions.length;
          transactions = transactions.filter((row) => !matches(row, where));
          return { count: initial - transactions.length };
        },
        findMany: async ({ where }) =>
          transactions.filter((row) => matches(row, where)),
        findUnique: async ({ where }) =>
          transactions.find((row) => matches(row, where)) ?? null,
        create: async ({ data }) => {
          const row = { id: transactions.length + 1, ...data };
          transactions.push(row);
          return row;
        },
        update: async ({ where, data }) => {
          const row = transactions.find((row) => matches(row, where));
          if (!row) throw prismaError('P2025');
          Object.assign(row, data);
          return row;
        },
        delete: async ({ where }) => {
          const index = transactions.findIndex((row) => matches(row, where));
          if (index === -1) throw prismaError('P2025');
          return transactions.splice(index, 1)[0];
        },
      },
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
  afterEach(async () => {
    await app?.close();
  });

  it('registers, normalizes email and name, hashes password and issues a usable token', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        ...registration,
        name: ' Ana Silva ',
        email: ' ANA@EXAMPLE.COM ',
      })
      .expect(201);
    assert.equal(response.body.user.email, registration.email);
    assert.equal(response.body.user.name, registration.name);
    assert.equal(response.body.user.passwordHash, undefined);
    assert.equal(response.body.user.password, undefined);
    assert.equal(response.body.token_type, 'Bearer');
    assert.equal(response.body.expires_in, 3600);
    const saved = users.find((user) => user.email === registration.email);
    assert.notEqual(saved.passwordHash, password);
    assert.equal(
      await app.get(PasswordService).verify(password, saved.passwordHash),
      true,
    );
    const verification = await app
      .get(TokenService)
      .verify(response.body.access_token);
    assert.equal(verification, saved.id);
    await request(app.getHttpServer())
      .get('/transactions')
      .auth(response.body.access_token, { type: 'bearer' })
      .expect(200, []);
  });

  it('logs in and does not expose the hash', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: ' OWNER@example.com ', password })
      .expect(200);
    assert.equal(response.body.user.id, 1);
    assert.equal(response.body.user.passwordHash, undefined);
    assert.equal(
      await app.get(TokenService).verify(response.body.access_token),
      1,
    );
  });
  it('rejects duplicate email regardless of case', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ ...registration, email: 'OWNER@EXAMPLE.COM' })
      .expect(409);
    assert.equal(users.length, 2);
  });
  it('returns the same error for a wrong password and an unknown email', async () => {
    const first = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'owner@example.com', password: 'wrong password' })
      .expect(401);
    const second = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'missing@example.com', password })
      .expect(401);
    assert.deepEqual(first.body, second.body);
  });
  for (const [label, data] of Object.entries({
    email: { email: 'invalid' },
    shortPassword: { password: '123' },
    longPassword: { password: 'x'.repeat(129) },
    nonStringPassword: { password: 12345678 },
    blankName: { name: '  ' },
    extraField: { userId: 1 },
    hashInjection: { passwordHash: 'forged-hash' },
  })) {
    it(`rejects invalid registration: ${label}`, async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ ...registration, ...data })
        .expect(400);
      assert.equal(users.length, 2);
    });
  }
  it('rejects missing registration fields', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({})
      .expect(400);
  });
  it('uses independent salts for the same password', async () => {
    const hash = await app.get(PasswordService).hash(password);
    assert.notEqual(hash, storedHash);
    assert.equal(await app.get(PasswordService).verify(password, hash), true);
    assert.equal(
      await app.get(PasswordService).verify(password, 'broken hash'),
      false,
    );
  });
  for (const [method, path] of [
    ['get', '/transactions'],
    ['get', '/transactions/1'],
    ['post', '/transactions'],
    ['put', '/transactions/1'],
    ['delete', '/transactions/1'],
  ]) {
    it(`requires authentication: ${method} ${path}`, async () => {
      await request(app.getHttpServer())
        [method](path)
        .send(payload)
        .expect(401);
    });
  }
  for (const authorization of [
    'Basic invalid',
    'Bearer malformed',
    'Bearer',
    'Bearer abc def',
  ]) {
    it(`rejects malformed credentials: ${authorization}`, async () => {
      await request(app.getHttpServer())
        .get('/transactions')
        .set('Authorization', authorization)
        .expect(401);
    });
  }
  for (const kind of [
    'expired',
    'wrongSignature',
    'wrongIssuer',
    'wrongAudience',
    'missingExpiration',
    'invalidSubject',
    'wrongAlgorithm',
  ]) {
    it(`rejects JWT: ${kind}`, async () => {
      let jwt = new SignJWT({})
        .setProtectedHeader({
          alg: kind === 'wrongAlgorithm' ? 'HS384' : 'HS256',
        })
        .setSubject(kind === 'invalidSubject' ? 'NaN' : '1')
        .setIssuer(kind === 'wrongIssuer' ? 'other' : 'desenrola-api')
        .setAudience(kind === 'wrongAudience' ? 'other' : 'desenrola')
        .setIssuedAt();
      if (kind !== 'missingExpiration')
        jwt = jwt.setExpirationTime(
          kind === 'expired' ? Math.floor(Date.now() / 1000) - 1 : '1h',
        );
      const badToken = await jwt.sign(
        new TextEncoder().encode(
          kind === 'wrongSignature' ? randomBytes(32).toString('hex') : secret,
        ),
      );
      await request(app.getHttpServer())
        .get('/transactions')
        .auth(badToken, { type: 'bearer' })
        .expect(401);
    });
  }
  it('rejects a token after the user is removed', async () => {
    users = users.filter((user) => user.id !== 1);
    await request(app.getHttpServer())
      .get('/transactions')
      .auth(token, { type: 'bearer' })
      .expect(401);
  });
  it('lists only owned transactions', async () => {
    const response = await request(app.getHttpServer())
      .get('/transactions')
      .auth(token, { type: 'bearer' })
      .expect(200);
    assert.deepEqual(
      response.body.map((row) => row.id),
      [1],
    );
  });
  it('assigns new transactions to the authenticated user', async () => {
    const response = await request(app.getHttpServer())
      .post('/transactions')
      .auth(token, { type: 'bearer' })
      .send(payload)
      .expect(201);
    assert.equal(response.body.userId, 1);
  });
  for (const method of ['post', 'put']) {
    it(`${method} rejects a forged owner in the body`, async () => {
      await request(app.getHttpServer())
        [method](method === 'post' ? '/transactions' : '/transactions/1')
        .auth(token, { type: 'bearer' })
        .send({ ...payload, userId: 2 })
        .expect(400);
    });
  }
  for (const id of [2, 3]) {
    for (const method of ['get', 'put', 'delete']) {
      it(`${method} hides other users' and unassigned records: ${id}`, async () => {
        await request(app.getHttpServer())
          [method](`/transactions/${id}`)
          .auth(token, { type: 'bearer' })
          .send(payload)
          .expect(404);
        assert.equal(transactions.length, 3);
        assert.equal(
          transactions.find((row) => row.id === id).userId,
          id === 2 ? 2 : null,
        );
      });
    }
  }
  it('allows the owner to update and delete', async () => {
    await request(app.getHttpServer())
      .put('/transactions/1')
      .auth(token, { type: 'bearer' })
      .send({ ...payload, amount: 200 })
      .expect(200);
    assert.equal(transactions[0].amount, 200);
    await request(app.getHttpServer())
      .delete('/transactions/1')
      .auth(token, { type: 'bearer' })
      .expect(200);
    assert.equal(
      transactions.some((row) => row.id === 1),
      false,
    );
  });
  it('limits auth attempts across login and registration', async () => {
    for (let i = 0; i < 10; i++) {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({})
        .expect(400);
    }
    await request(app.getHttpServer()).post('/auth/login').send({}).expect(429);
    // Both endpoints share the same quota.
    await request(app.getHttpServer())
      .post('/auth/register')
      .send(registration)
      .expect(429);
  });
  it('refuses to start with an absent or weak JWT secret', () => {
    try {
      delete process.env.JWT_SECRET;
      assert.throws(() => new TokenService(), /JWT_SECRET/);
      process.env.JWT_SECRET = 'weak';
      assert.throws(() => new TokenService(), /JWT_SECRET/);
    } finally {
      process.env.JWT_SECRET = secret;
    }
  });

  it('returns only public profile fields for the authenticated account', async () => {
    const response = await request(app.getHttpServer())
      .get('/auth/me')
      .auth(token, { type: 'bearer' })
      .expect(200);
    assert.deepEqual(Object.keys(response.body).sort(), [
      'createdAt',
      'email',
      'id',
      'name',
    ]);
    assert.equal(response.body.id, 1);
  });
  for (const method of ['get', 'patch', 'delete']) {
    it(method + ' profile requires a token', async () => {
      await request(app.getHttpServer())
        [method]('/auth/me')
        .send({ currentPassword: password, name: 'Changed' })
        .expect(401);
    });
  }
  it('updates name and email, preserving the password and other users', async () => {
    const otherUser = { ...users[1] };
    const response = await request(app.getHttpServer())
      .patch('/auth/me')
      .auth(token, { type: 'bearer' })
      .send({
        currentPassword: password,
        name: ' New Name ',
        email: ' NEW@example.com ',
      })
      .expect(200);
    assert.equal(response.body.name, 'New Name');
    assert.equal(response.body.email, 'new@example.com');
    assert.equal(response.body.passwordHash, undefined);
    assert.equal(response.body.tokenVersion, undefined);
    assert.equal(users[0].passwordHash, storedHash);
    assert.deepEqual(users[1], otherUser);
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'new@example.com', password })
      .expect(200);
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'owner@example.com', password })
      .expect(401);
  });
  it('rejects another account email without partially updating the name', async () => {
    await request(app.getHttpServer())
      .patch('/auth/me')
      .auth(token, { type: 'bearer' })
      .send({
        currentPassword: password,
        name: 'Changed',
        email: 'OTHER@example.com',
      })
      .expect(409);
    assert.equal(users[0].name, 'Owner');
    assert.equal(users[0].email, 'owner@example.com');
  });
  for (const method of ['patch', 'delete']) {
    it(
      method + ' rejects a wrong current password without changing data',
      async () => {
        const snapshot = structuredClone({ users, transactions });
        await request(app.getHttpServer())
          [method]('/auth/me')
          .auth(token, { type: 'bearer' })
          .send({
            currentPassword: 'wrong password',
            ...(method === 'patch' ? { name: 'New Name' } : {}),
          })
          .expect(401);
        assert.deepEqual({ users, transactions }, snapshot);
      },
    );
    it(method + ' rejects a missing current password', async () => {
      await request(app.getHttpServer())
        [method]('/auth/me')
        .auth(token, { type: 'bearer' })
        .send(method === 'patch' ? { name: 'New Name' } : {})
        .expect(400);
    });
    it(method + ' rejects a forged user ID', async () => {
      await request(app.getHttpServer())
        [method]('/auth/me')
        .auth(token, { type: 'bearer' })
        .send({
          currentPassword: password,
          id: 2,
          ...(method === 'patch' ? { name: 'New Name' } : {}),
        })
        .expect(400);
      assert.equal(users.length, 2);
      assert.equal(users[1].name, 'Other');
    });
  }
  for (const fields of [
    {},
    { name: null },
    { email: null },
    { password: null },
    { name: ' ' },
    { email: 'broken' },
    { password: 'short' },
    { password: 'x'.repeat(129) },
    { passwordHash: 'forged' },
    { tokenVersion: 0 },
  ]) {
    it(
      'rejects invalid account changes ' + JSON.stringify(fields),
      async () => {
        await request(app.getHttpServer())
          .patch('/auth/me')
          .auth(token, { type: 'bearer' })
          .send({ currentPassword: password, ...fields })
          .expect(400);
      },
    );
  }
  it('changes password, invalidates all previous tokens and permits a new login', async () => {
    const secondToken = await app.get(TokenService).issue(1);
    const newPassword = 'A new password 123!';
    await request(app.getHttpServer())
      .patch('/auth/me')
      .auth(token, { type: 'bearer' })
      .send({ currentPassword: password, password: newPassword })
      .expect(200);
    assert.equal(users[0].tokenVersion, 1);
    assert.notEqual(users[0].passwordHash, storedHash);
    for (const oldToken of [token, secondToken]) {
      await request(app.getHttpServer())
        .get('/auth/me')
        .auth(oldToken, { type: 'bearer' })
        .expect(401);
      await request(app.getHttpServer())
        .get('/transactions')
        .auth(oldToken, { type: 'bearer' })
        .expect(401);
    }
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: users[0].email, password })
      .expect(401);
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: users[0].email, password: newPassword })
      .expect(200);
    await request(app.getHttpServer())
      .get('/auth/me')
      .auth(response.body.access_token, { type: 'bearer' })
      .expect(200);
    const otherToken = await app.get(TokenService).issue(2);
    await request(app.getHttpServer())
      .get('/transactions')
      .auth(otherToken, { type: 'bearer' })
      .expect(200);
  });
  it('deletes only the authenticated account and its transactions, invalidating the token', async () => {
    const response = await request(app.getHttpServer())
      .delete('/auth/me')
      .auth(token, { type: 'bearer' })
      .send({ currentPassword: password })
      .expect(204);
    assert.equal(response.text, '');
    assert.deepEqual(
      users.map((user) => user.id),
      [2],
    );
    assert.deepEqual(
      transactions.map((row) => row.id),
      [2, 3],
    );
    await request(app.getHttpServer())
      .get('/transactions')
      .auth(token, { type: 'bearer' })
      .expect(401);
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'owner@example.com', password })
      .expect(401);
  });
  it('rolls back transaction deletion if the account changed concurrently', async () => {
    const snapshot = structuredClone({ users, transactions });
    db.user.delete = async () => {
      throw prismaError('P2025');
    };
    await request(app.getHttpServer())
      .delete('/auth/me')
      .auth(token, { type: 'bearer' })
      .send({ currentPassword: password })
      .expect(409);
    assert.deepEqual({ users, transactions }, snapshot);
  });
});
