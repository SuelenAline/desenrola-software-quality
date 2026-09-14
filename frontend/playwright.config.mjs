import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";
const chrome =
  process.env.CHROME_PATH ||
  "C:/Program Files/Google/Chrome/Application/chrome.exe";
export default defineConfig({
  testDir: "./test",
  testMatch: "**/*.spec.mjs",
  timeout: 60000,
  workers: 1,
  retries: 0,
  use: {
    baseURL: "http://127.0.0.1:5174",
    browserName: "chromium",
    launchOptions: existsSync(chrome) ? { executablePath: chrome } : {},
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "node test/api-server.mjs",
      url: "http://127.0.0.1:3101",
      reuseExistingServer: false,
      timeout: 30000,
    },
    {
      command: "node server.mjs",
      url: "http://127.0.0.1:5174",
      env: { FRONTEND_PORT: "5174", API_ORIGIN: "http://127.0.0.1:3101" },
      reuseExistingServer: false,
    },
  ],
});
