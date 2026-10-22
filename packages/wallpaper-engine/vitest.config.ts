import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/package/**'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['tests/**/*.test.ts'],
      reporter: ['text', 'html', 'clover', 'json', ['lcovonly', { projectRoot: fileURLToPath(new URL('../../', import.meta.url)) }]],
      thresholds: {
        statements: 85,
        branches: 80,
        functions: 95,
        lines: 85,
      },
    },
  },
});
