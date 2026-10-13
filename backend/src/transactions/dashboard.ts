import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DashboardQueryDto } from './dashboard.dto.js';

const DAY = 86_400_000;
const OFFSET = 3 * 60 * 60 * 1000;
const key = (date: Date) => date.toISOString().slice(0, 10);

export function dashboardRange(query: DashboardQueryDto) {
  const selected = new Date(`${query.date}T00:00:00.000Z`);
  if (!Number.isFinite(selected.getTime()) || key(selected) !== query.date ||
      selected.getUTCFullYear() < 1900 || selected.getUTCFullYear() > 9998) {
    throw new BadRequestException('Informe uma data válida entre 1900 e 9998.');
  }
  const start = new Date(selected);
  if (query.period === 'week') start.setUTCDate(start.getUTCDate() - (start.getUTCDay() + 6) % 7);
  if (query.period === 'month') start.setUTCDate(1);
  const end = new Date(start);
  if (query.period === 'month') end.setUTCMonth(end.getUTCMonth() + 1);
  else end.setUTCDate(end.getUTCDate() + (query.period === 'week' ? 7 : 1));
  return {
    start: new Date(start.getTime() + OFFSET),
    end: new Date(end.getTime() + OFFSET),
    from: key(start),
    to: key(new Date(end.getTime() - DAY)),
  };
}

export function dashboardSummary(
  range: ReturnType<typeof dashboardRange>,
  transactions: { createdAt: Date; type: string; amount: Prisma.Decimal }[],
) {
  const days = new Map<string, { income: Prisma.Decimal; expense: Prisma.Decimal }>();
  for (let time = range.start.getTime(); time < range.end.getTime(); time += DAY) {
    days.set(key(new Date(time - OFFSET)), { income: new Prisma.Decimal(0), expense: new Prisma.Decimal(0) });
  }
  for (const transaction of transactions) {
    const day = days.get(key(new Date(transaction.createdAt.getTime() - OFFSET)));
    if (!day) continue;
    if (transaction.type === 'Receita') day.income = day.income.plus(transaction.amount);
    if (transaction.type === 'Despesa') day.expense = day.expense.plus(transaction.amount);
  }
  let income = new Prisma.Decimal(0);
  let expense = new Prisma.Decimal(0);
  const daily = [...days].map(([date, amounts]) => {
    income = income.plus(amounts.income);
    expense = expense.plus(amounts.expense);
    return { date, income: amounts.income.toFixed(2), expense: amounts.expense.toFixed(2), balance: amounts.income.minus(amounts.expense).toFixed(2) };
  });
  return { from: range.from, to: range.to, income: income.toFixed(2), expense: expense.toFixed(2), balance: income.minus(expense).toFixed(2), daily };
}
