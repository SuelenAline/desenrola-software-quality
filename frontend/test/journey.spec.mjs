import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { loadEnvFile } from "node:process";

const errors = [];
test("complete account and transaction journey against the real local API", async ({
  page,
}) => {
  const run = randomUUID();
  const email = `ui-${run}@example.com`;
  const updatedEmail = `ui-updated-${run}@example.com`;
  const password = `UI-test-${run}`;
  const newPassword = `Changed-${run}`;
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await page.goto("/#/login");
    await expect(
      page.getByRole("heading", { name: "Bem-vindo de volta." }),
    ).toBeVisible();
    await page.screenshot({
      path: "test-results/login-desktop.png",
      fullPage: true,
    });
    await page.getByRole("link", { name: "Cadastre-se", exact: true }).click();
    await page.getByLabel("Seu nome").fill("Ana Teste");
    await page.getByLabel("E-mail", { exact: true }).fill(email);
    await page.getByLabel("Senha", { exact: true }).fill(password);
    await page.getByLabel("Confirme sua senha").fill("Different password");
    await page.getByRole("button", { name: "Criar minha conta" }).click();
    await expect(page.getByRole("alert")).toContainText(
      "As senhas não coincidem",
    );
    await page.getByLabel("Confirme sua senha").fill(password);
    await page.getByRole("button", { name: "Criar minha conta" }).click();
    await expect(
      page.getByRole("heading", { name: "Seu primeiro passo começa aqui" }),
    ).toBeVisible();
    await page
      .getByRole("link", { name: "Nova transação", exact: true })
      .click();
    await page
      .getByLabel("Descrição", { exact: true })
      .fill("Mercado da semana");
    await page
      .getByRole("textbox", { name: "Valor", exact: true })
      .fill("125,90");
    await page.getByRole("button", { name: "Cadastrar transação" }).click();
    await expect(
      page.getByRole("cell", { name: "Mercado da semana", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("link", { name: "Nova transação", exact: true })
      .click();
    await page.getByRole("radio", { name: "Receita", exact: true }).check();
    await page.getByLabel("Descrição", { exact: true }).fill("Salário");
    await page
      .getByRole("textbox", { name: "Valor", exact: true })
      .fill("3200,00");
    await page.getByRole("button", { name: "Cadastrar transação" }).click();
    await expect(page.locator(".balance strong")).toContainText("3.074,10");
    await page.screenshot({
      path: "test-results/transactions-desktop.png",
      fullPage: true,
    });
    await page.getByLabel("Buscar transações").fill("mercado");
    await expect(
      page.getByRole("cell", { name: "Salário", exact: true }),
    ).toHaveCount(0);
    await page.getByLabel("Filtrar por tipo").selectOption("Receita");
    await expect(
      page.getByRole("heading", { name: "Nenhuma transação encontrada" }),
    ).toBeVisible();
    await page.getByLabel("Buscar transações").fill("");
    await page.getByLabel("Filtrar por tipo").selectOption("");
    await page.getByRole("link", { name: "Editar Mercado da semana" }).click();
    await page
      .getByRole("textbox", { name: "Valor", exact: true })
      .fill("150,25");
    await page.getByRole("button", { name: "Salvar alterações" }).click();
    await expect(page.locator(".balance strong")).toContainText("3.049,75");
    await page
      .getByRole("button", { name: "Excluir Salário", exact: true })
      .click();
    await page.getByRole("button", { name: "Cancelar", exact: true }).click();
    await expect(
      page.getByRole("cell", { name: "Salário", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Excluir Salário", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Excluir transação", exact: true })
      .click();
    await expect(
      page.getByRole("cell", { name: "Salário", exact: true }),
    ).toHaveCount(0);
    await page.reload();
    await expect(
      page.getByRole("cell", { name: "Mercado da semana", exact: true }),
    ).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: "test-results/transactions-mobile.png",
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.getByRole("link", { name: "Meu perfil", exact: true }).click();
    await page.getByLabel("Nome", { exact: true }).fill("Ana Souza");
    await page.getByLabel("E-mail", { exact: true }).fill(updatedEmail);
    await page.getByLabel("Senha atual", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Salvar alterações" }).click();
    await expect(page.locator("#toast")).toHaveText(
      "Seu perfil foi atualizado.",
    );
    await expect(page.getByLabel("Nome", { exact: true })).toHaveValue(
      "Ana Souza",
    );
    await page.screenshot({
      path: "test-results/profile-mobile.png",
      fullPage: true,
    });
    await page.getByRole("button", { name: "Sair da conta" }).click();
    await page.getByLabel("E-mail", { exact: true }).fill(updatedEmail);
    await page.getByLabel("Senha", { exact: true }).fill("Wrong password");
    await page.getByRole("button", { name: "Entrar na minha conta" }).click();
    await expect(page.getByRole("alert")).toContainText(
      "E-mail ou senha inválidos",
    );
    await page.getByLabel("Senha", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Entrar na minha conta" }).click();
    await expect(
      page.getByRole("cell", { name: "Mercado da semana", exact: true }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Meu perfil", exact: true }).click();
    await page
      .getByLabel("Nova senha (opcional)", { exact: true })
      .fill(newPassword);
    await page
      .getByLabel("Confirme a nova senha", { exact: true })
      .fill(newPassword);
    await page.getByLabel("Senha atual", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Salvar alterações" }).click();
    await expect(
      page.getByRole("heading", { name: "Bem-vindo de volta." }),
    ).toBeVisible();
    await page.getByLabel("E-mail", { exact: true }).fill(updatedEmail);
    await page.getByLabel("Senha", { exact: true }).fill(newPassword);
    await page.getByRole("button", { name: "Entrar na minha conta" }).click();
    await page.getByRole("link", { name: "Meu perfil", exact: true }).click();
    await page
      .getByRole("button", { name: "Excluir conta", exact: true })
      .click();
    await page.getByRole("dialog").getByLabel("Senha atual").fill(newPassword);
    await page
      .getByRole("button", { name: "Excluir minha conta", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Bem-vindo de volta." }),
    ).toBeVisible();
    await page.screenshot({
      path: "test-results/login-mobile.png",
      fullPage: true,
    });
    expect(
      await page.evaluate(() => sessionStorage.getItem("desenrola.token")),
    ).toBeNull();
    expect(errors).toEqual([]);
  } finally {
    // Scope cleanup strictly to this test's random accounts, even if a UI assertion fails.
    loadEnvFile("../backend/.env");
    const require = createRequire(
      new URL("../../backend/package.json", import.meta.url),
    );
    const { PrismaClient } = require("@prisma/client");
    const db = new PrismaClient();
    try {
      await db.$transaction(async (tx) => {
        const users = await tx.user.findMany({
          where: { email: { in: [email, updatedEmail] } },
          select: { id: true },
        });
        await tx.transaction.deleteMany({
          where: { userId: { in: users.map((user) => user.id) } },
        });
        await tx.user.deleteMany({
          where: { email: { in: [email, updatedEmail] } },
        });
      });
    } finally {
      await db.$disconnect();
    }
  }
});

test("handles session expiry and API downtime without exposing protected screens", async ({
  page,
}) => {
  await page.addInitScript(() =>
    sessionStorage.setItem("desenrola.token", "expired-test-token"),
  );
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ message: "Token inválido ou expirado." }),
    }),
  );
  await page.goto("/#/perfil");
  await expect(
    page.getByRole("heading", { name: "Bem-vindo de volta." }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => sessionStorage.getItem("desenrola.token")),
  ).toBeNull();
  await page.route("**/api/auth/login", (route) =>
    route.fulfill({
      status: 502,
      contentType: "application/json",
      body: JSON.stringify({ message: "Não foi possível conectar à API." }),
    }),
  );
  await page.getByLabel("E-mail", { exact: true }).fill("test@example.com");
  await page.getByLabel("Senha", { exact: true }).fill("Some password");
  await page.getByRole("button", { name: "Entrar na minha conta" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Não foi possível conectar à API",
  );
  await expect(
    page.getByRole("button", { name: "Entrar na minha conta" }),
  ).toBeEnabled();
});
