import { PrismaClient } from '@prisma/client';
import { loadEnvFile } from 'node:process';

const email = process.argv[2]?.trim().toLowerCase();
if (process.argv.length !== 3 || !email?.includes('@')) {
  console.error('Uso: node scripts/promote-admin.mjs email@exemplo.com');
  process.exit(1);
}

try {
  loadEnvFile('.env');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
if (!process.env.DATABASE_URL) {
  console.error('Configure DATABASE_URL para o banco da instalação.');
  process.exit(1);
}

const prisma = new PrismaClient();
try {
  const outcome = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(69301214)::text`;
    const account = await tx.user.findUnique({
      where: { email },
      select: { id: true, role: true, active: true },
    });
    if (!account?.active) return 'missing';
    if (account.role === 'ADMIN') return 'already-admin';
    await tx.user.update({
      where: { id: account.id },
      data: { role: 'ADMIN', tokenVersion: { increment: 1 } },
    });
    return 'promoted';
  });
  if (outcome === 'promoted')
    console.log('Perfil ADMIN atribuído. Entre novamente na conta.');
  else if (outcome === 'already-admin')
    console.log('A conta já tem perfil ADMIN.');
  else {
    console.error('Nenhuma conta ativa encontrada para o e-mail informado.');
    process.exitCode = 1;
  }
} catch {
  console.error(
    'Falha ao promover a conta. Verifique a conexão e as migrações.',
  );
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
