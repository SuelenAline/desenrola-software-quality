import {
  escapeHtml as esc,
  parseAmount,
  currency,
  totals,
  filterTransactions,
} from "./domain.js";

const app = document.querySelector("#app");
const dialog = document.querySelector("#confirmation");
let user = null;
let token = sessionStorage.getItem("desenrola.token") || "";
let generation = 0;
let toastTimeout;
const paths = {
  wallet:
    '<path d="M20 8V6a2 2 0 0 0-2-2H5a3 3 0 0 0 0 6h15v10H5a3 3 0 0 1-3-3V7m18 6h-5v4h5"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  arrow: '<path d="M7 17 17 7M7 7h10v10"/>',
  down: '<path d="m7 7 10 10M7 17h10V7"/>',
  logout: '<path d="M9 4H4v16h5m5-12 4 4-4 4m-5-4h9"/>',
  edit: '<path d="m15 5 4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15v5Z"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3m-10 0 1 15h12l1-15M10 10v7m4-7v7"/>',
  search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4m-4 5v2"/>',
  back: '<path d="m10 5-7 7 7 7M3 12h18"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
};
const icon = (name) =>
  `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.wallet}</svg>`;
const brand = () =>
  `<a class="brand" href="#/transacoes" aria-label="Desenrola, início"><img src="/favicon.svg" alt="" width="38" height="38">desenrola<span>®</span></a>`;
