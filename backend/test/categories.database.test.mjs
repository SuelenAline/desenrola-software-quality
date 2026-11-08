import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { loadEnvFile } from 'node:process';
import { it } from 'node:test';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../dist/app.module.js';
import { configureApp } from '../dist/configure-app.js';
import { PrismaService } from '../dist/prisma/prisma.service.js';

loadEnvFile('.env');
if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(process.env.DATABASE_URL).hostname)) {
  throw new Error('Este teste usa somente PostgreSQL local.');
}

it('persists private categories, prevents cross-account use and clears assignments', async () => {
  const run = randomUUID();
  const emails = [0, 1].map(index => `category-${run}-${index}@example.com`);
  let app, db;
  try {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
    db = app.get(PrismaService);
    const http = request(app.getHttpServer());
    const sessions = [];
    for (const email of emails) {
      const { body } = await http.post('/auth/register').send({ name: 'Category test', email, password: run }).expect(201);
      sessions.push(body);
    }
    const [a, b] = sessions.map(session => session.access_token);
    const { body: category } = await http.post('/categories').auth(a, { type: 'bearer' }).send({ name: ' Alimentação ' }).expect(201);
    await http.post('/categories').auth(a, { type: 'bearer' }).send({ name: 'ALIMENTAÇÃO' }).expect(409);
    await http.get('/categories').auth(a, { type: 'bearer' }).expect(200, [category]);
    await http.get('/categories').auth(b, { type: 'bearer' }).expect(200, []);
    await http.post('/categories').auth(b, { type: 'bearer' }).send({ name: 'Alimentação' }).expect(201);
    const data = { description: 'Mercado', type: 'Despesa', amount: 12.50, categoryId: category.id };
    await http.post('/transactions').auth(b, { type: 'bearer' }).send(data).expect(404);
    const { body: item } = await http.post('/transactions').auth(a, { type: 'bearer' }).send(data).expect(201);
    const { body: list } = await http.get('/transactions').auth(a, { type: 'bearer' }).expect(200);
    assert.equal(list[0].categoryId, category.id);
    await http.put(`/transactions/${item.id}`).auth(a, { type: 'bearer' }).send({ ...data, categoryId: null }).expect(200);
    assert.equal((await db.transaction.findUnique({ where: { id: item.id } })).categoryId, null);
  } finally {
    if (db) {
      await db.$transaction(async tx => {
        const users = await tx.user.findMany({ where: { email: { in: emails } }, select: { id: true } });
        await tx.transaction.deleteMany({ where: { userId: { in: users.map(user => user.id) } } });
        await tx.user.deleteMany({ where: { email: { in: emails } } });
      });
    }
    await app?.close();
  }
});
