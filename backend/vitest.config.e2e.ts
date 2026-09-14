import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';
import { typescriptPlugin } from './test/typescript-plugin.js';

export default defineConfig({
  plugins: [typescriptPlugin(), tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
  },
});