const date = (value) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
function notify(message) {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.classList.add("visible");
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove("visible"), 6000);
}
function logout(message = "") {
  token = "";
  user = null;
  sessionStorage.removeItem("desenrola.token");
  if (dialog.open) dialog.close();
  if (location.hash === "#/login") render();
  else location.hash = "/login";
  if (message) notify(message);
}
async function api(path, { method = "GET", data, authenticated = true } = {}) {
  const requestToken = token;
  let response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      headers: {
        ...(data ? { "Content-Type": "application/json" } : {}),
        ...(authenticated && token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: data ? JSON.stringify(data) : undefined,
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    throw new Error(
      "Não foi possível conectar. Verifique sua conexão e tente novamente.",
    );
  }
  if (authenticated && token !== requestToken)
    throw new Error("A sess?o mudou. Tente novamente.");
  const body =
    response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    const message = Array.isArray(body?.message)
      ? body.message.join(" • ")
      : body?.message || "Não foi possível concluir a operação.";
    if (
      response.status === 401 &&
      authenticated &&
      message !== "Senha atual inválida."
    )
      logout("Sua sessão terminou. Entre novamente para continuar.");
    throw new Error(
      response.status === 429
        ? "Muitas tentativas. Aguarde um minuto antes de tentar novamente."
        : message,
    );
  }
  return body;
}
function bindForm(form, action) {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = form.querySelector('[type="submit"]');
    if (button.disabled) return;
    const error = form.querySelector(".form-error");
    error.hidden = true;
    const label = button.innerHTML;
    button.disabled = true;
    button.textContent = "Aguarde…";
    try {
      await action(new FormData(form));
    } catch (failure) {
      error.textContent = failure.message;
      error.hidden = false;
      error.focus();
    } finally {
      button.disabled = false;
      button.innerHTML = label;
    }
  });
}
const errorBox = '<p class="form-error" role="alert" tabindex="-1" hidden></p>';
function field(
  label,
  name,
  {
    type = "text",
    value = "",
    placeholder = "",
    required = true,
    autocomplete = "",
    min = "",
    max = "",
  } = {},
) {
  return `<label class="field">${label}<input name="${name}" type="${type}" value="${esc(value)}" placeholder="${esc(placeholder)}" ${required ? "required" : ""} ${autocomplete ? `autocomplete="${autocomplete}"` : ""} ${min ? `minlength="${min}"` : ""} ${max ? `maxlength="${max}"` : ""}></label>`;
}
function authPage(register) {
  document.title = `${register ? "Criar conta" : "Entrar"} · Desenrola`;
  app.innerHTML = `<main id="main" class="auth-layout">
    <aside class="auth-story">${brand()}<div class="story-content"><span class="eyebrow light">MENOS COMPLICAÇÃO. MAIS TRANQUILIDADE.</span><h1>Seu dinheiro,<br>com <em>clareza.</em></h1><p>Um lugar para organizar suas finanças<br>e abrir espaço para o que importa.</p>
      <div class="story-art" aria-hidden="true"><div class="orbit orbit-one"></div><div class="orbit orbit-two"></div><div class="paper"><span class="paper-dot"></span><span>Sua vida mais leve</span><div class="art-bars"><i></i><i></i><i></i><i></i><i></i><i></i></div><div class="paper-bottom">Um passo de cada vez. ${icon("arrow")}</div></div><div class="art-check">${icon("check")}</div></div>
    </div><div class="story-footer">Organize hoje. Respire melhor amanhã.<span>01 — 05</span></div></aside>
    <section class="auth-form-side"><div class="mobile-brand">${brand()}</div><div class="auth-form-wrap"><span class="eyebrow">${register ? "SEU PRÓXIMO PASSO" : "BOM TER VOCÊ POR AQUI"}</span><h2>${register ? "Comece a desenrolar." : "Bem-vindo de volta."}</h2><p class="muted">${register ? "Crie sua conta e cuide do seu dinheiro com simplicidade." : "Entre na sua conta para acompanhar suas finanças."}</p>
      <form id="auth-form">${register ? field("Seu nome", "name", { placeholder: "Como podemos chamar você?", autocomplete: "name", min: 2, max: 100 }) : ""}
      ${field("E-mail", "email", { type: "email", placeholder: "voce@exemplo.com", autocomplete: "email", max: 254 })}
      ${field("Senha", "password", { type: "password", placeholder: register ? "Pelo menos 8 caracteres" : "Sua senha", autocomplete: register ? "new-password" : "current-password", min: 8, max: 128 })}
      ${register ? field("Confirme sua senha", "confirmPassword", { type: "password", placeholder: "Digite sua senha novamente", autocomplete: "new-password", min: 8, max: 128 }) : ""}
      ${errorBox}<button class="button primary full" type="submit">${register ? "Criar minha conta" : "Entrar na minha conta"} ${icon("arrow")}</button></form>
      <p class="auth-switch">${register ? "Já tem uma conta?" : "Ainda não tem uma conta?"} <a href="#/${register ? "login" : "cadastro"}">${register ? "Entrar" : "Cadastre-se"}</a></p><div class="security-note">${icon("lock")} Suas transações, no seu espaço.</div>
    </div><footer class="auth-footnote">Desenrola · Finanças pessoais, sem complicação.</footer></section></main>`;
  bindForm(document.querySelector("#auth-form"), async (form) => {
    const data = { email: form.get("email"), password: form.get("password") };
    if (register) {
      if (data.password !== form.get("confirmPassword"))
        throw new Error("As senhas não coincidem. Confira e tente novamente.");
      data.name = form.get("name");
    }
    const session = await api(`/auth/${register ? "register" : "login"}`, {
      method: "POST",
      data,
      authenticated: false,
    });
    token = session.access_token;
    user = session.user;
    sessionStorage.setItem("desenrola.token", token);
    location.hash = "/transacoes";
    notify(
      register
        ? "Conta criada! Seu novo começo está aqui."
        : "Você entrou. Bem-vindo de volta!",
    );
  });
}
function shell(active, content) {
  app.innerHTML = `<div class="workspace"><aside class="sidebar">${brand()}<div class="nav-label">SEU ESPAÇO</div><nav aria-label="Navegação principal"><a class="nav-link ${active === "transactions" ? "active" : ""}" ${active === "transactions" ? 'aria-current="page"' : ""} href="#/transacoes">${icon("wallet")} Minhas transações</a><a class="nav-link ${active === "profile" ? "active" : ""}" ${active === "profile" ? 'aria-current="page"' : ""} href="#/perfil">${icon("user")} Meu perfil</a></nav><div class="sidebar-note"><span class="little-spark">✳</span><p>Pequenos hábitos.<br>Grandes mudanças.</p><span>Seu futuro começa no presente.</span></div><div class="sidebar-bottom"><div class="avatar">${esc(user.name.trim().charAt(0).toUpperCase())}</div><div class="user-caption"><strong>${esc(user.name)}</strong><span>Minha conta pessoal</span></div><button class="icon-button" id="logout" aria-label="Sair da conta" title="Sair da conta">${icon("logout")}</button></div></aside><div class="main-column"><header class="topbar"><span>Uma vida financeira mais leve.</span><span class="today">${new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", year: "numeric" }).format(new Date())}</span></header><main id="main" tabindex="-1" class="page">${content}</main><footer class="workspace-footer">Feito para simplificar o seu dia a dia.<span>desenrola.</span></footer></div></div>`;
  document.querySelector("#logout").onclick = () =>
    logout("Você saiu da conta. Até a próxima!");
}
function heading(kicker, title, description, action = "") {
  return `<div class="page-heading"><div><span class="eyebrow">${kicker}</span><h1>${title}</h1><p class="muted">${description}</p></div>${action}</div>`;
}
async function transactionsPage(current) {
  document.title = "Minhas transações · Desenrola";
  const header = heading(
    "CADA MOVIMENTO CONTA",
    "Minhas transações",
    "Acompanhe o que entra, o que sai e o que fica.",
    '<a class="button primary" href="#/transacoes/nova">' +
      icon("plus") +
      " Nova transação</a>",
  );
  shell(
    "transactions",
    header +
      '<div class="panel loading" role="status">Buscando suas transações…</div>',
  );
  const transactions = await api("/transactions");
  if (current !== generation) return;
  transactions.sort((a, b) => b.id - a.id);
  const sum = totals(transactions);
  shell(
    "transactions",
    header +
      `<section class="summary" aria-label="Resumo financeiro"><article class="summary-card balance"><div><span>Saldo total</span>${icon("wallet")}</div><strong>${currency(sum.balance)}</strong><small>Receitas menos despesas</small></article><article class="summary-card"><div><span>Receitas</span><span class="stat-icon income">${icon("arrow")}</span></div><strong>${currency(sum.income)}</strong><small>O que entrou na sua conta</small></article><article class="summary-card"><div><span>Despesas</span><span class="stat-icon expense">${icon("down")}</span></div><strong>${currency(sum.expense)}</strong><small>O que saiu da sua conta</small></article></section>
    <section class="panel transactions-panel"><div class="section-title"><div><h2>Seu histórico</h2><p>Todos os seus movimentos, em um só lugar.</p></div><span class="count-badge">${transactions.length} ${transactions.length === 1 ? "transação" : "transações"}</span></div><div class="filters"><label class="search-field">${icon("search")}<input id="search" aria-label="Buscar transações" placeholder="Buscar por descrição…" type="search"></label><label class="filter-type"><span>Tipo</span><select id="type-filter" aria-label="Filtrar por tipo"><option value="">Todos os tipos</option><option>Receita</option><option>Despesa</option></select></label></div><div id="transaction-list"></div><div class="table-footer">Valores em reais (BRL)<span id="shown-count" aria-live="polite"></span></div></section>`,
  );
  const draw = () => {
    const filtered = filterTransactions(
      transactions,
      document.querySelector("#search").value,
      document.querySelector("#type-filter").value,
    );
    document.querySelector("#shown-count").textContent =
      `${filtered.length} de ${transactions.length} transações`;
    const target = document.querySelector("#transaction-list");
    if (!filtered.length) {
      target.innerHTML = `<div class="empty-state"><div class="empty-icon">${icon("wallet")}</div><h3>${transactions.length ? "Nenhuma transação encontrada" : "Seu primeiro passo começa aqui"}</h3><p>${transactions.length ? "Tente outra descrição ou altere o filtro." : "Cadastre uma receita ou despesa para começar a organizar suas finanças."}</p>${transactions.length ? "" : '<a class="button secondary" href="#/transacoes/nova">' + icon("plus") + " Cadastrar primeira transação</a>"}</div>`;
      return;
    }
    target.innerHTML = `<div class="table-scroll"><table><thead><tr><th>Descrição</th><th>Tipo</th><th>Registrada em</th><th class="amount">Valor</th><th class="actions">Ações</th></tr></thead><tbody>${filtered.map((item) => `<tr><td><div class="description-cell"><span class="transaction-symbol ${item.type === "Receita" ? "income" : "expense"}">${icon(item.type === "Receita" ? "arrow" : "down")}</span><strong>${esc(item.description)}</strong></div></td><td><span class="pill ${item.type === "Receita" ? "income" : "expense"}">${esc(item.type)}</span></td><td class="date-cell">${date(item.createdAt)}</td><td class="amount ${item.type === "Receita" ? "positive" : ""}">${item.type === "Receita" ? "+" : "−"} ${currency(Number(item.amount))}</td><td><div class="row-actions"><a class="icon-button" href="#/transacoes/editar/${item.id}" aria-label="Editar ${esc(item.description)}" title="Editar">${icon("edit")}</a><button class="icon-button delete-transaction" data-id="${item.id}" aria-label="Excluir ${esc(item.description)}" title="Excluir">${icon("trash")}</button></div></td></tr>`).join("")}</tbody></table></div>`;
    target.querySelectorAll(".delete-transaction").forEach(
      (button) =>
        (button.onclick = () => {
          const item = transactions.find(
            (transaction) => transaction.id === Number(button.dataset.id),
          );
          confirmDialog({
            title: "Excluir transação?",
            description: `“${item.description}” será removida do seu histórico. Esta ação não pode ser desfeita.`,
            label: "Excluir transação",
            action: async () => {
              await api(`/transactions/${item.id}`, { method: "DELETE" });
              notify("Transação excluída.");
              render();
            },
          });
        }),
    );
  };
  document.querySelector("#search").oninput = draw;
  document.querySelector("#type-filter").onchange = draw;
  draw();
}
async function transactionForm(id, current) {
  document.title = `${id ? "Editar" : "Nova"} transação · Desenrola`;
  let item = { description: "", amount: "", type: "Despesa" };
  if (id) {
    shell(
      "transactions",
      '<div class="panel loading" role="status">Carregando transação…</div>',
    );
    item = await api(`/transactions/${id}`);
    if (current !== generation) return;
  }
  shell(
    "transactions",
    `<a class="back-link" href="#/transacoes">${icon("back")} Voltar para minhas transações</a>${heading("ORGANIZAÇÃO EM CADA DETALHE", id ? "Editar transação" : "Nova transação", id ? "Atualize os detalhes deste movimento." : "Registre um movimento e mantenha suas finanças em dia.")}
    <div class="form-layout"><section class="panel form-panel"><h2>Detalhes da transação</h2><p class="muted">Preencha as informações abaixo.</p><form id="transaction-form"><fieldset class="type-options"><legend>Tipo de transação</legend>${["Receita", "Despesa"].map((type) => `<label><input type="radio" name="type" value="${type}" ${item.type === type ? "checked" : ""}> <span>${icon(type === "Receita" ? "arrow" : "down")}${type}</span></label>`).join("")}</fieldset>
    ${field("Descrição", "description", { value: item.description, placeholder: "Ex.: mercado, salário, conta de luz", max: 500 })}
    <label class="field">Valor<div class="money-input"><span>R$</span><input name="amount" aria-label="Valor" inputmode="decimal" value="${esc(String(item.amount).replace(".", ","))}" placeholder="0,00" required aria-describedby="amount-help"></div><small id="amount-help">Use até duas casas decimais, sem separador de milhar.</small></label>${errorBox}<div class="form-actions"><a class="button secondary" href="#/transacoes">Cancelar</a><button class="button primary" type="submit">${icon("check")} ${id ? "Salvar alterações" : "Cadastrar transação"}</button></div></form></section><aside class="tip-card"><span class="tip-icon">${icon("wallet")}</span><h3>Um hábito que faz a diferença.</h3><p>Registrar os pequenos movimentos ajuda você a enxergar o todo.</p><hr><p class="tip-caption">A transação fica vinculada à sua conta e aparece no seu histórico assim que for salva.</p></aside></div>`,
  );
  bindForm(document.querySelector("#transaction-form"), async (form) => {
    const description = form.get("description").trim();
    if (!description)
      throw new Error("Informe uma descrição para a transação.");
    await api(id ? `/transactions/${id}` : "/transactions", {
      method: id ? "PUT" : "POST",
      data: {
        description,
        amount: parseAmount(form.get("amount")),
        type: form.get("type"),
      },
    });
    location.hash = "/transacoes";
    notify(id ? "Transação atualizada." : "Transação cadastrada!");
  });
}
function profilePage() {
  document.title = "Meu perfil · Desenrola";
  shell(
    "profile",
    heading(
      "UM ESPAÇO QUE É SEU",
      "Meu perfil",
      "Cuide dos seus dados e da segurança da sua conta.",
    ) +
      `<div class="profile-layout"><aside class="panel profile-card"><div class="profile-avatar">${esc(user.name.trim().charAt(0).toUpperCase())}</div><h2>${esc(user.name)}</h2><p>${esc(user.email)}</p><span class="pill income">Conta pessoal</span><div class="member-since">No Desenrola desde<br><strong>${date(user.createdAt)}</strong></div></aside><div class="profile-sections"><section class="panel form-panel"><h2>Dados pessoais</h2><p class="muted">Mantenha suas informações atualizadas.</p><form id="profile-form">${field("Nome", "name", { value: user.name, autocomplete: "name", min: 2, max: 100 })}${field("E-mail", "email", { type: "email", value: user.email, autocomplete: "email", max: 254 })}<div class="form-divider"></div><h3>Segurança da conta</h3>${field("Nova senha (opcional)", "password", { type: "password", placeholder: "Preencha apenas para trocar sua senha", autocomplete: "new-password", required: false, min: 8, max: 128 })}${field("Confirme a nova senha", "confirmPassword", { type: "password", autocomplete: "new-password", required: false, min: 8, max: 128 })}<p class="field-help">Ao trocar a senha, será necessário entrar novamente.</p>${field("Senha atual", "currentPassword", { type: "password", placeholder: "Confirme sua senha para salvar", autocomplete: "current-password", min: 8, max: 128 })}${errorBox}<div class="form-actions"><button class="button primary" type="submit">Salvar alterações</button></div></form></section><section class="panel danger-zone"><div><h2>Excluir minha conta</h2><p>A exclusão é permanente e também remove todas as suas transações.</p></div><button class="button danger-outline" id="delete-account">Excluir conta</button></section></div></div>`,
  );
  bindForm(document.querySelector("#profile-form"), async (form) => {
    const data = { currentPassword: form.get("currentPassword") };
    const name = form.get("name").trim();
    const email = form.get("email").trim().toLowerCase();
    if (name !== user.name) data.name = name;
    if (email !== user.email) data.email = email;
    if (form.get("password") !== form.get("confirmPassword"))
      throw new Error("As novas senhas não coincidem.");
    if (form.get("password")) data.password = form.get("password");
    if (Object.keys(data).length === 1)
      throw new Error("Altere pelo menos uma informação antes de salvar.");
    const updated = await api("/auth/me", { method: "PATCH", data });
    if (data.password)
      return logout("Senha alterada. Entre novamente com sua nova senha.");
    user = updated;
    profilePage();
    notify("Seu perfil foi atualizado.");
  });
  document.querySelector("#delete-account").onclick = () =>
    confirmDialog({
      title: "Excluir sua conta?",
      description:
        "Sua conta e todas as suas transações serão excluídas permanentemente. Confirme sua senha atual para continuar.",
      label: "Excluir minha conta",
      password: true,
      action: async (currentPassword) => {
        await api("/auth/me", { method: "DELETE", data: { currentPassword } });
        logout("Sua conta foi excluída.");
      },
    });
}
function confirmDialog({
  title,
  description,
  label,
  password = false,
  action,
}) {
  dialog.innerHTML = `<form id="confirm-form"><span class="dialog-icon">${icon("trash")}</span><h2 id="dialog-title">${esc(title)}</h2><p>${esc(description)}</p>${password ? field("Senha atual", "currentPassword", { type: "password", autocomplete: "current-password", min: 8, max: 128 }) : ""}${errorBox}<div class="form-actions"><button type="button" class="button secondary" id="cancel-dialog">Cancelar</button><button type="submit" class="button danger">${esc(label)}</button></div></form>`;
  const cancel = document.querySelector("#cancel-dialog");
  cancel.onclick = () => dialog.close();
  dialog.oncancel = (event) => {
    if (dialog.querySelector('[type="submit"]').disabled)
      event.preventDefault();
  };
  bindForm(document.querySelector("#confirm-form"), async (form) => {
    cancel.disabled = true;
    try {
      await action(form.get("currentPassword"));
      dialog.close();
    } finally {
      cancel.disabled = false;
    }
  });
  dialog.showModal();
  cancel.focus();
}
async function render() {
  const current = ++generation;
  const route = location.hash.slice(1) || "/transacoes";
  if (!token) {
    authPage(route === "/cadastro");
    return;
  }
  if (!user) {
    app.innerHTML =
      '<main id="main" class="boot" role="status">Preparando seu espaço…</main>';
    try {
      user = await api("/auth/me");
    } catch (error) {
      if (token)
        app.innerHTML = `<main id="main" class="boot"><h1>Não conseguimos carregar sua conta.</h1><p role="alert">${esc(error.message)}</p><button id="retry" class="button primary">Tentar novamente</button><button id="exit" class="button secondary">Voltar para entrar</button></main>`;
      document.querySelector("#retry")?.addEventListener("click", render);
      document
        .querySelector("#exit")
        ?.addEventListener("click", () => logout());
      return;
    }
    if (current !== generation) return;
  }
  try {
    if (route === "/perfil") profilePage();
    else if (route === "/transacoes/nova") await transactionForm(null, current);
    else if (/^\/transacoes\/editar\/[1-9]\d*$/.test(route))
      await transactionForm(Number(route.split("/").pop()), current);
    else await transactionsPage(current);
  } catch (error) {
    if (current !== generation || !token) return;
    shell(
      "transactions",
      `<div class="panel empty-state"><h1>Não foi possível carregar.</h1><p role="alert">${esc(error.message)}</p><button id="retry" class="button primary">Tentar novamente</button><a class="back-link" href="#/transacoes">Voltar às transações</a></div>`,
    );
    document.querySelector("#retry").onclick = render;
  }
}
window.addEventListener("hashchange", render);
render();
