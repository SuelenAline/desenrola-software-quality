import { currency, escapeHtml as esc } from './domain.js';

export const dashboardToday = () => new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);
export const displayDay = (value) => value.split('-').reverse().join('/');

export function financialChart(summary, mode) {
  const series = mode === 'income' ? [['income', 'Entradas']] :
    mode === 'expense' ? [['expense', 'Saídas']] : [['income', 'Entradas'], ['expense', 'Saídas']];
  const title = mode === 'income' ? 'Entradas por dia' : mode === 'expense' ? 'Saídas por dia' : 'Entradas versus saídas por dia';
  const maximum = Math.max(1, ...summary.daily.flatMap(day => series.map(([key]) => Number(day[key]))));
  const hasValues = summary.daily.some(day => series.some(([key]) => Number(day[key]) > 0));
  return `<h2>${title}</h2><p class="muted">Valores em reais (BRL). Saldo diário = entradas − saídas.</p>
    <div class="chart-legend">${series.map(([key, label]) => `<span><i class="chart-swatch ${key}"></i>${label}</span>`).join('')}</div>
    ${hasValues ? '' : '<p class="chart-empty" role="status">Sem valores de ' + (mode === 'income' ? 'entradas' : mode === 'expense' ? 'saídas' : 'entradas ou saídas') + ' neste período.</p>'}
    <div class="daily-chart" role="img" aria-label="${title}. Valores exatos disponíveis na tabela de detalhamento abaixo.">
      <div class="chart-scale"><span>${currency(maximum)}</span><span>${currency(maximum / 2)}</span><span>R$ 0</span></div>
      <div class="chart-scroll"><div class="chart-columns">${summary.daily.map(day => `<div class="chart-day"><div class="chart-bars">${series.map(([key, label]) => `<div class="chart-bar ${key}" data-height="${Number(day[key]) / maximum * 100}" title="${displayDay(day.date)} · ${label}: ${currency(day[key])}"></div>`).join('')}</div><span>${displayDay(day.date).slice(0, 5)}</span></div>`).join('')}</div></div>
    </div>
    <details class="chart-details" open><summary>Detalhamento diário</summary><div class="table-scroll"><table><caption class="muted">${esc(title)} — ${displayDay(summary.from)} a ${displayDay(summary.to)}</caption><thead><tr><th scope="col">Dia</th>${series.map(([, label]) => `<th scope="col" class="amount">${label}</th>`).join('')}${mode === 'comparison' ? '<th scope="col" class="amount">Saldo do dia</th>' : ''}</tr></thead><tbody>${summary.daily.map(day => `<tr><th scope="row">${displayDay(day.date)}</th>${series.map(([key]) => `<td class="amount">${currency(day[key])}</td>`).join('')}${mode === 'comparison' ? `<td class="amount">${currency(day.balance)}</td>` : ''}</tr>`).join('')}</tbody></table></div></details>`;
}
