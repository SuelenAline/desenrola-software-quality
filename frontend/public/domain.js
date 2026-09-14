export function escapeHtml(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ],
  );
}

export function parseAmount(value) {
  const input = String(value).trim();
  if (!/^\d{1,8}([.,]\d{1,2})?$/.test(input))
    throw new Error(
      "Informe um valor entre 0 e 99.999.999,99, com até duas casas decimais e sem separador de milhar.",
    );
  const amount = Number(input.replace(",", "."));
  if (!Number.isFinite(amount) || amount < 0 || amount > 99999999.99)
    throw new Error("Valor fora do limite permitido.");
  return amount;
}

export const currency = (value) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    value,
  );
export function totals(transactions) {
  let income = 0,
    expense = 0;
  for (const transaction of transactions) {
    const cents = Math.round(Number(transaction.amount) * 100);
    if (transaction.type === "Receita") income += cents;
    else if (transaction.type === "Despesa") expense += cents;
  }
  return {
    income: income / 100,
    expense: expense / 100,
    balance: (income - expense) / 100,
  };
}
export function filterTransactions(transactions, search = "", type = "") {
  const normalized = search.trim().toLocaleLowerCase("pt-BR");
  return transactions.filter(
    (item) =>
      (!type || item.type === type) &&
      item.description.toLocaleLowerCase("pt-BR").includes(normalized),
  );
}
