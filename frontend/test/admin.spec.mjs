import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { loadEnvFile } from "node:process";
import { PasswordService } from "../../backend/dist/auth/password.service.js";

test("administration works on desktop and mobile with the local API", async ({ page }) => {
  loadEnvFile("../backend/.env");
  const require = createRequire(new URL("../../backend/package.json", import.meta.url));
  const { PrismaClient } = require("@prisma/client");
  const db = new PrismaClient();
  const run = randomUUID();
  const email = `admin-${run}@example.com`;
  const targetEmail = `target-${run}@example.com`;
  const password = `Test-${run}`;
  const ids = [];

  try {
    const passwordHash = await new PasswordService().hash(password);
    const admin = await db.user.create({ data: { email, passwordHash, name: "Admin AC4", role: "ADMIN" } });
    ids.push(admin.id);
    const target = await db.user.create({
      data: { email: targetEmail, passwordHash, name: "Conta demonstração AC4" },
    });
    ids.push(target.id);
    await page.goto("/#/login");
    await page.getByLabel("E-mail", { exact: true }).fill(email);
    await page.getByLabel("Senha", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Entrar na minha conta" }).click();
    await page.getByRole("link", { name: "Administração" }).click();
    await expect(page.getByRole("heading", { name: "Painel administrativo" })).toBeVisible();
    const summary = page.getByRole("region", { name: "Indicadores administrativos" });
    await expect(summary.locator("article")).toHaveCount(4);
    await expect(summary.getByText("Usuários inativos")).toBeVisible();
    const search = page.getByLabel("Buscar por nome ou e-mail");
    await search.fill(targetEmail);
    await page.getByRole("button", { name: "Pesquisar" }).click();
    const accounts = page.locator("#admin-users");
    await expect(accounts.getByRole("listitem")).toHaveCount(1);
    await expect(accounts.getByText(targetEmail)).toBeVisible();
    await expect(accounts.getByText("Ativa", { exact: true })).toBeVisible();
    for (const width of [1280, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 800 });
      await expect(accounts.getByRole("button", { name: /Desativar conta de/ })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    await accounts.getByRole("button", { name: /Desativar conta de/ }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Desativar conta" }).click();
    await expect(accounts.getByText("Inativa", { exact: true })).toBeVisible();
    await expect(page.locator("#activity-list").getByRole("listitem").first()).toContainText("Desativação de conta");
    await accounts.getByRole("button", { name: /Reativar conta de/ }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Reativar conta" }).click();
    await expect(accounts.getByText("Ativa", { exact: true })).toBeVisible();
    await expect(page.locator("#activity-list").getByRole("listitem").first()).toContainText("Reativação de conta");
  } finally {
    try {
      await db.$transaction([
        db.activity.deleteMany({ where: { actorId: { in: ids } } }),
        db.user.deleteMany({ where: { id: { in: ids } } }),
      ]);
    } finally {
      await db.$disconnect();
    }
  }
});
