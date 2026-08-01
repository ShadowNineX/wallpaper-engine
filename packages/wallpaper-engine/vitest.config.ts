import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['tests/**/*.test.ts'],
      thresholds: {
        statements: 85,
        branches: 80,
        functions: 95,
        lines: 85,
      },
    },
  },
});
