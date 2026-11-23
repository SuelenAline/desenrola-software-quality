import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { loadEnvFile } from 'node:process';
import { it } from 'node:test';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../dist/app.module.js';
import { configureApp } from '../dist/configure-app.js';
import { PrismaService } from '../dist/prisma/prisma.service.js';

loadEnvFile('.env');
if (
  !['localhost', '127.0.0.1', '[::1]'].includes(
    new URL(process.env.DATABASE_URL).hostname,
  )
) {
  throw new Error('Este teste usa somente PostgreSQL local.');
}

it('calcula orçamentos por período e proprietário e atualiza após cada alteração', async () => {
  await withApplication(async ({ act, db, createUser }) => {
    const owner = await createUser('Budget owner');
    const other = await createUser('Other owner');
    const { body: category } = await act(owner, 'post', '/categories')
      .send({ name: 'Mercado' })
      .expect(201);
    const { body: otherCategory } = await act(other, 'post', '/categories')
      .send({ name: 'Mercado' })
      .expect(201);
    const budget = {
      categoryId: category.id,
      month: 12,
      year: 2026,
      amount: 100,
    };
    await act(owner, 'post', '/limits')
      .send({ ...budget, amount: 0 })
      .expect(400);
    await act(owner, 'post', '/limits')
      .send({ ...budget, month: 13 })
      .expect(400);
    await act(owner, 'post', '/limits')
      .send({ ...budget, amount: 1.001 })
      .expect(400);
    const { body: limit } = await act(owner, 'post', '/limits')
      .send(budget)
      .expect(201);
    assert.equal(
      (await db.spendingLimit.findUniqueOrThrow({ where: { id: limit.id } }))
        .userId,
      owner.user.id,
    );
    await act(owner, 'post', '/limits').send(budget).expect(409);
    await act(other, 'post', '/limits').send(budget).expect(404);
    await act(other, 'get', '/limits').expect(200, []);
    await act(other, 'put', `/limits/${limit.id}`)
      .send({ ...budget, categoryId: otherCategory.id })
      .expect(404);

    const assertBudget = async (
      spent,
      available,
      percentage,
      status,
      exceeded = '0.00',
      amount = '100.00',
    ) => {
      const { body } = await act(owner, 'get', '/limits').expect(200);
      assert.equal(body.length, 1);
      assert.deepEqual(body[0], {
        ...limit,
        amount,
        category: { name: 'Mercado' },
        spent,
        available,
        percentage,
        status,
        exceeded,
      });
    };
    await assertBudget('0.00', '100.00', '0.00', 'ok');
    const expense = {
      description: 'Compra',
      type: 'Despesa',
      amount: 79.99,
      categoryId: category.id,
    };
    const add = async (session, data, createdAt) => {
      const { body } = await act(session, 'post', '/transactions')
        .send(data)
        .expect(201);
      await db.transaction.update({
        where: { id: body.id },
        data: { createdAt: new Date(createdAt) },
      });
      return body.id;
    };

    const start = '2026-12-01T03:00:00.000Z';
    const id = await add(owner, expense, start);
    await add(owner, { ...expense, type: 'Receita' }, start);
    await add(owner, expense, '2026-12-01T02:59:59.999Z');
    await add(owner, expense, '2027-01-01T03:00:00.000Z');
    await add(other, { ...expense, categoryId: otherCategory.id }, start);
    await assertBudget('79.99', '20.01', '79.99', 'ok');
    await act(owner, 'put', `/transactions/${id}`)
      .send({ ...expense, amount: 80 })
      .expect(200);
    await assertBudget('80.00', '20.00', '80.00', 'warning');
    await act(owner, 'put', `/transactions/${id}`)
      .send({ ...expense, amount: 100 })
      .expect(200);
    await assertBudget('100.00', '0.00', '100.00', 'warning');
    await act(owner, 'put', `/limits/${limit.id}`)
      .send({ ...budget, amount: 99.99 })
      .expect(200);
    await assertBudget(
      '100.00',
      '-0.01',
      '100.01',
      'exceeded',
      '0.01',
      '99.99',
    );
    await act(owner, 'delete', `/transactions/${id}`).expect(200);
    await assertBudget('0.00', '99.99', '0.00', 'ok', '0.00', '99.99');
  });
});

