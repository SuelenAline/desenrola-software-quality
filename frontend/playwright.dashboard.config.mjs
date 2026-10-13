import { defineConfig } from '@playwright/test';
import base from './playwright.config.mjs';

export default defineConfig({
  ...base,
  testMatch: '**/dashboard.spec.mjs',
  webServer: base.webServer[1],
});