it('autoriza apenas ADMIN, preserva dados, revoga sessões e consulta atividades', async () => {
  await withApplication(async ({ http, act, db, createUser, password }) => {
    let admin = await createUser('Admin AC4');
    const user = await createUser('Pessoa AC4');
    assert.equal(user.user.role, 'USER');
    for (const path of [
      '/admin/users',
      '/admin/summary',
      '/admin/activities',
    ]) {
      await http.get(path).expect(401);
      await act(user, 'get', path).expect(403);
    }
    await act(user, 'patch', `/admin/users/${admin.user.id}/status`)
      .send({ active: false })
      .expect(403);
    const promotion = execFileSync(
      process.execPath,
      ['scripts/promote-admin.mjs', admin.user.email.toUpperCase()],
      { encoding: 'utf8' },
    );
    assert.match(promotion, /Perfil ADMIN atribuído/);
    await act(admin, 'get', '/admin/summary').expect(401);
    const login = await http
      .post('/auth/login')
      .send({ email: admin.user.email, password })
      .expect(200);
    admin = login.body;
    const { body: profile } = await act(admin, 'get', '/auth/me').expect(200);
    assert.equal(profile.role, 'ADMIN');
    const { body: initial } = await act(admin, 'get', '/admin/summary').expect(
      200,
    );

    const { body: category } = await act(user, 'post', '/categories')
      .send({ name: 'Despesas AC4' })
      .expect(201);
    const expense = {
      description: 'Detalhe privado',
      amount: 10,
      type: 'Despesa',
      categoryId: category.id,
    };
    const { body: item } = await act(user, 'post', '/transactions')
      .send(expense)
      .expect(201);
    await act(user, 'put', `/transactions/${item.id}`)
      .send({ ...expense, amount: 20 })
      .expect(200);
    await act(user, 'delete', `/transactions/${item.id}`).expect(200);
    const { body: retained } = await act(user, 'post', '/transactions')
      .send(expense)
      .expect(201);
    const accounts = async (search) =>
      (await act(admin, 'get', '/admin/users').query({ search }).expect(200))
        .body;
    for (const term of ['pessoa ac4', user.user.email.toUpperCase()]) {
      const matches = await accounts(term);
      const match = matches.find((row) => row.id === user.user.id);
      assert.deepEqual(match, {
        ...user.user,
        active: true,
        _count: { transactions: 1 },
      });
    }
    assert.deepEqual(await accounts(`%_${user.user.email}`), []);

    const status = (session, id, active) =>
      act(session, 'patch', `/admin/users/${id}/status`).send({ active });
    await status(admin, admin.user.id, false).expect(409);
    await status(admin, user.user.id, false).expect(200);
    await status(admin, user.user.id, false).expect(200);
    assert.equal((await accounts(user.user.email))[0].active, false);
    await act(user, 'get', '/transactions').expect(401);
    await act(user, 'get', '/limits').expect(401);
    await http
      .post('/auth/login')
      .send({ email: user.user.email, password })
      .expect(401);
    assert.ok(await db.transaction.findUnique({ where: { id: retained.id } }));
    await act(admin, 'get', '/admin/summary').expect(200, {
      totalUsers: initial.totalUsers,
      activeUsers: initial.activeUsers - 1,
      inactiveUsers: initial.inactiveUsers + 1,
      totalTransactions: initial.totalTransactions + 1,
    });

    await status(admin, user.user.id, true).expect(200);
    assert.equal((await accounts(user.user.email))[0].active, true);
    await act(user, 'get', '/transactions').expect(401);
    const { body: session } = await http
      .post('/auth/login')
      .send({ email: user.user.email, password })
      .expect(200);
    await act(session, 'get', '/transactions').expect(200);

    const { body: history } = await act(
      admin,
      'get',
      '/admin/activities',
    ).expect(200);
    const own = history.items.filter((row) =>
      [admin.user.id, user.user.id].includes(row.actorId),
    );
    assert.deepEqual(
      own.map(({ action, recordId, actorId }) => [action, recordId, actorId]),
      [
        ['ACCOUNT_ACTIVATED', user.user.id, admin.user.id],
        ['ACCOUNT_DEACTIVATED', user.user.id, admin.user.id],
        ['TRANSACTION_CREATED', retained.id, user.user.id],
        ['TRANSACTION_DELETED', item.id, user.user.id],
        ['TRANSACTION_UPDATED', item.id, user.user.id],
        ['TRANSACTION_CREATED', item.id, user.user.id],
        ['CATEGORY_CREATED', category.id, user.user.id],
      ],
    );
    assert.ok(
      own.every(
        (row, index) => !index || row.createdAt <= own[index - 1].createdAt,
      ),
    );
    for (const row of own)
      assert.deepEqual(Object.keys(row).sort(), [
        'action',
        'actor',
        'actorId',
        'createdAt',
        'id',
        'recordId',
      ]);

    const secondAdmin = await createUser('Segundo admin AC4');
    await db.user.update({
      where: { id: secondAdmin.user.id },
      data: { role: 'ADMIN' },
    });
    const [first, second] = await Promise.all([
      status(admin, secondAdmin.user.id, false),
      status(secondAdmin, admin.user.id, false),
    ]);
    assert.equal(
      [first, second].filter((response) => response.status === 200).length,
      1,
    );
    assert.ok(
      [401, 403].includes(first.status === 200 ? second.status : first.status),
    );
    const winner = first.status === 200 ? admin : secondAdmin;
    const activeAdmins = await db.user.count({
      where: { id: { in: [admin.user.id, secondAdmin.user.id] }, active: true },
    });
    assert.equal(activeAdmins, 1);
    if (
      (await db.user.count({ where: { role: 'ADMIN', active: true } })) === 1
    ) {
      await act(winner, 'delete', '/auth/me')
        .send({ currentPassword: password })
        .expect(409);
    }
    await act(session, 'delete', '/auth/me')
      .send({ currentPassword: password })
      .expect(204);
    const afterDeletion = (
      await act(winner, 'get', '/admin/activities').expect(200)
    ).body.items;
    const deletedActor = afterDeletion.find(
      (row) => row.actorId === user.user.id,
    );
    assert.equal(deletedActor.actor, null);
  });
});

async function withApplication(run) {
  const password = randomUUID();
  const ids = [];
  const module = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = module.createNestApplication();
  configureApp(app);
  const db = app.get(PrismaService);
  try {
    await app.init();
    const http = request(app.getHttpServer());
    const act = (session, method, path) =>
      http[method](path).auth(session.access_token, { type: 'bearer' });
    const createUser = async (name) => {
      const email = `ac4-${randomUUID()}@example.com`;
      const { body } = await http
        .post('/auth/register')
        .send({ name, email, password })
        .expect(201);
      ids.push(body.user.id);
      return body;
    };
    await run({ http, act, db, createUser, password });
  } finally {
    await db.$transaction([
      db.activity.deleteMany({ where: { actorId: { in: ids } } }),
      db.transaction.deleteMany({ where: { userId: { in: ids } } }),
      db.user.deleteMany({ where: { id: { in: ids } } }),
    ]);
    await app.close();
  }
}
